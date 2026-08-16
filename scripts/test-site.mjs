import { spawn } from 'node:child_process';
import { get } from 'node:http';

const origin = process.env.SITE_ORIGIN || 'http://127.0.0.1:8032';
const requestedCases = process.argv.slice(2);
const preview = spawn(process.execPath, ['scripts/preview.mjs'], {
  env: { ...process.env, PORT: '8032' },
  stdio: ['ignore', 'pipe', 'inherit'],
});

function waitForPreview(attempts = 40) {
  return new Promise((resolve, reject) => {
    const check = remaining => {
      const request = get(`${origin}/`, response => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) resolve();
        else retry(remaining);
      });
      request.on('error', () => retry(remaining));
    };
    const retry = remaining => {
      if (remaining <= 0) {
        reject(new Error('プレビューサーバーを起動できませんでした。'));
        return;
      }
      setTimeout(() => check(remaining - 1), 150);
    };
    check(attempts);
  });
}

async function runCase(name) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/quality-check.mjs', ...(name ? [name] : [])], {
      env: { ...process.env, SITE_ORIGIN: origin, PUBLIC_ROUTES: '1' },
      stdio: 'inherit',
    });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`表示検査に失敗しました${name ? `: ${name}` : ''}`)));
  });
}

try {
  await waitForPreview();
  if (requestedCases.length) {
    for (const name of requestedCases) await runCase(name);
  } else {
    await runCase();
  }
} finally {
  preview.kill('SIGTERM');
  await new Promise(resolve => {
    if (preview.exitCode !== null) {
      resolve();
      return;
    }
    preview.once('exit', resolve);
    setTimeout(() => {
      preview.kill('SIGKILL');
      resolve();
    }, 1000).unref();
  });
}
