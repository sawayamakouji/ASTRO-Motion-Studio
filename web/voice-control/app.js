const $ = (selector) => document.querySelector(selector);

const els = {
  status: $('#engineStatus'),
  baseUrl: $('#baseUrl'),
  speaker: $('#speakerSelect'),
  speed: $('#speed'),
  speedValue: $('#speedValue'),
  pitch: $('#pitch'),
  pitchValue: $('#pitchValue'),
  intonation: $('#intonation'),
  intonationValue: $('#intonationValue'),
  volume: $('#volume'),
  volumeValue: $('#volumeValue'),
  refresh: $('#refreshButton'),
  save: $('#saveButton'),
  saveState: $('#saveState'),
  previewText: $('#previewText'),
  preview: $('#previewButton'),
  previewState: $('#previewState'),
  audio: $('#audioPlayer'),
  sceneList: $('#sceneList'),
  sceneSummary: $('#sceneSummary'),
  generateAll: $('#generateAllButton'),
  progressWrap: $('#progressWrap'),
  progressBar: $('#progressBar'),
  progressText: $('#progressText'),
  renderPreview: $('#renderPreviewButton'),
  renderFinal: $('#renderFinalButton'),
  renderProgressBar: $('#renderProgressBar'),
  renderProgressText: $('#renderProgressText'),
  renderState: $('#renderState'),
  renderOutput: $('#renderOutput'),
  renderLog: $('#renderLog'),
  videoPlayer: $('#videoPlayer'),
  videoEmpty: $('#videoEmptyState'),
  previewLink: $('#previewLink'),
  finalLink: $('#finalLink'),
};

let scenes = [];
let currentAudioUrl = null;
let renderPollTimer = null;
let lastRenderedKey = '';

const api = async (url, options = {}) => {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const payload = contentType.includes('application/json')
      ? await response.json()
      : {error: await response.text()};
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return response;
};

const selectedSpeakerId = () => {
  if (els.speaker.value !== '') {
    const direct = Number(els.speaker.value);
    if (Number.isInteger(direct)) return direct;
  }
  if (els.speaker.dataset.preferred !== '') {
    const preferred = Number(els.speaker.dataset.preferred);
    if (Number.isInteger(preferred)) return preferred;
  }
  return null;
};

const currentSettings = () => ({
  baseUrl: els.baseUrl.value.trim(),
  speakerId: selectedSpeakerId(),
  speed: Number(els.speed.value),
  pitch: Number(els.pitch.value),
  intonation: Number(els.intonation.value),
  volume: Number(els.volume.value),
});

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const postJson = async (url, body) =>
  api(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });

const setStatus = (online, message) => {
  els.status.className = `status ${online ? 'status-online' : 'status-offline'}`;
  els.status.innerHTML = `<span class="dot"></span>${message}`;
};

const syncOutputs = () => {
  els.speedValue.textContent = Number(els.speed.value).toFixed(2);
  els.pitchValue.textContent = Number(els.pitch.value).toFixed(2);
  els.intonationValue.textContent = Number(els.intonation.value).toFixed(2);
  els.volumeValue.textContent = Number(els.volume.value).toFixed(2);
};

const applyConfig = (config) => {
  els.baseUrl.value = config.baseUrl || 'http://127.0.0.1:50021';
  els.speed.value = config.speed ?? 1;
  els.pitch.value = config.pitch ?? 0;
  els.intonation.value = config.intonation ?? 1;
  els.volume.value = config.volume ?? 1;
  els.speaker.dataset.preferred = config.speakerId ?? '';
  syncOutputs();
};

const loadConfig = async () => {
  const response = await api('/api/config');
  applyConfig(await response.json());
};

const loadSpeakers = async () => {
  els.speaker.innerHTML = '<option value="">読み込み中...</option>';
  try {
    await postJson('/api/config', currentSettings());
    const response = await api('/api/speakers');
    const speakers = await response.json();

    const options = [];
    for (const speaker of speakers) {
      for (const style of speaker.styles || []) {
        options.push({
          id: style.id,
          label: `${speaker.name} — ${style.name}`,
        });
      }
    }

    els.speaker.innerHTML = options
      .map(
        ({id, label}) =>
          `<option value="${id}">${escapeHtml(label)} · ID ${id}</option>`,
      )
      .join('');

    const preferred = els.speaker.dataset.preferred;
    if (preferred && options.some((item) => String(item.id) === String(preferred))) {
      els.speaker.value = String(preferred);
    }

    if (!els.speaker.value && options[0]) els.speaker.value = String(options[0].id);
    setStatus(true, `VOICEVOX 接続中 · ${options.length} voices`);
  } catch (error) {
    els.speaker.innerHTML = '<option value="">VOICEVOX未接続</option>';
    setStatus(false, 'VOICEVOX 未接続');
    els.previewState.textContent = error.message;
    els.previewState.className = 'microcopy error';
  }
};

