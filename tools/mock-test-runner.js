#!/usr/bin/env node

const { spawn } = require('child_process');
const { startMockServer, DEFAULT_PORT } = require('./openapi-mock-server');

const MOCK_PORT = process.env.MOCK_PORT ? Number(process.env.MOCK_PORT) : DEFAULT_PORT;
const MOCK_BASE_URL = `http://localhost:${MOCK_PORT}`;

async function waitForHealth(url, attempts = 40, delayMs = 250) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // swallow and retry
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error(`Timed out waiting for mock server health check at ${url}`);
}

async function run() {
  const server = startMockServer({ port: MOCK_PORT });
  let shuttingDown = false;

  const shutdown = (code = 0) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    server.close(() => {
      process.exit(code);
    });
  };

  process.on('SIGINT', () => shutdown(130));
  process.on('SIGTERM', () => shutdown(143));

  try {
    await waitForHealth(`${MOCK_BASE_URL}/__health`);
  } catch (error) {
    console.error('[mock-test-runner] Mock server failed to start:', error.message);
    shutdown(1);
    return;
  }

  const testEnv = {
    ...process.env,
    RENTEASE_API_URL: MOCK_BASE_URL
  };

  const cli = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['ng', 'test', '--watch=false'];
  const testProcess = spawn(cli, args, { stdio: 'inherit', env: testEnv });

  testProcess.on('exit', code => {
    shutdown(code ?? 0);
  });

  testProcess.on('error', error => {
    console.error('[mock-test-runner] Failed to launch Angular tests:', error.message);
    shutdown(1);
  });
}

run();
