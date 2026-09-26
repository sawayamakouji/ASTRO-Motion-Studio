import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {loadLocalEnv, readCliOption} from './lib/env.mjs';
import {createVoicevoxProvider} from './tts/voicevox.mjs';
import {createOpenAIProvider} from './tts/openai.mjs';

await loadLocalEnv();

const providerName = (
  readCliOption('provider') ||
  process.env.ASTRO_TTS_PROVIDER ||
  'voicevox'
).toLowerCase();

if (providerName === 'none' || providerName === 'off') {
  console.log('Narration generation is disabled (provider=none).');
  process.exit(0);
}

const provider =
  providerName === 'voicevox'
    ? createVoicevoxProvider()
    : providerName === 'openai'
      ? createOpenAIProvider()
      : null;

if (!provider) {
  console.error(
    `Unknown TTS provider: ${providerName}. Use voicevox, openai, or none.`,
  );
  process.exit(1);
}

const sourcePath = path.resolve('src/data/scenes.json');
const scenes = JSON.parse(await readFile(sourcePath, 'utf8'));

console.log(`Narration provider: ${provider.name}`);

for (const scene of scenes) {
  if (!scene.narration || !scene.audioFile) continue;

  const extension = path.extname(scene.audioFile).slice(1).toLowerCase();
  if (extension !== provider.extension) {
    throw new Error(
      `${scene.id}: audioFile must end with .${provider.extension} when using ${provider.name}. Received: ${scene.audioFile}`,
    );
  }

  const outputPath = path.resolve('public', scene.audioFile);
  await mkdir(path.dirname(outputPath), {recursive: true});

  console.log(`Generating: ${scene.id} -> ${scene.audioFile}`);
  const bytes = await provider.synthesize(scene.narration);
  await writeFile(outputPath, bytes);
}

console.log(`Narration complete with ${provider.name}.`);
