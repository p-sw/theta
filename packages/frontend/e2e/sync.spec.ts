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

test('sync: generate key, join existing key, and verify data synced', async ({ page, request, browser }) => {
  // Seed client data BEFORE app scripts run so the app wrapper sees them
  const seedKey1 = `theta-sync-seed-1-${Date.now()}`;
  const seedKey2 = `theta-sync-seed-2-${Date.now()}`;
  const seedVal1 = 'value-1';
  const seedVal2 = 'value-2';
  await page.addInitScript(({ k1, v1, k2, v2 }) => {
    window.localStorage.setItem(k1, v1);
    window.localStorage.setItem(k2, v2);
  }, { k1: seedKey1, v1: seedVal1, k2: seedKey2, v2: seedVal2 });

  // 1) Create a new sync key via UI (Generate New Key)
  await gotoSettings(page);
  await page.getByRole('button', { name: 'Generate New Key' }).click();
  await expect.poll(async () => await getLocalStorage(page, 'sync-enabled')).toBe('true');
  const syncKey = await getLocalStorage(page, 'sync-key');
  expect(syncKey).toBeTruthy();

  // Verify server knows about seeded data (initial upload happened)
  await expect.poll(async () => {
    const resp = await request.post('http://localhost:3000/sync/diff', {
      headers: { 'content-type': 'application/json' },
      data: { syncKey, version: {} },
    });
    const json = await resp.json();
    const updates = json?.updates ?? {};
    return updates?.[seedKey1]?.value === seedVal1 && updates?.[seedKey2]?.value === seedVal2 ? 'ok' : null;
  }).toBe('ok');

  // 2) Join existing sync key on a second client
  const context2 = await browser.newContext();
  await context2.addInitScript(initSpeedupScript);
  const page2 = await context2.newPage();
  await page2.goto('/settings');
  await page2.getByPlaceholder('Enter existing Sync Key').fill(syncKey!);
  await page2.getByRole('button', { name: 'Use Key' }).click();
  await expect.poll(async () => await getLocalStorage(page2, 'sync-enabled')).toBe('true');
  await expect.poll(async () => await getLocalStorage(page2, 'sync-key')).toBe(syncKey);

  // 3) After joining, verify all seeded data synced into client 2 localStorage
  await expect.poll(async () => await getLocalStorage(page2, seedKey1)).toBe(seedVal1);
  await expect.poll(async () => await getLocalStorage(page2, seedKey2)).toBe(seedVal2);
});
