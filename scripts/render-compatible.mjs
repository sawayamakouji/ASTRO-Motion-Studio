import {spawn} from 'node:child_process';
import {access, mkdir, readFile, readdir, rename, rm, stat} from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const FPS = 30;
const SCENES_PATH = path.join(ROOT, 'src', 'data', 'scenes.json');
const OUT_DIR = path.join(ROOT, 'out');

const args = new Set(process.argv.slice(2));
const kind = args.has('--final') ? 'final' : 'preview';
const scale = kind === 'preview' ? 0.5 : 1;
const outputFile =
  kind === 'preview'
    ? path.join(OUT_DIR, 'preview.mp4')
    : path.join(OUT_DIR, 'astro-motion-studio.mp4');

const rawFramesDir = path.join(OUT_DIR, `astro-${kind}-raw`);
const framesDir = path.join(OUT_DIR, `astro-${kind}-frames`);

const exists = async (filename) => {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
};

const run = (command, commandArgs, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: ROOT,
      env: process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    const tail = [];
    const record = (chunk, writer) => {
      writer(chunk);
      for (const line of String(chunk).split(/\\r?\\n|\\r/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        tail.push(trimmed);
        if (tail.length > 24) tail.shift();
      }
    };

    child.stdout.on('data', (chunk) => record(chunk, (value) => process.stdout.write(value)));
    child.stderr.on('data', (chunk) => record(chunk, (value) => process.stderr.write(value)));

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const detail = tail.length > 0 ? `\\n${tail.join('\\n')}` : '';
      reject(
        new Error(
          `${path.basename(command)} exited with code ${code}.${detail}`,
        ),
      );
    });
  });

const capture = (command, commandArgs) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: ROOT,
      env: process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `${path.basename(command)} exited with code ${code}`));
    });
  });

const resolveOnPath = async (name) => {
  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    const result = await capture(locator, [name]);
    return result
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
  } catch {
    return null;
  }
};

const resolveFfmpeg = async () => {
  const explicit = process.env.ASTRO_FFMPEG_PATH?.trim();
  if (explicit) {
    if (!(await exists(explicit))) {
      throw new Error(`ASTRO_FFMPEG_PATH does not exist: ${explicit}`);
    }
    return explicit;
  }

  const discovered = await resolveOnPath('ffmpeg');
  if (!discovered) {
    throw new Error(
      'External ffmpeg was not found. Install an allowed ffmpeg or set ASTRO_FFMPEG_PATH.',
    );
  }

  return discovered;
};

const resolveFfprobe = async (ffmpeg) => {
  const explicit = process.env.ASTRO_FFPROBE_PATH?.trim();
  if (explicit) {
    if (!(await exists(explicit))) {
      throw new Error(`ASTRO_FFPROBE_PATH does not exist: ${explicit}`);
    }
    return explicit;
  }

  const sibling = path.join(
    path.dirname(ffmpeg),
    process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe',
  );
  if (await exists(sibling)) return sibling;

  const discovered = await resolveOnPath('ffprobe');
  if (!discovered) {
    throw new Error(
      'External ffprobe was not found. Install it next to ffmpeg or set ASTRO_FFPROBE_PATH.',
    );
  }

  return discovered;
};

const remotionCli = () =>
  path.join(ROOT, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');

const audioDuration = async (ffprobe, filename) => {
  const value = await capture(ffprobe, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filename,
  ]);
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) {
    throw new Error(`Could not read audio duration: ${filename}`);
  }
  return seconds;
};

const resolveTimeline = async (ffprobe, scenes) => {
  let cursor = 0;
  const resolved = [];

  for (const scene of scenes) {
    const audioFile = scene.audioFile
      ? path.join(ROOT, 'public', scene.audioFile)
      : null;
    const hasAudio = audioFile ? await exists(audioFile) : false;
    const seconds = hasAudio ? await audioDuration(ffprobe, audioFile) : null;
    const duration = Math.max(
      Number(scene.durationSeconds) || 1,
      seconds === null ? 0 : seconds + 0.7,
    );

    resolved.push({
      ...scene,
      audioPath: hasAudio ? audioFile : null,
      audioDuration: seconds,
      startSeconds: cursor,
      resolvedDurationSeconds: duration,
    });

    cursor += Math.ceil(duration * FPS) / FPS;
  }

  return {scenes: resolved, totalSeconds: cursor};
};

