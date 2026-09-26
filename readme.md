# ASTRO Motion Studio

資料・分析結果を **ナレーション付きスライド動画** に変換するための、Remotion ベースの生成フレームワークです。

初版の狙いは「毎回ゼロから動画を作る」のではなく、内容を `scenes.json` に集約し、同じ映像部品を何度でも再利用できるようにすることです。

## What it does

```
PDF / Word / Excel / CSV / analysis
              ↓
      ChatGPT / Codex
              ↓
       scenes.json
              ↓
        OpenAI TTS
              ↓
       narration MP3
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

音声ファイルが存在する場合は、実際のナレーション尺を読み取り、必要に応じて各スライドの表示時間を自動延長します。音声がまだなくても、`durationSeconds` を使ってプレビューできます。

## Quick start

Node.js 20.6 以上を推奨します。

```bash
npm install
npm run studio
```

Remotion Studio が開くので、まずサンプルスライドを確認できます。

## Generate narration

1. `.env.example` を `.env` にコピー
2. OpenAI API key を設定

```env
OPENAI_API_KEY=your_key_here
ASTRO_VOICE=marin
```

音声生成:

```bash
npm run narrate
```

生成された MP3 は `public/audio/` に保存されます。APIキーと生成音声は Git にコミットしません。

OpenAI のTTS音声を利用するため、完成物ではAI生成音声であることが分かる表示を残してください。このテンプレートでは各スライド下部に `AI narration` と表示します。

## Render MP4

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

## Create your own presentation

編集する中心ファイルはこれだけです。

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

prompts/
  create-presentation.md

docs/
  SCENE_SCHEMA.md

public/
  audio/
```

## Next milestones

- 資料アップロード → scenes.json 自動生成
- 画像・図解生成レイヤー
- 棒グラフ / 折れ線 / 因果推論 / 店舗比較などの分析テンプレート
- 字幕の単語単位同期
- BGM / SE ミキシング
- 9:16 / 1:1 出力
- ブラウザUIからテーマ・尺・声を変更
- Cloud rendering

---

ASTRO Motion Studio is designed as a reusable video system: **one structured source, many narrated outputs.**
