const readNumber = (value, fallback, label) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a number. Received: ${value}`);
  }
  return parsed;
};

const envNumber = (name, fallback) =>
  readNumber(process.env[name], fallback, name);

const request = async (url, init = {}) => {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new Error(
      `VOICEVOX に接続できません。VOICEVOX Nemo / VOICEVOX を起動し、${url.origin} が利用できることを確認してください。\n${error.message}`,
    );
  }
};

export const listVoicevoxSpeakers = async (
  baseUrlValue = process.env.ASTRO_VOICEVOX_URL || 'http://127.0.0.1:50021',
) => {
  const baseUrl = new URL(baseUrlValue);
  const response = await request(new URL('/speakers', baseUrl));
  if (!response.ok) {
    throw new Error(
      `VOICEVOX speakers API failed: ${response.status} ${await response.text()}`,
    );
  }
  return response.json();
};

export const createVoicevoxProvider = (options = {}) => {
  const baseUrl = new URL(
    options.baseUrl ||
      process.env.ASTRO_VOICEVOX_URL ||
      'http://127.0.0.1:50021',
  );

  const resolveSpeakerId = async () => {
    const configured =
      options.speakerId ?? process.env.ASTRO_VOICEVOX_SPEAKER_ID;

    if (configured !== undefined && configured !== '') {
      const id = Number(configured);
      if (!Number.isInteger(id)) {
        throw new Error('VOICEVOX speaker id must be an integer.');
      }
      return id;
    }

    const speakers = await listVoicevoxSpeakers(baseUrl.toString());
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
      query.speedScale = readNumber(
        options.speed,
        envNumber('ASTRO_VOICEVOX_SPEED', query.speedScale ?? 1),
        'speed',
      );
      query.pitchScale = readNumber(
        options.pitch,
        envNumber('ASTRO_VOICEVOX_PITCH', query.pitchScale ?? 0),
        'pitch',
      );
      query.intonationScale = readNumber(
        options.intonation,
        envNumber('ASTRO_VOICEVOX_INTONATION', query.intonationScale ?? 1),
        'intonation',
      );
      query.volumeScale = readNumber(
        options.volume,
        envNumber('ASTRO_VOICEVOX_VOLUME', query.volumeScale ?? 1),
        'volume',
      );
      query.prePhonemeLength = readNumber(
        options.prePhoneme,
        envNumber('ASTRO_VOICEVOX_PRE_PHONEME', query.prePhonemeLength ?? 0.1),
        'prePhoneme',
      );
      query.postPhonemeLength = readNumber(
        options.postPhoneme,
        envNumber(
          'ASTRO_VOICEVOX_POST_PHONEME',
          query.postPhonemeLength ?? 0.1,
        ),
        'postPhoneme',
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
