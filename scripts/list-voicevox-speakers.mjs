import {loadLocalEnv} from './lib/env.mjs';

await loadLocalEnv();

const baseUrl = new URL(
  process.env.ASTRO_VOICEVOX_URL || 'http://127.0.0.1:50021',
);

try {
  const response = await fetch(new URL('/speakers', baseUrl));
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }

  const speakers = await response.json();

  console.log('\nVOICEVOX speakers\n');
  for (const speaker of speakers) {
    console.log(speaker.name);
    for (const style of speaker.styles ?? []) {
      console.log(`  id=${style.id}  ${style.name}`);
    }
  }

  console.log(
    '\n使いたい id を .env の ASTRO_VOICEVOX_SPEAKER_ID に設定してください。\n',
  );
} catch (error) {
  console.error(
    `VOICEVOX に接続できません: ${baseUrl.origin}\nVOICEVOX Nemo / VOICEVOX を起動してから再実行してください。\n${error.message}`,
  );
  process.exit(1);
}
