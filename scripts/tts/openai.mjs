export const createOpenAIProvider = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is missing. Set it in .env when using the OpenAI provider.',
    );
  }

  const voice = process.env.ASTRO_OPENAI_VOICE || 'marin';
  const model = process.env.ASTRO_OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';

  return {
    name: 'openai',
    extension: 'wav',

    async synthesize(text) {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          voice,
          input: text,
          response_format: 'wav',
          instructions:
            process.env.ASTRO_OPENAI_INSTRUCTIONS ||
            'Speak in natural Japanese. Clear, calm, intelligent presentation style. Use short pauses at punctuation. Avoid exaggerated announcer delivery.',
        }),
      });

      if (!response.ok) {
        throw new Error(
          `OpenAI TTS failed: ${response.status} ${await response.text()}`,
        );
      }

      return Buffer.from(await response.arrayBuffer());
    },
  };
};
