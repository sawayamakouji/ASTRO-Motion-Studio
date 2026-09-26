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

The local UI polls render status and shows recent output. Only one render job can run at a time.

## Windows / enterprise PC compatible rendering

Some managed Windows PCs block the FFmpeg binaries bundled inside Remotion because of Code Integrity / application-control policies.

ASTRO now has a compatible rendering path:

```
Remotion -> JPEG frame sequence -> allowed external FFmpeg -> H.264/AAC MP4
                                  -> VOICEVOX WAV tracks are mixed at scene offsets
```

When `ASTRO_RENDER_MODE=auto` (default), the browser UI uses this compatible path automatically on Windows. It looks up `ffmpeg` and `ffprobe` from PATH.

You can force paths in `.env` when needed:

```env
ASTRO_RENDER_MODE=compatible
ASTRO_FFMPEG_PATH=C:\path\to\ffmpeg.exe
ASTRO_FFPROBE_PATH=C:\path\to\ffprobe.exe
```

Temporary image frames are removed after a successful render. Set `ASTRO_KEEP_FRAMES=1` while debugging if you want to keep them.

## CLI equivalents

Normal Remotion renderer:

```bash
npm run render:preview
npm run render
```

External-FFmpeg compatible renderer:

```bash
npm run render:preview:compatible
npm run render:compatible
```

The UI server is bound to `127.0.0.1` and is intended for local use only.
