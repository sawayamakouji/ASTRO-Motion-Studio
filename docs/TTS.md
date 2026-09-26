# Narration providers

ASTRO Motion Studio supports three narration modes.

| Provider | Cost | Internet | API key | Output |
|---|---:|---|---|---|
| VOICEVOX / VOICEVOX Nemo | Free | Not required after local setup | No | WAV |
| OpenAI TTS | Usage based | Required | Yes | WAV |
| none | Free | No | No | No generated audio |

## Default: VOICEVOX

The default provider is `voicevox`.

1. Install and start VOICEVOX Nemo or VOICEVOX.
2. In this repository, run:

```bash
npm install
npm run voices
```

If the local engine is available at `http://127.0.0.1:50021`, the available speaker/style IDs are printed.

Create a `.env` file only when you want to customize settings:

```env
ASTRO_TTS_PROVIDER=voicevox
ASTRO_VOICEVOX_URL=http://127.0.0.1:50021
ASTRO_VOICEVOX_SPEAKER_ID=1
ASTRO_VOICEVOX_SPEED=1.0
ASTRO_VOICEVOX_PITCH=0.0
ASTRO_VOICEVOX_INTONATION=1.0
ASTRO_VOICEVOX_VOLUME=1.0
```

Then generate narration:

```bash
npm run narrate
```

If no speaker ID is configured, ASTRO Motion Studio uses the first available style and prints the selection.

## OpenAI

Set:

```env
ASTRO_TTS_PROVIDER=openai
OPENAI_API_KEY=...
ASTRO_OPENAI_VOICE=marin
ASTRO_OPENAI_TTS_MODEL=gpt-4o-mini-tts
```

Then:

```bash
npm run narrate
```

Or override the provider without editing `.env`:

```bash
npm run narrate:openai
```

## No narration

Use:

```bash
npm run narrate:none
```

The Remotion preview still works with fallback scene durations.

## Switching providers

All providers use `.wav` output paths in `src/data/scenes.json`, so provider switching does not require rewriting scene data.

## Publishing

Voice licenses and attribution requirements can differ by voice/provider. Before publishing or commercial use, check the current terms for the specific voice you selected.
