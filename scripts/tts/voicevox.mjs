const numberEnv = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number. Received: ${raw}`);
  }
  return value;
};

const request = async (url, init = {}) => {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new Error(
      `VOICEVOX に接続できません。VOICEVOX Nemo / VOICEVOX を起動し、${url.origin} が利用できることを確認してください。\n${error.message}`,
    );
  }
};

export const createVoicevoxProvider = () => {
  const baseUrl = new URL(
    process.env.ASTRO_VOICEVOX_URL || 'http://127.0.0.1:50021',
  );

  const resolveSpeakerId = async () => {
    const configured = process.env.ASTRO_VOICEVOX_SPEAKER_ID;
    if (configured !== undefined && configured !== '') {
      const id = Number(configured);
      if (!Number.isInteger(id)) {
        throw new Error('ASTRO_VOICEVOX_SPEAKER_ID must be an integer.');
      }
      return id;
    }

    const url = new URL('/speakers', baseUrl);
    const response = await request(url);
    if (!response.ok) {
      throw new Error(
        `VOICEVOX speakers API failed: ${response.status} ${await response.text()}`,
      );
    }

    const speakers = await response.json();
    const firstStyle = speakers?.[0]?.styles?.[0];
    if (!firstStyle) {
      throw new Error('VOICEVOX に利用可能な話者が見つかりません。');
    }

    console.log(
      `VOICEVOX speaker id was not specified. Using: ${speakers[0].name} / ${firstStyle.name} (id=${firstStyle.id})`,
    );
    return firstStyle.id;
  };

  let speakerIdPromise;

  return {
    name: 'voicevox',
    extension: 'wav',

    async synthesize(text) {
      speakerIdPromise ??= resolveSpeakerId();
      const speaker = await speakerIdPromise;

      const queryUrl = new URL('/audio_query', baseUrl);
      queryUrl.searchParams.set('text', text);
      queryUrl.searchParams.set('speaker', String(speaker));

      const queryResponse = await request(queryUrl, {method: 'POST'});
      if (!queryResponse.ok) {
        throw new Error(
          `VOICEVOX audio_query failed: ${queryResponse.status} ${await queryResponse.text()}`,
        );
      }

      const query = await queryResponse.json();
      query.speedScale = numberEnv('ASTRO_VOICEVOX_SPEED', query.speedScale ?? 1);
      query.pitchScale = numberEnv('ASTRO_VOICEVOX_PITCH', query.pitchScale ?? 0);
      query.intonationScale = numberEnv(
        'ASTRO_VOICEVOX_INTONATION',
        query.intonationScale ?? 1,
      );
      query.volumeScale = numberEnv(
        'ASTRO_VOICEVOX_VOLUME',
        query.volumeScale ?? 1,
      );
      query.prePhonemeLength = numberEnv(
        'ASTRO_VOICEVOX_PRE_PHONEME',
        query.prePhonemeLength ?? 0.1,
      );
      query.postPhonemeLength = numberEnv(
        'ASTRO_VOICEVOX_POST_PHONEME',
        query.postPhonemeLength ?? 0.1,
      );

      const synthesisUrl = new URL('/synthesis', baseUrl);
      synthesisUrl.searchParams.set('speaker', String(speaker));
      synthesisUrl.searchParams.set('enable_interrogative_upspeak', 'true');

      const synthesisResponse = await request(synthesisUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(query),
      });

      if (!synthesisResponse.ok) {
        throw new Error(
          `VOICEVOX synthesis failed: ${synthesisResponse.status} ${await synthesisResponse.text()}`,
        );
      }

      return Buffer.from(await synthesisResponse.arrayBuffer());
    },
  };
};