const loadScenes = async () => {
  const response = await api('/api/scenes');
  scenes = await response.json();
  els.sceneSummary.textContent = `${scenes.length} scenes · scenes.json から読み込み`;
  els.sceneList.innerHTML = scenes
    .map(
      (scene, index) => `
      <div class="scene-card" data-id="${escapeHtml(scene.id)}">
        <div class="scene-index">${String(index + 1).padStart(2, '0')}</div>
        <div class="scene-copy">
          <h3>${escapeHtml(scene.title)}</h3>
          <p>${escapeHtml(scene.narration)}</p>
        </div>
        <button class="scene-button" data-generate="${escapeHtml(scene.id)}">このシーンだけ生成</button>
      </div>
    `,
    )
    .join('');
};

const save = async () => {
  els.save.disabled = true;
  els.saveState.textContent = '保存中...';
  try {
    const response = await postJson('/api/config', currentSettings());
    const config = await response.json();
    applyConfig(config);
    els.speaker.dataset.preferred = config.speakerId ?? '';
    els.saveState.textContent = 'ローカル設定に保存しました';
    els.saveState.className = 'microcopy success';
  } catch (error) {
    els.saveState.textContent = error.message;
    els.saveState.className = 'microcopy error';
  } finally {
    els.save.disabled = false;
  }
};

const preview = async () => {
  els.preview.disabled = true;
  els.previewState.textContent = '音声を生成しています...';
  els.previewState.className = 'microcopy';
  try {
    const response = await postJson('/api/preview', {
      text: els.previewText.value,
      settings: currentSettings(),
    });
    const blob = await response.blob();
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = URL.createObjectURL(blob);
    els.audio.src = currentAudioUrl;
    await els.audio.play();
    els.previewState.textContent = '再生中';
    els.previewState.className = 'microcopy success';
  } catch (error) {
    els.previewState.textContent = error.message;
    els.previewState.className = 'microcopy error';
  } finally {
    els.preview.disabled = false;
  }
};

const setBusy = (busy) => {
  els.generateAll.disabled = busy;
  document.querySelectorAll('.scene-button').forEach((button) => {
    button.disabled = busy;
  });
};

const generateOne = async (id, button) => {
  setBusy(true);
  const original = button.textContent;
  button.textContent = '生成中...';
  try {
    await postJson('/api/generate-scene', {id, settings: currentSettings()});
    button.textContent = '生成しました ✓';
    button.classList.add('success');
  } catch (error) {
    button.textContent = 'エラー';
    button.title = error.message;
    button.classList.add('error');
  } finally {
    setBusy(false);
    setTimeout(() => {
      button.textContent = original;
      button.classList.remove('success', 'error');
    }, 2200);
  }
};

const showVideo = (url) => {
  if (!url) return;
  els.videoPlayer.src = `${url}?v=${Date.now()}`;
  els.videoPlayer.classList.remove('hidden');
  els.videoEmpty.classList.add('hidden');
  els.videoPlayer.load();
};

const setRenderButtons = (running) => {
  els.renderPreview.disabled = running;
  els.renderFinal.disabled = running;
};

const renderLabel = (status) => {
  if (status === 'running') return 'レンダリング中';
  if (status === 'done') return '完了';
  if (status === 'error') return 'エラー';
  return '待機中';
};

