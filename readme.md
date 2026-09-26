# ASTRO Motion Studio

資料・分析結果を **ナレーション付きスライド動画** に変換する、Remotion ベースの生成フレームワークです。

現在は **VOICEVOX / VOICEVOX Nemo を標準ナレーション** にしているため、ローカル環境だけで無料の音声生成ができます。必要な作品だけ OpenAI TTS に切り替えられます。

## Pipeline

```
PDF / Word / Excel / CSV / analysis
              ↓
      ChatGPT / Codex
              ↓
       scenes.json
              ↓
  ┌──────────────────────┐
  │ Narration provider   │
  │                      │
  │ VOICEVOX  ← default  │
  │ OpenAI     ← optional│
  │ none                  │
  └──────────────────────┘
              ↓
        narration WAV
              ↓
          Remotion
              ↓
     narrated MP4 video
```

現在のシーンテンプレート:

- Hero — タイトル・導入
- Metric — KPI / 数字の強調
- Compare — 実績 vs 比較対象
- Process — 手順・フロー
- Summary — 要点整理

音声ファイルが存在する場合は、実際のナレーション尺を読み取り、必要に応じて各スライドの表示時間を自動延長します。音声がなくても `durationSeconds` を使ってプレビューできます。

## ブラウザで声を選ぶ（おすすめ）

VOICEVOX Nemo / VOICEVOX を起動したあと:

```bash
npm install
npm run voice-ui
```

ブラウザで `http://127.0.0.1:4173` を開きます。

ここから以下を操作できます。

- 話者 / スタイル選択
- 速度・抑揚・高さ・音量
- 任意文章の試聴
- 1シーンだけ生成
- 全スライドを一括生成
- 設定保存

設定は `.astro/voice-ui.json` に保存され、Gitには入りません。詳細は `docs/VOICE_UI.md`。

## まず無料で動かす

### 1. VOICEVOX Nemo または VOICEVOX を起動

ローカル音声エンジンが標準の

```
http://127.0.0.1:50021
```

で使える状態にします。

### 2. ASTRO Motion Studio を準備

```bash
npm install
```

### 3. 使える声を確認

```bash
npm run voices
```

話者名・スタイル名・IDが一覧表示されます。

### 4. ナレーション生成

設定なしでもVOICEVOXが標準です。

```bash
npm run narrate
```

初回は利用可能な最初の話者スタイルを自動選択します。

好きな声を固定したい場合だけ、`.env.example` を `.env` にコピーして設定します。

```env
ASTRO_TTS_PROVIDER=voicevox
ASTRO_VOICEVOX_URL=http://127.0.0.1:50021
ASTRO_VOICEVOX_SPEAKER_ID=1

ASTRO_VOICEVOX_SPEED=1.0
ASTRO_VOICEVOX_PITCH=0.0
ASTRO_VOICEVOX_INTONATION=1.0
ASTRO_VOICEVOX_VOLUME=1.0
```

### 5. プレビュー

```bash
npm run studio
```

### 6. MP4を書き出す

```bash
npm run render
```

出力:

```
out/astro-motion-studio.mp4
```

音声生成から一気に行う場合:

```bash
npm run make
```

## 音声エンジンを切り替える

### 無料ローカル音声

```bash
npm run narrate:voicevox
```

### OpenAI TTS

`.env`:

```env
OPENAI_API_KEY=...
ASTRO_OPENAI_VOICE=marin
```

実行:

```bash
npm run narrate:openai
```

### 音声なし

```bash
npm run narrate:none
```

VOICEVOX と OpenAI のどちらも WAV を生成するため、`scenes.json` を書き換えずに切り替えられます。

詳細: `docs/TTS.md`

## Create your own presentation

編集する中心ファイル:

```
src/data/scenes.json
```

ChatGPT / Codex には `prompts/create-presentation.md` を渡すと、この形式のJSONを作りやすくなります。

詳細な項目は `docs/SCENE_SCHEMA.md` を参照してください。

## Repository structure

```
src/
  components/
    AstroPresentation.tsx
    Slide.tsx
  data/
    scenes.json
  Root.tsx
  index.ts
  types.ts

scripts/
  generate-narration.mjs
  list-voicevox-speakers.mjs
  lib/
    env.mjs
  tts/
    voicevox.mjs
    openai.mjs

prompts/
  create-presentation.md

docs/
  SCENE_SCHEMA.md
  TTS.md

public/
  audio/
```

## Current commands

```bash
npm run studio
npm run voice-ui
npm run voices
npm run narrate
npm run narrate:voicevox
npm run narrate:openai
npm run narrate:none
npm run render
npm run make
npm run typecheck
npm run check:scripts
```

## Next milestones

- ブラウザUIからRemotionプレビュー / レンダリングまで実行
- 資料アップロード → scenes.json 自動生成
- 画像・図解生成レイヤー
- 棒グラフ / 折れ線 / 因果推論 / 店舗比較などの分析テンプレート
- 字幕の単語単位同期
- BGM / SE ミキシング
- 9:16 / 1:1 出力
- Cloud rendering

> 公開・商用利用する場合は、選択した音声ごとの最新の利用規約・クレジット条件を確認してください。

---

ASTRO Motion Studio is designed as a reusable video system: **one structured source, many narrated outputs.**
