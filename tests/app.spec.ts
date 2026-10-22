import { expect, test, type Page } from '@playwright/test';
import { createDefaultState, createProfile } from '../src/profileModel';
import { deriveTrophies, emptyFactStat } from '../src/recall';
import { factBank, makeFact, OPERATIONS } from '../src/game';
const STORAGE_KEY = '@60-in-60/profiles/v1';
const day = new Date(2026, 9, 21, 12);
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; browserErrors.set(page, errors); page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    let state = 3478; Math.random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  });
  await page.clock.install({ time: day });
  await page.goto('/'); await expect(page.getByTestId('profile-picker')).toBeVisible();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
});
test.afterEach(async ({ page }) => { expect(browserErrors.get(page)).toEqual([]); });
async function persisted(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
}
async function seed(page: Page, value: unknown) {
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value });
  await page.reload(); await expect(page.getByTestId('profile-picker')).toBeVisible();
}
async function start(page: Page, world = 'addition', range = 5, skip = true) {
  await page.getByTestId('nav-play').click(); await page.getByTestId(`world-${world}`).click(); await page.getByTestId(`play-range-${range}`).click();
  await expect(page.getByTestId('countdown')).toBeVisible();
  if (skip) { await page.getByTestId('countdown').click({ position: { x: 10, y: 10 } }); await expect(page.getByTestId('question')).toBeVisible(); }
}
async function question(page: Page) {
  const label = (await page.getByTestId('question').getAttribute('aria-label'))!; const parsed = label.match(/^(\d+)\s*([+−×÷])\s*(\d+)$/)!;
  expect(parsed, label).toBeTruthy(); const l = Number(parsed[1]); const r = Number(parsed[3]);
  return { label, answer: parsed[2] === '+' ? l + r : parsed[2] === '−' ? l - r : parsed[2] === '×' ? l * r : l / r };
}
async function digits(page: Page, text: string) { for (const d of text) await page.getByTestId(`key-${d}`).click(); }
async function answer(page: Page, index: number, total = 20, wrong = false, firstKeyMs = 600) {
  const q = await question(page); await page.clock.runFor(firstKeyMs); const value = wrong ? '0'.repeat(String(q.answer).length) : String(q.answer);
  await digits(page, value);
  if (wrong) {
    await expect(page.getByTestId('question')).toHaveAttribute('aria-label', q.label); await expect(page.getByTestId('correct-answer')).toHaveText(`${q.label} = ${q.answer}`);
    await expect(page.getByTestId('next-card')).toBeVisible(); await page.getByTestId('next-card').click();
  }
  if (index + 1 < total) { await expect(page.getByTestId('card-count')).toHaveText(`${index + 1} / ${total}`); await expect(page.getByTestId('question')).not.toHaveAttribute('aria-label', q.label); }
  return { ...q, value };
}
async function finish(page: Page, wrongIndices: number[] = [], firstKeyMs = 600, total = 20) {
  const misses = [];
  for (let i = 0; i < total; i++) { const q = await answer(page, i, total, wrongIndices.includes(i), firstKeyMs); if (wrongIndices.includes(i)) misses.push(q); }
  await expect(page.getByTestId('results-screen')).toBeVisible(); return misses;
}
async function readyResults(page: Page) { await page.clock.runFor(1000); await expect(page.getByTestId('another-set')).toBeEnabled(); }
async function addPlayer(page: Page, name: string, year = '2016') {
  await page.getByTestId('nav-family').click(); await page.getByTestId('add-profile').click(); await page.getByTestId('profile-name-input').fill(name); await page.getByTestId('profile-birth-year').fill(year); await page.getByTestId('save-profile').click(); await expect(page.getByTestId('profile-picker')).toContainText(name);
}