const updateRenderUi = (state) => {
  const running = state.status === 'running';
  setRenderButtons(running);

  els.renderState.textContent = renderLabel(state.status);
  els.renderState.className =
    state.status === 'running'
      ? 'rendering'
      : state.status === 'error'
        ? 'error'
        : state.status === 'done'
          ? 'success'
          : '';

  els.renderProgressBar.style.width = `${Math.max(0, Math.min(100, state.progress || 0))}%`;
  els.renderProgressText.textContent =
    state.status === 'running'
      ? `${state.kind === 'preview' ? '軽量プレビュー' : '最終MP4'}を生成中 · ${state.progress || 0}%`
      : state.status === 'done'
        ? 'レンダリング完了 ✓'
        : state.status === 'error'
          ? state.error || 'レンダリングに失敗しました'
          : 'レンダリング待機中';

  els.renderProgressText.className =
    state.status === 'error'
      ? 'error'
      : state.status === 'done'
        ? 'success'
        : '';

  els.renderOutput.textContent =
    state.kind === 'preview'
      ? '軽量プレビュー · 960×540'
      : state.kind === 'final'
        ? '最終MP4 · 1920×1080'
        : '—';

  els.renderLog.textContent = state.latestLog || state.error || '—';

  els.previewLink.classList.toggle('disabled', !state.previewReady);
  els.finalLink.classList.toggle('disabled', !state.finalReady);

  if (state.status === 'done' && state.outputUrl && state.finishedAt) {
    const key = `${state.outputUrl}:${state.finishedAt}`;
    if (key !== lastRenderedKey) {
      lastRenderedKey = key;
      showVideo(state.outputUrl);
    }
  } else if (
    state.status === 'idle' &&
    els.videoPlayer.classList.contains('hidden')
  ) {
    if (state.finalReady) showVideo('/media/final.mp4');
    else if (state.previewReady) showVideo('/media/preview.mp4');
  }
};

const pollRenderStatus = async () => {
  try {
    const response = await api('/api/render-status');
    const state = await response.json();
    updateRenderUi(state);

    if (state.status === 'running') {
      clearTimeout(renderPollTimer);
      renderPollTimer = setTimeout(pollRenderStatus, 900);
    }
  } catch (error) {
    els.renderState.textContent = '状態取得エラー';
    els.renderState.className = 'error';
    els.renderLog.textContent = error.message;
    setRenderButtons(false);
  }
};

const startRender = async (kind) => {
  clearTimeout(renderPollTimer);
  setRenderButtons(true);
  els.renderState.textContent = '開始中...';
  els.renderState.className = 'rendering';
  els.renderProgressBar.style.width = '2%';
  els.renderProgressText.textContent =
    kind === 'preview'
      ? '軽量プレビューを開始しています...'
      : '最終MP4を開始しています...';

  try {
    const response = await postJson(
      kind === 'preview' ? '/api/render-preview' : '/api/render-final',
      {},
    );
    updateRenderUi(await response.json());
    renderPollTimer = setTimeout(pollRenderStatus, 700);
  } catch (error) {
    setRenderButtons(false);
    els.renderState.textContent = 'エラー';
    els.renderState.className = 'error';
    els.renderProgressText.textContent = error.message;
    els.renderProgressText.className = 'error';
    els.renderLog.textContent = error.message;
  }
};

const generateAll = async () => {
  setBusy(true);
  els.progressWrap.classList.remove('hidden');
  els.progressBar.style.width = '8%';
  els.progressText.textContent = `${scenes.length}シーンを生成中...`;

  try {
    await postJson('/api/config', currentSettings());
    els.progressBar.style.width = '22%';
    const response = await postJson('/api/generate-all', {
      settings: currentSettings(),
    });
    const result = await response.json();
    els.progressBar.style.width = '100%';
    els.progressText.textContent = `${result.generated.length}シーン生成完了 ✓`;
    els.progressText.className = 'success';
  } catch (error) {
    els.progressBar.style.width = '100%';
    els.progressText.textContent = error.message;
    els.progressText.className = 'error';
  } finally {
    setBusy(false);
  }
};

for (const input of [els.speed, els.pitch, els.intonation, els.volume]) {
  input.addEventListener('input', syncOutputs);
}

els.refresh.addEventListener('click', loadSpeakers);
els.save.addEventListener('click', save);
els.preview.addEventListener('click', preview);
els.generateAll.addEventListener('click', generateAll);
els.renderPreview.addEventListener('click', () => startRender('preview'));
els.renderFinal.addEventListener('click', () => startRender('final'));

els.sceneList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-generate]');
  if (!button) return;
  generateOne(button.dataset.generate, button);
});

(async () => {
  try {
    await loadConfig();
    await Promise.all([loadScenes(), loadSpeakers(), pollRenderStatus()]);
  } catch (error) {
    setStatus(false, '初期化エラー');
    els.previewState.textContent = error.message;
    els.previewState.className = 'microcopy error';
  }
})();
