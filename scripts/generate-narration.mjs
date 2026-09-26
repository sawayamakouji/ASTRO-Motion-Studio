import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.OPENAI_API_KEY;
const voice = process.env.ASTRO_VOICE || 'marin';
const model = process.env.ASTRO_TTS_MODEL || 'gpt-4o-mini-tts';

if (!apiKey) {
  console.error('OPENAI_API_KEY is missing. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const sourcePath = path.resolve('src/data/scenes.json');
const scenes = JSON.parse(await readFile(sourcePath, 'utf8'));

for (const scene of scenes) {
  if (!scene.narration || !scene.audioFile) continue;

  const outputPath = path.resolve('public', scene.audioFile);
  await mkdir(path.dirname(outputPath), {recursive: true});

  console.log(`Generating: ${scene.id} -> ${scene.audioFile}`);

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      input: scene.narration,
      response_format: 'mp3',
      instructions:
        'Speak in natural Japanese. Clear, calm, intelligent presentation style. Use short pauses at punctuation. Avoid exaggerated announcer delivery.',
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`TTS failed for ${scene.id}: ${response.status} ${message}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, bytes);
}

console.log('Narration complete. Voice is AI-generated.');
