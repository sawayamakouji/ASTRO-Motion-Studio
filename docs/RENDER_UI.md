# Browser render workflow

Start the local workspace:

```bash
npm install
npm run voice-ui
```

Open:

```
http://127.0.0.1:4173
```

## Recommended workflow

1. Select and preview a VOICEVOX voice.
2. Generate narration for all scenes.
3. Click **軽量プレビューを生成**.
4. Review the 960×540 preview inside the browser.
5. Click **最終MP4を生成**.
6. Review the 1920×1080 final video inside the browser.

Outputs:

```
out/preview.mp4
out/astro-motion-studio.mp4
```

The local UI polls render status and shows recent Remotion CLI output. Only one render job can run at a time.

## CLI equivalents

```bash
npm run render:preview
npm run render
```

The UI server is bound to `127.0.0.1` and is intended for local use only.