test('Home matches the four real grids; worlds open directly to a full grid and ranges', async ({ page }) => {
  await expect(page.getByTestId('total-by-heart')).toHaveText('0 of 576 by heart');
  for (const op of OPERATIONS) await expect(page.getByTestId(`mini-grid-${op}`)).toBeVisible();
  await page.getByTestId('overview-addition').click(); await expect(page.getByTestId('full-grid-addition')).toBeVisible();
  await expect(page.getByTestId('full-grid-addition').getByLabel(/ = \d+, Not yet/)).toHaveCount(144);
  await expect(page.getByTestId('world-by-heart')).toContainText('0 of 144 by heart');
  await expect(page.getByTestId('start-recommended')).toBeVisible();
  await expect(page.getByRole('button', { name: /Learn|Speed|Mastery/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'All worlds', exact: true }).click();
  await page.getByTestId('world-all').click(); await expect(page.getByTestId('world-by-heart')).toContainText('0 of 576 by heart'); await expect(page.getByTestId('full-grid-addition')).toHaveCount(0);
});
test('countdown contains only the numbers and advances at one second per number', async ({ page }) => {
  await start(page, 'multiplication', 10, false);
  await expect(page.getByTestId('countdown')).toHaveText('3'); await page.clock.runFor(999); await expect(page.getByTestId('countdown-number')).toHaveText('3');
  await page.clock.runFor(1); await expect(page.getByTestId('countdown-number')).toHaveText('2'); await page.clock.runFor(1000); await expect(page.getByTestId('countdown-number')).toHaveText('1');
  await page.clock.runFor(1000); await expect(page.getByTestId('question')).toBeVisible();
  await expect(page.getByTestId('timer')).toHaveCount(0); await expect(page.getByTestId('hearts')).toHaveCount(0);
});
test('correct answers advance immediately, and a success check never erases the next partial answer', async ({ page }) => {
  await start(page, 'addition', 12);
  for (let i = 0; i < 19; i++) {
    const q = await question(page);
    if (String(q.answer).length >= 2) {
      await page.getByTestId(`key-${String(q.answer)[0]}`).click(); await expect(page.getByTestId('answer-digit-0')).toHaveText(String(q.answer)[0]);
      await page.clock.runFor(451); await expect(page.getByTestId('answer-digit-0')).toHaveText(String(q.answer)[0]);
      await page.getByTestId('key-delete').click(); await expect(page.getByTestId('answer-digit-0')).toHaveText('');
      await digits(page, String(q.answer)); await expect(page.getByTestId('card-count')).toHaveText(`${i + 1} / 20`);
      await expect.poll(async () => (await persisted(page)).profiles[0].facts).toHaveProperty(`addition:${q.label.split(' ')[0]}:${q.label.split(' ')[2]}.cleanDays`, 0);
      return;
    }
    const before = await page.evaluate(() => Date.now()); await digits(page, String(q.answer)); await expect(page.getByTestId('card-count')).toHaveText(`${i + 1} / 20`); expect(await page.evaluate(() => Date.now())).toBe(before);
  }
  throw new Error('No two-digit question');
});
test('a miss holds the typed answer and correction until Next, and all twenty misses still finish', async ({ page }) => {
  await start(page, 'division', 5); const q = await question(page); await digits(page, '0');
  await page.clock.runFor(90_000); await expect(page.getByTestId('question')).toHaveAttribute('aria-label', q.label); await expect(page.getByTestId('mistake-indicator')).toBeVisible();
  await expect(page.getByTestId('answer-digit-0')).toHaveText('0'); await expect(page.getByTestId('key-0')).toBeDisabled();
  await page.getByTestId('next-card').click();
  for (let i = 1; i < 20; i++) await answer(page, i, 20, true);
  await expect(page.getByTestId('stat-accuracy')).toHaveText('0/20'); await expect(page.getByTestId('missed-facts-review').getByTestId(/^missed-fact-/)).toHaveCount(20);
  await expect(page.getByTestId('set-win')).toHaveCount(0);
});
test('completed discovery sets persist true By heart wins; a second set finishes discovery and earns a range trophy', async ({ page }) => {
  await start(page); await finish(page); await expect(page.getByTestId('stat-accuracy')).toHaveText('20/20'); await expect(page.getByTestId('set-win')).toContainText('You already know 20 facts by heart.');
  await readyResults(page); await page.getByTestId('done-set').click(); await expect(page.getByTestId('total-by-heart')).toHaveText('20 of 576 by heart');
  await page.reload(); await expect(page.getByTestId('total-by-heart')).toHaveText('20 of 576 by heart');
  await start(page); await finish(page); await expect(page.getByTestId('set-win')).toContainText('You already know 5 facts by heart.'); await readyResults(page); await page.getByTestId('done-set').click();
  await expect(page.getByTestId('total-by-heart')).toHaveText('25 of 576 by heart'); await expect(page.getByTestId('world-trophies-addition')).toContainText('1–5');
  await page.reload(); await expect(page.getByTestId('world-trophies-addition')).toBeVisible();
  await page.getByTestId('world-addition').click(); await expect(page.getByTestId('range-5').getByLabel('Trophy earned', { exact: true })).toBeVisible();
  await expect(page.getByTestId('start-recommended').locator('..')).toContainText('Numbers 1–10');
});
test('mixed sets update the four shared grids and preserve operation balance', async ({ page }) => {
  await start(page, 'all', 5); const symbols: string[] = [];
  for (let i = 0; i < 20; i++) { const q = await question(page); symbols.push(q.label.match(/[+−×÷]/)![0]); await answer(page, i); }
  for (const symbol of ['+', '−', '×', '÷']) expect(symbols.filter(s => s === symbol)).toHaveLength(5);
  await readyResults(page); await page.getByTestId('done-set').click(); await expect(page.getByTestId('total-by-heart')).toHaveText('20 of 576 by heart');
  for (const op of OPERATIONS) await expect(page.getByTestId(`overview-${op}`)).toHaveAttribute('aria-label', new RegExp('5 of 144 by heart'));
});
test('Practice missed uses exactly the missed facts and adds no clean days', async ({ page }) => {
  await start(page); const misses = await finish(page, [0, 7, 19]); await expect(page.getByTestId('stat-accuracy')).toHaveText('17/20'); await expect(page.getByTestId('coaching-line')).toContainText('Accuracy first.');
  for (let i = 0; i < misses.length; i++) { await expect(page.getByTestId(`missed-fact-${i}`)).toContainText(`${misses[i].label} = ${misses[i].answer}`); await expect(page.getByTestId(`missed-fact-${i}`)).toContainText(`you typed ${misses[i].value}`); }
  const before = await persisted(page); await readyResults(page); await page.getByTestId('practice-missed').click(); await page.getByTestId('countdown').click({ position: { x: 10, y: 10 } });
  const practiced: string[] = [];
  for (let i = 0; i < 3; i++) { practiced.push((await question(page)).label); await answer(page, i, 3); }
  expect(practiced.sort()).toEqual(misses.map(m => m.label).sort()); await expect(page.getByTestId('practice-missed')).toHaveCount(0); await expect(page.getByTestId('set-win')).toHaveCount(0);
  await expect.poll(async () => (await persisted(page)).profiles[0].history.length).toBe(2);
  const after = await persisted(page); for (const [key, stat] of Object.entries(before.profiles[0].facts)) expect(after.profiles[0].facts[key].cleanDays).toBe((stat as { cleanDays: number }).cleanDays);
});
test('a slow perfect set has accurate coaching and no deadline, while long interruptions are excluded', async ({ page }) => {
  await start(page, 'subtraction', 5); await finish(page, [], 4000); await expect(page.getByTestId('stat-accuracy')).toHaveText('20/20'); await expect(page.getByTestId('coaching-line')).toHaveText('Every answer right. Now see if you can go a little faster.');
  await expect(page.getByTestId('stat-per-fact')).toHaveText('4.0 s'); await expect(page.getByTestId('stat-time')).toHaveText('1:20');
  await readyResults(page); await page.getByTestId('another-set').click(); await page.getByTestId('countdown').click({ position: { x: 10, y: 10 } });
  await answer(page, 0, 20, false, 20_001); for (let i = 1; i < 20; i++) await answer(page, i);
  await expect(page.getByTestId('stat-time')).toHaveText('0:11'); await expect(page.getByTestId('stat-per-fact')).toHaveText('0.6 s');
});
test('results resist rapid leftover taps and a press held across the unlock deadline', async ({ page }) => {
  await start(page); await finish(page); const button = page.getByTestId('another-set');
  await expect(button).toBeDisabled(); const b = await button.boundingBox(); expect(b).toBeTruthy(); await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2); await page.mouse.down();
  await page.clock.runFor(1000); await page.mouse.up(); await expect(page.getByTestId('results-screen')).toBeVisible(); await expect(button).toBeDisabled();
  await page.clock.runFor(449); await expect(button).toBeDisabled(); await page.clock.runFor(1); await expect(button).toBeEnabled();
  await button.click(); await expect(page.getByTestId('countdown')).toBeVisible();
});
test('birth years validate and persist, player switching isolates grids, editing preserves facts', async ({ page }) => {
  await start(page); await finish(page); await readyResults(page); await page.getByTestId('done-set').click();
  await addPlayer(page, 'Avery'); await expect(page.getByText('Age 10 · 0 facts by heart', { exact: false })).toBeVisible();
  await page.getByTestId('nav-play').click(); await expect(page.getByTestId('total-by-heart')).toHaveText('0 of 576 by heart');
  await page.getByTestId('profile-picker').click(); await page.getByRole('button', { name: 'Play as Player 1', exact: true }).click(); await expect(page.getByTestId('total-by-heart')).toHaveText('20 of 576 by heart');
  await page.getByTestId('nav-family').click(); await page.getByRole('button', { name: 'Edit Player 1', exact: true }).click(); await page.getByTestId('profile-birth-year').fill('9999'); await page.getByTestId('save-profile').click(); await expect(page.getByText(/Enter a birth year/)).toBeVisible();
  await page.getByTestId('profile-birth-year').fill('1985'); await page.getByTestId('profile-name-input').fill('Mom'); await page.getByTestId('save-profile').click();
  await page.reload(); await expect(page.getByTestId('profile-picker')).toContainText('Mom'); await expect(page.getByTestId('total-by-heart')).toHaveText('20 of 576 by heart');
});
test('legacy progress resets once while names survive; new fact progress survives subsequent reloads', async ({ page }) => {
  await seed(page, { profiles: [{ id: 'old', name: 'Alex', avatar: 'fox', color: '#B7DED1', progress: { 'addition-5': { mastery: true } }, history: [{ id: 'old-run' }] }], activeProfileId: 'old', haptics: false });
  await expect(page.getByTestId('profile-picker')).toContainText('Alex'); await expect(page.getByTestId('total-by-heart')).toHaveText('0 of 576 by heart'); await expect(page.getByTestId('world-trophies-addition')).toHaveCount(0);
  await start(page); await answer(page, 0); await page.getByRole('button', { name: 'Leave set', exact: true }).click(); await page.getByRole('button', { name: 'Leave set', exact: true }).last().click();
  await page.reload(); await expect(page.getByTestId('total-by-heart')).toHaveText('1 of 576 by heart');
});
test('all four full grids show true cell states, range gaps and persistent gold trophies after slips', async ({ page }) => {
  const state = createDefaultState(); const p = state.profiles[0];
  for (const op of OPERATIONS) for (const f of factBank(op)) p.facts[f.factKey] = { ...emptyFactStat(new Date(2026, 9, 20, 12)), cleanDays: f.a <= 5 && f.b <= 5 ? 3 : f.a <= 10 && f.b <= 10 ? 2 : 0 };
  p.earnedTrophies = deriveTrophies(p.facts); p.facts['addition:1:1'].cleanDays = 2;
  await seed(page, state); await expect(page.getByTestId('total-by-heart')).toHaveText('99 of 576 by heart');
  await page.getByTestId('world-addition').click(); await expect(page.getByTestId('grid-cell-addition-1-1')).toHaveAttribute('aria-label', '1 + 1 = 2, Almost'); await expect(page.getByTestId('grid-cell-addition-2-2')).toHaveAttribute('aria-label', '2 + 2 = 4, By heart');
  await expect(page.getByTestId('range-5').getByLabel('Trophy earned', { exact: true })).toBeVisible();
  const gap = await page.getByTestId('grid-cell-addition-2-5').evaluate(el => getComputedStyle(el).marginRight); expect(gap).toBe('4px');
});
for (const viewport of [{ width: 344, height: 740 }, { width: 768, height: 720 }]) {
  test(`foldable ${viewport.width}×${viewport.height}: grids fit and zero has safe-area clearance`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.reload(); await expect(page.getByTestId('total-by-heart')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await page.getByTestId('world-addition').click(); await expect(page.getByTestId('full-grid-addition')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await page.getByTestId('play-range-12').click(); await page.getByTestId('countdown').click({ position: { x: 10, y: 10 } }); await expect(page.getByTestId('key-0')).toBeVisible();
    await page.getByTestId('game-screen').evaluate(el => { el.parentElement!.style.paddingTop = '24px'; el.parentElement!.style.paddingBottom = '24px'; });
    const zero = await page.getByTestId('key-0').boundingBox(); const game = await page.getByTestId('game-screen').boundingBox(); const q = await page.getByTestId('question').boundingBox(); const slots = await page.getByTestId('answer-slots').boundingBox();
    expect(zero && game && q && slots).toBeTruthy(); expect(game!.y + game!.height - (zero!.y + zero!.height)).toBeGreaterThanOrEqual(31); expect(viewport.height - (zero!.y + zero!.height)).toBeGreaterThanOrEqual(55);
    expect(Math.abs(q!.x + q!.width / 2 - slots!.x - slots!.width / 2)).toBeLessThan(1); await expect(page.getByText(/digit.*submits automatically|JUST TAP/)).toHaveCount(0);
    expect(await page.getByTestId('answer-slot-0').locator('*').count()).toBe(1);
  });
}
test('desktop grids, header and Family remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.reload(); await expect(page.getByTestId('total-by-heart')).toBeVisible();
  for (const op of OPERATIONS) await expect(page.getByTestId(`overview-${op}`)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440); await addPlayer(page, 'Sam', '2000'); await expect(page.getByText('Age 26 · 0 facts by heart', { exact: false })).toBeVisible();
});
