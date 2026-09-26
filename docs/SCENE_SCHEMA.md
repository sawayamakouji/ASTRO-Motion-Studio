# Scene schema

ASTRO Motion Studio uses `src/data/scenes.json` as the single source of truth.

## Required fields

- `id`: unique scene id.
- `type`: `hero`, `metric`, `compare`, `process`, or `summary`.
- `title`: primary on-screen message.
- `narration`: spoken Japanese script.
- `durationSeconds`: fallback duration before narration audio exists.

## Narration

Set `audioFile` to a path below `public/`, for example:

```json
{
  "audioFile": "audio/03-compare.mp3"
}
```

Run `npm run narrate`. After the MP3 exists, Remotion measures the real audio duration and extends the scene automatically when needed.

## Layout-specific fields

### metric

```json
{
  "type": "metric",
  "metric": {
    "value": "+12.4%",
    "label": "売上伸長",
    "delta": "前年差 +3.1pt"
  }
}
```

### compare

Use `left` and `right`, each with `label`, `value`, and optional `note`.

### process

Use a `steps` array. Four steps is the recommended default.

### summary

Use a `bullets` array. Three bullets is the recommended default.

## Design rule

One scene should communicate one idea. Prefer short on-screen copy and put detail in the narration.
