import { expect, test, type Page } from '@playwright/test';

const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  // Reproducible question order without changing application code or saved data.
  await page.addInitScript(() => {
    let state = 3478;
    Math.random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('profile-picker')).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

async function selectMode(page: Page, world: string, range: number, mode: string) {
  await page.getByTestId('nav-play').click();
  await page.getByTestId(`world-${world}`).click();
  await page.getByTestId(`level-${range}`).click();
  await page.getByTestId(`start-${mode}`).click();
}

async function readQuestion(page: Page) {
  const label = await page.getByTestId('question').getAttribute('aria-label');
  const parsed = label?.match(/^(\d+)\s*([+−×÷])\s*(\d+)$/);
  expect(parsed, `Unable to read the displayed question: ${label}`).toBeTruthy();
  const left = Number(parsed![1]);
  const right = Number(parsed![3]);
  const operation = parsed![2];
  const answer = operation === '+' ? left + right
    : operation === '−' ? left - right
    : operation === '×' ? left * right : left / right;
  return { label: label!, answer };
}

async function enterAnswer(page: Page, index: number, total: number, incorrect = false) {
  const { label, answer } = await readQuestion(page);
  const value = incorrect
    ? (answer === 0 ? '1' : '0'.repeat(String(answer).length))
    : String(answer);
  for (const digit of value) await page.getByTestId(`key-${digit}`).click();
  if (index + 1 < total) {
    await expect(page.getByTestId('card-count')).toHaveText(`${index + 1} / ${total}`);
    await expect(page.getByTestId('question')).not.toHaveAttribute('aria-label', label);
  }
}

async function completeLearn(page: Page) {
  await expect(page.getByTestId('card-count')).toHaveText('0 / 20');
  for (let index = 0; index < 20; index++) await enterAnswer(page, index, 20);
  await expect(page.getByText('Look at you grow.', { exact: true })).toBeVisible();
  await expect(page.getByText('20/20', { exact: true })).toBeVisible();
}

async function leaveRun(page: Page) {
  await page.getByRole('button', { name: 'Leave session', exact: true }).click();
  await page.getByRole('button', { name: 'Leave session', exact: true }).last().click();
  await expect(page.getByTestId('start-learn')).toBeVisible();
}

async function addPlayer(page: Page, name: string) {
  await page.getByTestId('nav-family').click();
  await page.getByTestId('add-profile').click();
  await page.getByTestId('profile-name-input').fill(name);
  await page.getByTestId('save-profile').click();
  await expect(page.getByTestId('profile-picker')).toContainText(name);
}

test('mobile worlds, automatic answers, incomplete backspace, and a fresh replay', async ({ page }) => {
  for (const world of ['addition', 'subtraction', 'add-subtract', 'multiplication', 'division', 'multiply-divide', 'all']) {
    await expect(page.getByTestId(`world-${world}`)).toBeAttached();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await selectMode(page, 'addition', 12, 'learn');
  await expect(page.getByTestId('timer')).toHaveText('∞');
  await expect(page.getByRole('button', { name: /^enter$/i })).toHaveCount(0);
  let index = 0;
  while (String((await readQuestion(page)).answer).length < 2 && index < 19) {
    await enterAnswer(page, index++, 20);
  }
  const question = await readQuestion(page);
  expect(String(question.answer)).toHaveLength(2);
  const firstDigit = String(question.answer)[0];
  await page.getByTestId(`key-${firstDigit}`).click();
  await expect(page.getByTestId('answer-digit-0')).toHaveText(firstDigit);
  await expect(page.getByTestId('card-count')).toHaveText(`${index} / 20`);
  await page.getByTestId('key-delete').click();
  await expect(page.getByTestId('answer-digit-0')).toHaveText('');
  await expect(page.getByTestId('question')).toHaveAttribute('aria-label', question.label);
  for (; index < 20; index++) await enterAnswer(page, index, 20);
  await expect(page.getByText('20/20', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Another little win?', exact: true }).click();
  await expect(page.getByTestId('card-count')).toHaveText('0 / 20');
  await expect(page.getByTestId('hearts').locator('svg[fill="#F37858"]')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const digit of ['3', '6', '9']) {
    const box = await page.getByTestId(`key-${digit}`).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await leaveRun(page);
});

test('two mistakes continue and the third ends the session with a correction', async ({ page }) => {
  await selectMode(page, 'division', 5, 'learn');
  for (let index = 0; index < 2; index++) {
    await enterAnswer(page, index, 20, true);
    await expect(page.getByTestId('hearts').locator('svg[fill="#F37858"]')).toHaveCount(2 - index);
  }
  const finalQuestion = await readQuestion(page);
  await page.getByTestId('key-0').click();
  await expect(page.getByText('Keep your chin up.', { exact: true })).toBeVisible();
  await expect(page.getByText('0/20', { exact: true })).toBeVisible();
  await expect(page.getByText('A fact to take with you', { exact: true })).toBeVisible();
  await expect(page.getByText(`${finalQuestion.label} = ${finalQuestion.answer}`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByTestId('card-count')).toHaveText('0 / 20');
  await expect(page.getByTestId('hearts').locator('svg[fill="#F37858"]')).toHaveCount(3);
});

test('a real 60-card run with two misses passes and keeps mastery after reload', async ({ page }) => {
  await selectMode(page, 'addition', 5, 'mastery');
  await expect(page.getByTestId('card-count')).toHaveText('0 / 60');
  for (let index = 0; index < 60; index++) await enterAnswer(page, index, 60, index < 2);
  await expect(page.getByText('MASTERY UNLOCKED', { exact: true })).toBeVisible();
  await expect(page.getByText('58/60', { exact: true })).toBeVisible();
  await expect(page.getByText('97%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to worlds', exact: true }).click();
  await page.getByTestId('nav-progress').click();
  await expect(page.getByText('Mastery · Completed', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('profile-picker')).toBeVisible();
  await page.getByTestId('nav-progress').click();
  await expect(page.getByText('Mastery · Completed', { exact: true })).toBeVisible();
  await expect(page.getByText('58/60', { exact: true })).toBeVisible();
});

test('timed modes expire at their deadline while Learn stays untimed', async ({ page }) => {
  await page.clock.install();
  await selectMode(page, 'addition', 10, 'mastery');
  // runFor lets all three countdown callbacks render; fastForward then models
  // a phone resuming after a long gap, with only one interval callback needed.
  for (let step = 0; step < 3; step++) await page.clock.runFor(800);
  await expect(page.getByTestId('card-count')).toHaveText('0 / 60');
  await page.clock.fastForward(59_900);
  await expect(page.getByTestId('timer')).toHaveText('01');
  await page.clock.fastForward(100);
  await expect(page.getByText(/Time's up, Player 1/)).toBeVisible();
  await expect(page.getByText('0/60', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choose a mode', exact: true }).click();
  await page.getByTestId('start-speed').click();
  for (let step = 0; step < 3; step++) await page.clock.runFor(800);
  await expect(page.getByTestId('card-count')).toHaveText('0 / 30');
  await page.clock.fastForward(45_000);
  await expect(page.getByText(/Time's up, Player 1/)).toBeVisible();
  await expect(page.getByText('0/30', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choose a mode', exact: true }).click();
  await page.getByTestId('start-learn').click();
  await page.clock.fastForward(3_600_000);
  await expect(page.getByTestId('card-count')).toHaveText('0 / 20');
  await expect(page.getByTestId('timer')).toHaveText('∞');
});

test('family players persist and switching keeps each player’s progress separate', async ({ page }) => {
  await addPlayer(page, 'Avery');
  await selectMode(page, 'addition', 5, 'learn');
  await completeLearn(page);
  await page.getByRole('button', { name: 'Back to worlds', exact: true }).click();
  await addPlayer(page, 'Milo');
  await expect(page.getByText('3 curious minds and counting', { exact: true })).toBeVisible();
  await page.getByTestId('nav-progress').click();
  await expect(page.getByText('Your story starts with one card.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('profile-picker')).toContainText('Milo');
  await page.getByTestId('profile-picker').click();
  await page.getByRole('button', { name: 'Play as Avery', exact: true }).click();
  await expect(page.getByTestId('profile-picker')).toContainText('Avery');
  await page.getByTestId('nav-progress').click();
  await expect(page.getByText('Learn · Completed', { exact: true })).toBeVisible();
  await expect(page.getByText('20/20', { exact: true })).toBeVisible();
  await page.getByTestId('profile-picker').click();
  await page.getByRole('button', { name: 'Play as Milo', exact: true }).click();
  await expect(page.getByText('Your story starts with one card.', { exact: true })).toBeVisible();
  await expect(page.getByText('Learn · Completed', { exact: true })).toHaveCount(0);
});
