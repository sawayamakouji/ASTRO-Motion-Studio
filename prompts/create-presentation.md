# Prompt: create an ASTRO Motion Studio presentation

Use this prompt with ChatGPT or Codex when converting a document or analysis into `src/data/scenes.json`.

---

You are creating a narrated slide video for ASTRO Motion Studio.

Convert the supplied material into 5-10 scenes.

Rules:
1. One scene = one main idea.
2. On-screen text must be concise. Put explanation in narration.
3. Use the available scene types: hero, metric, compare, process, summary.
4. Narration must sound natural when spoken in Japanese, not like written prose.
5. Do not invent factual numbers. Label illustrative numbers as demo/example values.
6. Each scene needs:
   - id
   - type
   - kicker
   - title
   - narration
   - audioFile: audio/<id>.mp3
   - durationSeconds
   - accent
7. durationSeconds is only a fallback. Estimate generously enough for narration.
8. End with a summary or next-action scene.
9. Return valid JSON only, matching the schema in docs/SCENE_SCHEMA.md.

The final artifact must be suitable for a 1920x1080 narrated explainer video.
