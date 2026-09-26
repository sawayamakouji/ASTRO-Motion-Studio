import {createServer} from 'node:http';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
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

const json = (res, status, value) => {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(value));
};

const text = (res, status, value, type = 'text/plain; charset=utf-8') => {
  res.writeHead(status, {'Content-Type': type});
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
    return json(res, 500, {error: error.message || 'Unexpected error.'});
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('ASTRO Motion Studio — Voice Control');
  console.log(`http://${HOST}:${PORT}`);
  console.log('');
  console.log('VOICEVOX Nemo / VOICEVOX を起動した状態でブラウザを開いてください。');
});
