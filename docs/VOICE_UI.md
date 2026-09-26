# Voice Control UI

VOICEVOX / VOICEVOX Nemo のナレーション設定をブラウザから操作するローカルUIです。

## Start

1. VOICEVOX Nemo または VOICEVOX を起動
2. ASTRO Motion Studio で:

```bash
npm install
npm run voice-ui
```

3. ブラウザで:

```
http://127.0.0.1:4173
```

## Features

- VOICEVOXの話者 / スタイル一覧
- 速度
- 抑揚
- 高さ
- 音量
- 任意文章の試聴
- 1シーンだけ音声生成
- 全スライドの音声一括生成
- 設定保存

設定は `.astro/voice-ui.json` に保存され、Gitにはコミットされません。

生成音声は `public/audio/*.wav` に保存されます。

## Local-only design

Voice Control server binds to `127.0.0.1` only. It is intended for local development, not direct internet exposure.

Port can be changed with:

```env
ASTRO_VOICE_UI_PORT=4173
```

## Next

After narration generation:

```bash
npm run studio
```

or:

```bash
npm run render
```
