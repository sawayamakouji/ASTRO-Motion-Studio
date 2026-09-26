import {spawn} from 'node:child_process';

const port = 4189;
const child = spawn(process.execPath, ['scripts/voice-ui-server.mjs'], {
  env: {...process.env, ASTRO_VOICE_UI_PORT: String(port)},
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  let response;
  for (let i = 0; i < 30; i++) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/render-status`);
      if (response.ok) break;
    } catch {}
    await sleep(200);
  }

  if (!response?.ok) {
    throw new Error(`Voice UI did not start. ${stderr}`);
  }

  const status = await response.json();
  if (status.status !== 'idle') {
    throw new Error(`Unexpected initial render status: ${status.status}`);
  }

  const html = await fetch(`http://127.0.0.1:${port}/`);
  if (!html.ok || !(await html.text()).includes('Voice & Render')) {
    throw new Error('Voice UI root page smoke check failed.');
  }

  console.log('Voice UI smoke test passed.');
} finally {
  child.kill();
}
