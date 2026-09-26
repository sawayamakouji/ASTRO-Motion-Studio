import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {loadLocalEnv} from './lib/env.mjs';
import {
  createVoicevoxProvider,
  listVoicevoxSpeakers,
} from './tts/voicevox.mjs';

await loadLocalEnv();

const HOST = '127.0.0.1';
const PORT = Number(process.env.ASTRO_VOICE_UI_PORT || 4173);
const ROOT = process.cwd();
const UI_DIR = path.join(ROOT, 'web', 'voice-control');
const SCENES_PATH = path.join(ROOT, 'src', 'data', 'scenes.json');
const SETTINGS_PATH = path.join(ROOT, '.astro', 'voice-ui.json');
const AUDIO_ROOT = path.join(ROOT, 'public', 'audio');
const OUT_DIR = path.join(ROOT, 'out');
const PREVIEW_VIDEO = path.join(OUT_DIR, 'preview.mp4');
const FINAL_VIDEO = path.join(OUT_DIR, 'astro-motion-studio.mp4');

const json = (res, statusCode, value) => {
  res.writeHead(statusCode, {'Content-Type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(value));
};

const text = (res, statusCode, value, type = 'text/plain; charset=utf-8') => {
  res.writeHead(statusCode, {'Content-Type': type});
  res.end(value);
};

const readBody = async (req) => {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 1024 * 1024) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const fileExists = async (filename) => {
  try {
    await stat(filename);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
};

const getScenes = async () => JSON.parse(await readFile(SCENES_PATH, 'utf8'));

const defaults = {
  baseUrl: process.env.ASTRO_VOICEVOX_URL || 'http://127.0.0.1:50021',
  speakerId:
    process.env.ASTRO_VOICEVOX_SPEAKER_ID === undefined ||
    process.env.ASTRO_VOICEVOX_SPEAKER_ID === ''
      ? null
      : Number(process.env.ASTRO_VOICEVOX_SPEAKER_ID),
  speed: Number(process.env.ASTRO_VOICEVOX_SPEED || 1),
  pitch: Number(process.env.ASTRO_VOICEVOX_PITCH || 0),
  intonation: Number(process.env.ASTRO_VOICEVOX_INTONATION || 1),
  volume: Number(process.env.ASTRO_VOICEVOX_VOLUME || 1),
};

const sanitizeSettings = (value = {}) => {
  const numeric = (key, fallback, min, max) => {
    const parsed = Number(value[key] ?? fallback);
    if (!Number.isFinite(parsed)) throw new Error(`${key} must be a number.`);
    return Math.min(max, Math.max(min, parsed));
  };

  const rawSpeaker = value.speakerId;
  const speakerId =
    rawSpeaker === null || rawSpeaker === undefined || rawSpeaker === ''
      ? null
      : Number(rawSpeaker);

  if (speakerId !== null && !Number.isInteger(speakerId)) {
    throw new Error('speakerId must be an integer.');
  }

  const baseUrl = String(value.baseUrl || defaults.baseUrl);
  const parsedUrl = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('VOICEVOX URL must use http or https.');
  }

  return {
    baseUrl: parsedUrl.toString().replace(/\/$/, ''),
    speakerId,
    speed: numeric('speed', defaults.speed, 0.5, 2),
    pitch: numeric('pitch', defaults.pitch, -0.15, 0.15),
    intonation: numeric('intonation', defaults.intonation, 0, 2),
    volume: numeric('volume', defaults.volume, 0, 2),
  };
};

const loadSettings = async () => {
  try {
    return sanitizeSettings(JSON.parse(await readFile(SETTINGS_PATH, 'utf8')));
  } catch (error) {
    if (error?.code !== 'ENOENT') console.warn('Settings reset:', error.message);
    return sanitizeSettings(defaults);
  }
};

const saveSettings = async (settings) => {
  const clean = sanitizeSettings(settings);
  await mkdir(path.dirname(SETTINGS_PATH), {recursive: true});
  await writeFile(SETTINGS_PATH, JSON.stringify(clean, null, 2) + '\n');
  return clean;
};

const providerFrom = (settings) =>
  createVoicevoxProvider({
    baseUrl: settings.baseUrl,
    speakerId: settings.speakerId,
    speed: settings.speed,
    pitch: settings.pitch,
    intonation: settings.intonation,
    volume: settings.volume,
  });

const safeAudioPath = (audioFile) => {
  if (!audioFile) throw new Error('Scene has no audioFile.');
  const target = path.resolve(ROOT, 'public', audioFile);
  const relative = path.relative(AUDIO_ROOT, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('audioFile must stay inside public/audio.');
  }
  return target;
};

const generateScene = async (scene, settings) => {
  if (!scene?.narration) throw new Error('Scene has no narration.');
  if (!scene?.audioFile?.toLowerCase().endsWith('.wav')) {
    throw new Error(`${scene?.id || 'scene'} must use a .wav audioFile.`);
  }

  const provider = providerFrom(settings);
  const bytes = await provider.synthesize(scene.narration);
  const outputPath = safeAudioPath(scene.audioFile);
  await mkdir(path.dirname(outputPath), {recursive: true});
  await writeFile(outputPath, bytes);

  return {
    id: scene.id,
    title: scene.title,
    audioFile: scene.audioFile,
    bytes: bytes.length,
  };
};

const renderState = {
  status: 'idle',
  kind: null,
  progress: 0,
  startedAt: null,
  finishedAt: null,
  outputUrl: null,
  log: [],
  error: null,
};

const pushRenderLog = (chunk) => {
  const lines = String(chunk)
    .split(/\r?\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    renderState.log.push(line);
    if (renderState.log.length > 14) renderState.log.shift();

    const ratio = line.match(/Rendered\s+(\d+)\s*\/\s*(\d+)/i);
    if (ratio) {
      const current = Number(ratio[1]);
      const total = Number(ratio[2]);
      if (total > 0) {
        renderState.progress = Math.max(
          renderState.progress,
          Math.min(96, Math.round((current / total) * 96)),
        );
      }
    }

    const percent = line.match(/(?:^|\s)(\d{1,3})%/);
    if (percent) {
      renderState.progress = Math.max(
        renderState.progress,
        Math.min(96, Number(percent[1])),
      );
    }
  }
};

const runNpmScript = (scriptName) => {
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', `npm run ${scriptName}`], {
      cwd: ROOT,
      env: process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  return spawn('npm', ['run', scriptName], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
};

const startRender = async (kind) => {
  if (renderState.status === 'running') {
    const error = new Error('別の動画レンダリングが進行中です。');
    error.statusCode = 409;
    throw error;
  }

  const scriptName = kind === 'preview' ? 'render:preview' : 'render';
  const outputUrl =
    kind === 'preview' ? '/media/preview.mp4' : '/media/final.mp4';

  await mkdir(OUT_DIR, {recursive: true});

  Object.assign(renderState, {
    status: 'running',
    kind,
    progress: 2,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    outputUrl,
    log: [`${kind === 'preview' ? 'Preview' : 'Final'} render started`],
    error: null,
  });

  const child = runNpmScript(scriptName);

  child.stdout.on('data', pushRenderLog);
  child.stderr.on('data', pushRenderLog);

  child.on('error', (error) => {
    Object.assign(renderState, {
      status: 'error',
      progress: 0,
      finishedAt: new Date().toISOString(),
      error: error.message,
    });
  });

  child.on('close', (code) => {
    if (renderState.status === 'error') return;

    if (code === 0) {
      Object.assign(renderState, {
        status: 'done',
        progress: 100,
        finishedAt: new Date().toISOString(),
        error: null,
      });
      pushRenderLog('Render complete.');
      return;
    }

    Object.assign(renderState, {
      status: 'error',
      progress: 0,
      finishedAt: new Date().toISOString(),
      error: `Render process exited with code ${code}.`,
    });
  });

  return renderState;
};

const renderStatusPayload = async () => ({
  ...renderState,
  previewReady: await fileExists(PREVIEW_VIDEO),
  finalReady: await fileExists(FINAL_VIDEO),
  latestLog: renderState.log.at(-1) || '',
});

const streamVideo = async (req, res, filename) => {
  const info = await stat(filename);
  const range = req.headers.range;

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');

  if (!range) {
    res.writeHead(200, {'Content-Length': info.size});
    return createReadStream(filename).pipe(res);
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.writeHead(416, {'Content-Range': `bytes */${info.size}`});
    return res.end();
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : info.size - 1;

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= info.size
  ) {
    res.writeHead(416, {'Content-Range': `bytes */${info.size}`});
    return res.end();
  }

  const boundedEnd = Math.min(end, info.size - 1);
  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${boundedEnd}/${info.size}`,
    'Content-Length': boundedEnd - start + 1,
  });

  return createReadStream(filename, {start, end: boundedEnd}).pipe(res);
};

const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      const settings = await loadSettings();
      try {
        const speakers = await listVoicevoxSpeakers(settings.baseUrl);
        return json(res, 200, {
          ok: true,
          voicevox: true,
          baseUrl: settings.baseUrl,
          speakers: speakers.length,
        });
      } catch (error) {
        return json(res, 200, {
          ok: true,
          voicevox: false,
          baseUrl: settings.baseUrl,
          error: error.message,
        });
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      return json(res, 200, await loadSettings());
    }

    if (req.method === 'POST' && url.pathname === '/api/config') {
      return json(res, 200, await saveSettings(await readBody(req)));
    }

    if (req.method === 'GET' && url.pathname === '/api/scenes') {
      const scenes = await getScenes();
      return json(
        res,
        200,
        scenes.map(({id, title, narration, audioFile}) => ({
          id,
          title,
          narration,
          audioFile,
        })),
      );
    }

    if (req.method === 'GET' && url.pathname === '/api/speakers') {
      const settings = await loadSettings();
      const speakers = await listVoicevoxSpeakers(settings.baseUrl);
      return json(res, 200, speakers);
    }

    if (req.method === 'POST' && url.pathname === '/api/preview') {
      const body = await readBody(req);
      const settings = sanitizeSettings(body.settings || (await loadSettings()));
      const previewText = String(body.text || '').trim();
      if (!previewText) throw new Error('試聴する文章を入力してください。');
      if (previewText.length > 1000) throw new Error('試聴文は1000文字以内です。');

      const audio = await providerFrom(settings).synthesize(previewText);
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': audio.length,
        'Cache-Control': 'no-store',
      });
      return res.end(audio);
    }

    if (req.method === 'POST' && url.pathname === '/api/generate-scene') {
      const body = await readBody(req);
      const settings = sanitizeSettings(body.settings || (await loadSettings()));
      const scenes = await getScenes();
      const scene = scenes.find((item) => item.id === body.id);
      if (!scene) return json(res, 404, {error: 'Scene not found.'});
      return json(res, 200, await generateScene(scene, settings));
    }

    if (req.method === 'POST' && url.pathname === '/api/generate-all') {
      const body = await readBody(req);
      const settings = sanitizeSettings(body.settings || (await loadSettings()));
      const scenes = await getScenes();
      const generated = [];
      for (const scene of scenes) {
        if (!scene.narration || !scene.audioFile) continue;
        generated.push(await generateScene(scene, settings));
      }
      return json(res, 200, {generated});
    }

    if (req.method === 'GET' && url.pathname === '/api/render-status') {
      return json(res, 200, await renderStatusPayload());
    }

    if (req.method === 'POST' && url.pathname === '/api/render-preview') {
      return json(res, 202, await startRender('preview'));
    }

    if (req.method === 'POST' && url.pathname === '/api/render-final') {
      return json(res, 202, await startRender('final'));
    }

    if (req.method === 'GET' && url.pathname === '/media/preview.mp4') {
      if (!(await fileExists(PREVIEW_VIDEO))) {
        return json(res, 404, {error: 'Preview video has not been rendered yet.'});
      }
      return streamVideo(req, res, PREVIEW_VIDEO);
    }

    if (req.method === 'GET' && url.pathname === '/media/final.mp4') {
      if (!(await fileExists(FINAL_VIDEO))) {
        return json(res, 404, {error: 'Final video has not been rendered yet.'});
      }
      return streamVideo(req, res, FINAL_VIDEO);
    }

    const staticEntry = staticFiles.get(url.pathname);
    if (req.method === 'GET' && staticEntry) {
      const [filename, type] = staticEntry;
      return text(
        res,
        200,
        await readFile(path.join(UI_DIR, filename), 'utf8'),
        type,
      );
    }

    return json(res, 404, {error: 'Not found.'});
  } catch (error) {
    console.error(error);
    return json(
      res,
      Number(error.statusCode) || 500,
      {error: error.message || 'Unexpected error.'},
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('ASTRO Motion Studio — Voice & Render Control');
  console.log(`http://${HOST}:${PORT}`);
  console.log('');
  console.log('VOICEVOX Nemo / VOICEVOX を起動した状態でブラウザを開いてください。');
});
