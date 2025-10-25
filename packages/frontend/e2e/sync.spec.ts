import { test, expect, type Page } from '@playwright/test';

// Speed up the sync daemon by forcing short intervals before app scripts run
const initSpeedupScript = () => {
  const originalSetInterval = window.setInterval.bind(window);
  window.setInterval = ((handler: TimerHandler, _timeout?: number | undefined, ...args: any[]) => {
    const ms = 200;
    return originalSetInterval(handler, ms, ...args);
  }) as typeof window.setInterval;
};

// Apply the speed-up for each page before any app script executes
test.beforeEach(async ({ page }) => {
  await page.addInitScript(initSpeedupScript);
});

async function gotoSettings(page: Page) {
  await page.goto('/settings');
  await expect(page.locator('#settings-sync')).toBeVisible();
}

async function getLocalStorage(page: Page, key: string) {
  return await page.evaluate((k) => window.localStorage.getItem(k), key);
}

test('sync: join existing key, server→client and client→server propagation, multi-client join', async ({ page, request, browser }) => {
  // Create a fresh sync key on server with no initial data
  const genResp = await request.post('http://localhost:3000/sync/generate', {
    headers: { 'content-type': 'application/json' },
    data: { data: {}, version: {} },
  });
  const { syncKey } = await genResp.json();
  expect(syncKey).toBeTruthy();

  // Join existing key via UI
  await gotoSettings(page);
  await page.getByPlaceholder('Enter existing Sync Key').fill(syncKey);
  await page.getByRole('button', { name: 'Use Key' }).click();
  await expect.poll(async () => await getLocalStorage(page, 'sync-enabled')).toBe('true');
  await expect.poll(async () => await getLocalStorage(page, 'sync-key')).toBe(syncKey);

  // Server → Client propagation
  const serverInjectedKey = `server-key-${Date.now()}`;
  const serverInjectedValue = 'server-value-1';
  await request.post('http://localhost:3000/sync/upload', {
    headers: { 'content-type': 'application/json' },
    data: {
      syncKey,
      changes: {
        [serverInjectedKey]: { value: serverInjectedValue, updatedAt: Date.now() },
      },
    },
  });
  await expect.poll(async () => await getLocalStorage(page, serverInjectedKey)).toBe(serverInjectedValue);

  // Client → Server propagation by changing a real app setting (theme)
  // Switch to Dark theme
  await page.getByLabel('Dark').click();
  await expect.poll(async () => await getLocalStorage(page, 'theme')).toBe('dark');

  // Verify server received the change
  await expect.poll(async () => {
    const resp = await request.post('http://localhost:3000/sync/diff', {
      headers: { 'content-type': 'application/json' },
      data: { syncKey, version: {} },
    });
    const json = await resp.json();
    return json?.updates?.theme?.value ?? null;
  }).toBe('dark');

  // Open a second client and join the same key
  const context2 = await browser.newContext();
  await context2.addInitScript(initSpeedupScript);
  const page2 = await context2.newPage();
  await page2.goto('/settings');
  await page2.getByPlaceholder('Enter existing Sync Key').fill(syncKey);
  await page2.getByRole('button', { name: 'Use Key' }).click();
  await expect.poll(async () => await getLocalStorage(page2, 'sync-enabled')).toBe('true');

  // Existing server value should be present on client 2
  await expect.poll(async () => await getLocalStorage(page2, serverInjectedKey)).toBe(serverInjectedValue);

  // Change theme on client 2 back to Light and expect client 1 to update
  await page2.getByLabel('Light').click();
  await expect.poll(async () => await getLocalStorage(page2, 'theme')).toBe('light');
  await expect.poll(async () => await getLocalStorage(page, 'theme')).toBe('light');
});
