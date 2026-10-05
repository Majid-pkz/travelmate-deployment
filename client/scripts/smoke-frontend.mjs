import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:3000';
const clientRoot = fileURLToPath(new URL('../', import.meta.url));
const viteEntry = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const api = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  response.setHeader('Content-Type', 'application/json');
  if (request.url === '/graphql') {
    response.end(JSON.stringify({
      data: body.includes('searchTrips') ? {
        searchTrips: body.includes('NoMatches') ? [] : [{
          __typename: 'Trip', _id: 'smoke-trip', title: 'Sydney road trip',
          description: 'A trip used only by the frontend smoke test.',
          departureLocation: 'Sydney', destination: 'Blue Mountains',
          startDate: '2026-10-10T00:00:00.000Z', endDate: '2026-10-12T00:00:00.000Z',
          creator: {
            __typename: 'User', _id: 'smoke-user', firstname: 'Test',
            lastname: 'Traveller', email: 'test@example.com',
          },
          travelmates: [],
        }],
      } : { __typename: 'Query' },
    }));
  } else {
    response.end(JSON.stringify({
      path: request.url,
      method: request.method,
      authorization: request.headers.authorization ?? null,
    }));
  }
});

async function waitForFrontend(child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error('Frontend exited before startup');
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      // Allow the development server to finish starting.
    }
    await delay(200);
  }
  throw new Error('Frontend did not start on port 3000');
}

async function checkFrontend(browser, mode) {
  const child = spawn(process.execPath, [viteEntry, ...(mode === 'preview' ? ['preview'] : [])], {
    cwd: clientRoot,
    stdio: 'inherit',
  });
  let context;
  try {
    await waitForFrontend(child);
    for (const path of ['/', '/login']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /id="root"/);
    }
    const graphql = await fetch(base + '/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
    assert.deepEqual(await graphql.json(), { data: { __typename: 'Query' } });
    for (const path of ['/api/health', '/images/smoke.png']) {
      const response = await fetch(base + path, {
        headers: { authorization: 'Bearer smoke-test-token' },
      });
      assert.deepEqual(await response.json(), {
        path, method: 'GET', authorization: 'Bearer smoke-test-token',
      });
    }

    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(base)
      ? route.continue() : route.abort());

    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /Welcome to Travelmate/i }).waitFor();
    const slide = page.getByRole('button', { name: 'Show slide 2' });
    await slide.focus();
    await slide.press('Enter');
    await page.waitForFunction(() =>
      document.querySelector('[aria-label="Show slide 2"]').getAttribute('aria-pressed') === 'true');
    await page.setViewportSize({ width: 390, height: 844 });
    const menu = page.getByRole('button', { name: 'Open navigation' });
    await menu.focus();
    await menu.press('Enter');
    await page.waitForFunction(() =>
      document.querySelector('.menu-icon').getAttribute('aria-expanded') === 'true');
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const path of ['/login', '/signup']) {
      await page.goto(base + path, { waitUntil: 'domcontentloaded' });
      await page.locator('input[name="email"]').waitFor();
      assert.equal(await page.locator('input[name="email"]').isVisible(), true);
    }
    await page.goto(base + '/trips?search=Sydney', { waitUntil: 'domcontentloaded' });
    await page.getByText(/Departure Location:.*Sydney/).waitFor();
    await page.getByRole('button', { name: 'Join Trip' }).click();
    await page.getByText('Log in to join this trip.').waitFor();
    await page.goto(base + '/trips?search=NoMatches', { waitUntil: 'domcontentloaded' });
    await page.getByText('No trips found. Try Again!').waitFor();
    assert.deepEqual(errors, [], 'Pages should render without JavaScript errors');
    console.log(mode + ': page rendering, keyboard controls, deep links and proxies passed');
  } finally {
    if (context) await context.close();
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    }
  }
}

await new Promise(resolve => api.listen(3001, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch();
  await checkFrontend(browser, 'development');
  await checkFrontend(browser, 'preview');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => api.close(resolve));
}