const normalizeFrames = async () => {
  await rm(framesDir, {recursive: true, force: true});
  await mkdir(framesDir, {recursive: true});

  const entries = (
    await Promise.all(
      (await readdir(rawFramesDir)).map(async (name) => ({
        name,
        info: await stat(path.join(rawFramesDir, name)),
      })),
    )
  )
    .filter(({name, info}) => info.isFile() && /\.(?:jpe?g|png)$/i.test(name))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}),
    );

  if (entries.length === 0) {
    throw new Error('Remotion did not produce any image frames.');
  }

  for (let i = 0; i < entries.length; i += 1) {
    const source = path.join(rawFramesDir, entries[i].name);
    const target = path.join(framesDir, `frame-${String(i).padStart(6, '0')}.jpg`);
    await rename(source, target);
  }

  await rm(rawFramesDir, {recursive: true, force: true});
  return entries.length;
};

const renderFrames = async () => {
  await rm(rawFramesDir, {recursive: true, force: true});
  await mkdir(OUT_DIR, {recursive: true});

  const commandArgs = [
    'render',
    'src/index.ts',
    'AstroNarratedSlides',
    rawFramesDir,
    '--sequence',
    '--image-format=jpeg',
  ];

  if (scale !== 1) commandArgs.push(`--scale=${scale}`);

  console.log(
    `[ASTRO] Rendering ${kind} frames with Remotion (${scale === 1 ? '1920x1080' : '960x540'})...`,
  );
  const cli = remotionCli();
  if (!(await exists(cli))) {
    throw new Error(
      'Remotion CLI entrypoint was not found. Run npm install in the ASTRO-Motion-Studio folder.',
    );
  }

  await run(process.execPath, [cli, ...commandArgs]);
  return normalizeFrames();
};

const encodeVideo = async (ffmpeg, timeline) => {
  const inputArgs = [
    '-y',
    '-hide_banner',
    '-framerate',
    String(FPS),
    '-start_number',
    '0',
    '-i',
    path.join(framesDir, 'frame-%06d.jpg'),
  ];

  const audioScenes = timeline.scenes.filter((scene) => scene.audioPath);
  for (const scene of audioScenes) {
    inputArgs.push('-i', scene.audioPath);
  }

  const outputArgs = ['-map', '0:v:0'];

  if (audioScenes.length > 0) {
    const filters = audioScenes.map((scene, index) => {
      const delay = Math.max(0, Math.round(scene.startSeconds * 1000));
      return `[${index + 1}:a]adelay=${delay}:all=1[a${index}]`;
    });
    const labels = audioScenes.map((_, index) => `[a${index}]`).join('');
    filters.push(
      `${labels}amix=inputs=${audioScenes.length}:duration=longest:dropout_transition=0:normalize=0,apad[aout]`,
    );

    outputArgs.push(
      '-filter_complex',
      filters.join(';'),
      '-map',
      '[aout]',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
    );
  }

  outputArgs.push(
    '-c:v',
    'libx264',
    '-crf',
    kind === 'preview' ? '21' : '18',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outputFile,
  );

  console.log(
    `[ASTRO] Encoding ${kind} MP4 with external ffmpeg and ${audioScenes.length} narration track(s)...`,
  );
  await run(ffmpeg, [...inputArgs, ...outputArgs]);
};

const cleanup = async () => {
  if (process.env.ASTRO_KEEP_FRAMES === '1') return;
  await rm(rawFramesDir, {recursive: true, force: true});
  await rm(framesDir, {recursive: true, force: true});
};

try {
  const ffmpeg = await resolveFfmpeg();
  const ffprobe = await resolveFfprobe(ffmpeg);
  const scenes = JSON.parse(await readFile(SCENES_PATH, 'utf8'));
  const timeline = await resolveTimeline(ffprobe, scenes);

  console.log(`[ASTRO] Compatible render mode: ${kind}`);
  console.log(`[ASTRO] ffmpeg: ${ffmpeg}`);
  console.log(`[ASTRO] ffprobe: ${ffprobe}`);

  const frameCount = await renderFrames();
  console.log(`[ASTRO] Prepared ${frameCount} frame(s).`);

  await encodeVideo(ffmpeg, timeline);
  console.log(`[ASTRO] Render complete: ${path.relative(ROOT, outputFile)}`);
  await cleanup();
} catch (error) {
  console.error(`[ASTRO] Compatible render failed: ${error.message}`);
  process.exitCode = 1;
}
