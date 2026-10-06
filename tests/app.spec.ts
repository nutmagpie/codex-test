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
  return { label, answer, value };
}

async function enterDigits(page: Page, value: string) {
  for (const digit of value) await page.getByTestId(`key-${digit}`).click();
}

async function startFrozenTimedRun(page: Page, mode: 'speed' | 'mastery') {
  await page.clock.install();
  await selectMode(page, 'addition', 12, mode);
  for (let step = 0; step < 3; step++) await page.clock.runFor(800);
  await expect(page.getByTestId('question')).toBeVisible();
  // Once the countdown has rendered, stop all browser timers. Correct answers
  // must remain playable without running even one delayed callback.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1_000)));
}

async function answerWithoutAdvancingTime(page: Page, index: number, total: number) {
  const question = await readQuestion(page);
  const now = await page.evaluate(() => Date.now());
  await enterDigits(page, String(question.answer));
  await expect(page.getByTestId('card-count')).toHaveText(`${index + 1} / ${total}`);
  await expect(page.getByTestId('question')).not.toHaveAttribute('aria-label', question.label);
  await expect(page.getByTestId('answer-digit-0')).toHaveText('');
  expect(await page.evaluate(() => Date.now())).toBe(now);
}

async function findTwoDigitQuestion(page: Page, index: number, total: number) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const question = await readQuestion(page);
    if (String(question.answer).length === 2) return { question, index };
    await answerWithoutAdvancingTime(page, index++, total);
  }
  throw new Error('The reproducible addition deck did not present a two-digit answer');
}

async function completeLearn(page: Page) {
  await expect(page.getByTestId('card-count')).toHaveText('0 / 20');
  for (let index = 0; index < 20; index++) await enterAnswer(page, index, 20);
  await expect(page.getByText('Look at you grow.', { exact: true })).toBeVisible();
  await expect(page.getByText('20/20', { exact: true })).toBeVisible();
  await expect(page.getByTestId('missed-facts-review')).toHaveCount(0);
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

async function clickResultAction(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  await expect(button).toBeEnabled();
  await button.click();
}

async function expectMissedFacts(page: Page, facts: Array<{ label: string; answer: number; value: string }>) {
  const review = page.getByTestId('missed-facts-review');
  await expect(review).toBeVisible();
  await expect(review.locator('[data-testid^="missed-fact-"]')).toHaveCount(facts.length);
  for (let index = 0; index < facts.length; index++) {
    const fact = facts[index];
    const row = page.getByTestId(`missed-fact-${index}`);
    await expect(row).toContainText(`${fact.label} = ${fact.answer}`);
    await expect(row).toContainText(`You answered ${Number(fact.value)}`);
  }
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
  await clickResultAction(page, 'Another little win?');
  await expect(page.getByTestId('card-count')).toHaveText('0 / 20');
  await expect(page.getByTestId('hearts').locator('svg[fill="#F37858"]')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const digit of ['3', '6', '9']) {
    const box = await page.getByTestId(`key-${digit}`).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await leaveRun(page);
});

test('two mistakes continue and the third ends the session with all missed facts for review', async ({ page }) => {
  await selectMode(page, 'division', 5, 'learn');
  const misses = [];
  for (let index = 0; index < 2; index++) {
    misses.push(await enterAnswer(page, index, 20, true));
    await expect(page.getByTestId('hearts').locator('svg[fill="#F37858"]')).toHaveCount(2 - index);
  }
  const finalQuestion = await readQuestion(page);
  await page.getByTestId('key-0').click();
  misses.push({ ...finalQuestion, value: '0' });
  await expect(page.getByText('Keep your chin up.', { exact: true })).toBeVisible();
  await expect(page.getByText('0/20', { exact: true })).toBeVisible();
  await expectMissedFacts(page, misses);
  await clickResultAction(page, 'Try again');
  await expect(page.getByTestId('card-count')).toHaveText('0 / 20');
  await expect(page.getByTestId('hearts').locator('svg[fill="#F37858"]')).toHaveCount(3);
});

test('a real 60-card run with two misses passes and keeps mastery after reload', async ({ page }) => {
  await selectMode(page, 'addition', 5, 'mastery');
  await expect(page.getByTestId('card-count')).toHaveText('0 / 60');
  const misses = [];
  for (let index = 0; index < 60; index++) {
    const fact = await enterAnswer(page, index, 60, index < 2);
    if (index < 2) misses.push(fact);
  }
  await expect(page.getByText('MASTERY UNLOCKED', { exact: true })).toBeVisible();
  await expect(page.getByText('58/60', { exact: true })).toBeVisible();
  await expect(page.getByText('97%', { exact: true })).toBeVisible();
  await expectMissedFacts(page, misses);
  await clickResultAction(page, 'Back to worlds');
  await expect(page.getByTestId('world-mastery-addition-5')).toBeVisible();
  await expect(page.getByTestId('world-mastery-addition-5')).toContainText('1–5');
  await page.getByTestId('nav-progress').click();
  await expect(page.getByText('Mastery · Completed', { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid^="history-trophy-"]')).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('profile-picker')).toBeVisible();
  await page.getByTestId('nav-progress').click();
  await expect(page.getByText('Mastery · Completed', { exact: true })).toBeVisible();
  await expect(page.getByText('58/60', { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid^="history-trophy-"]')).toHaveCount(1);
  await page.getByTestId('nav-play').click();
  await expect(page.getByTestId('world-mastery-addition-5')).toBeVisible();
  await addPlayer(page, 'New learner');
  await page.getByTestId('nav-play').click();
  await expect(page.getByTestId('world-mastery-addition-5')).toHaveCount(0);
});

for (const mode of ['speed', 'mastery'] as const) {
  test(`${mode} correct answers advance immediately without answer-area chatter`, async ({ page }) => {
    const total = mode === 'speed' ? 30 : 60;
    await startFrozenTimedRun(page, mode);
    await answerWithoutAdvancingTime(page, 0, total);
    const { question, index } = await findTwoDigitQuestion(page, 1, total);
    const [first, second] = String(question.answer);

    await expect(page.getByText('Nice one. Keep your flow.', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/digits? · answer submits automatically/)).toHaveCount(0);
    await page.getByTestId(`key-${first}`).click();
    await expect(page.getByTestId('answer-digit-0')).toHaveText(first);
    await expect(page.getByTestId('answer-digit-1')).toHaveText('');
    await expect(page.getByTestId('card-count')).toHaveText(`${index} / ${total}`);

    await page.clock.runFor(450);
    await expect(page.getByText('Nice one. Keep your flow.', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('question')).toHaveAttribute('aria-label', question.label);
    await expect(page.getByTestId('answer-digit-0')).toHaveText(first);
    await page.getByTestId('key-delete').click();
    await expect(page.getByTestId('answer-digit-0')).toHaveText('');
    await enterDigits(page, first + second);
    await expect(page.getByTestId('card-count')).toHaveText(`${index + 1} / ${total}`);
    await expect(page.getByTestId('question')).not.toHaveAttribute('aria-label', question.label);
    await expect(page.getByTestId('answer-digit-0')).toHaveText('');
  });
}

test('a timed mistake has a clear X without fleeting correction text and keeps its full pause', async ({ page }) => {
  await startFrozenTimedRun(page, 'mastery');
  await answerWithoutAdvancingTime(page, 0, 60);
  await page.clock.runFor(250);
  const wrongQuestion = await readQuestion(page);
  await enterDigits(page, '0'.repeat(String(wrongQuestion.answer).length));
  await expect(page.getByTestId('card-count')).toHaveText('2 / 60');
  await expect(page.getByTestId('hearts').locator('svg[fill="#F37858"]')).toHaveCount(2);
  await expect(page.getByTestId('question')).toHaveAttribute('aria-label', wrongQuestion.label);
  await expect(page.getByTestId('mistake-indicator')).toBeVisible();
  await expect(page.getByText(/You've got the next one\./)).toHaveCount(0);

  // The old success callback would fire here, 450 ms after the first answer
  // but only 200 ms into the newer 350 ms correction. It must be cancelled.
  await page.clock.runFor(200);
  await page.getByTestId('key-9').click();
  await page.getByTestId('key-delete').click();
  await expect(page.getByTestId('mistake-indicator')).toBeVisible();
  await expect(page.getByTestId('question')).toHaveAttribute('aria-label', wrongQuestion.label);
  await expect(page.getByTestId('card-count')).toHaveText('2 / 60');
  await expect(page.getByTestId('answer-digit-0')).toHaveText('0');
  await page.clock.runFor(149);
  await expect(page.getByTestId('question')).toHaveAttribute('aria-label', wrongQuestion.label);
  await page.clock.runFor(1);
  await expect(page.getByTestId('question')).not.toHaveAttribute('aria-label', wrongQuestion.label);
  await expect(page.getByTestId('answer-digit-0')).toHaveText('');
  await expect(page.getByTestId('mistake-indicator')).toHaveCount(0);

  const { question, index } = await findTwoDigitQuestion(page, 2, 60);
  const [first, second] = String(question.answer);
  await page.getByTestId(`key-${first}`).click();
  await expect(page.getByTestId('answer-digit-0')).toHaveText(first);
  // After correction, typing the next answer remains safe while any subsequent
  // success feedback from finding a two-digit card is still visible.
  await page.clock.runFor(100);
  await expect(page.getByTestId('question')).toHaveAttribute('aria-label', question.label);
  await expect(page.getByTestId('answer-digit-0')).toHaveText(first);
  await page.getByTestId(`key-${second}`).click();
  await expect(page.getByTestId('card-count')).toHaveText(`${index + 1} / 60`);
});

test('the third Mastery mistake keeps its X flash before reviewing all three missed facts', async ({ page }) => {
  await startFrozenTimedRun(page, 'mastery');
  const misses = [];
  for (let index = 0; index < 3; index++) {
    const question = await readQuestion(page);
    const value = '0'.repeat(String(question.answer).length);
    misses.push({ ...question, value });
    await enterDigits(page, value);
    await expect(page.getByTestId('card-count')).toHaveText(`${index + 1} / 60`);
    await expect(page.getByTestId('mistake-indicator')).toBeVisible();
    await expect(page.getByTestId('results-screen')).toHaveCount(0);
    await page.clock.runFor(349);
    await expect(page.getByTestId('mistake-indicator')).toBeVisible();
    await expect(page.getByTestId('question')).toHaveAttribute('aria-label', question.label);
    await expect(page.getByTestId('results-screen')).toHaveCount(0);
    await page.clock.runFor(1);
  }
  await expect(page.getByText('Keep your chin up.', { exact: true })).toBeVisible();
  await expectMissedFacts(page, misses);
});

test('Learn keeps its paced correct-answer and correction pauses', async ({ page }) => {
  await page.clock.install();
  await selectMode(page, 'addition', 12, 'learn');
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1_000)));
  const correctQuestion = await readQuestion(page);
  await enterDigits(page, String(correctQuestion.answer));
  await expect(page.getByTestId('question')).toHaveAttribute('aria-label', correctQuestion.label);
  await page.clock.runFor(99);
  await expect(page.getByTestId('question')).toHaveAttribute('aria-label', correctQuestion.label);
  await page.clock.runFor(1);
  await expect(page.getByTestId('question')).not.toHaveAttribute('aria-label', correctQuestion.label);

  const wrongQuestion = await readQuestion(page);
  await enterDigits(page, '0'.repeat(String(wrongQuestion.answer).length));
  await page.clock.runFor(1_249);
  await page.getByTestId('key-9').click();
  await expect(page.getByTestId('question')).toHaveAttribute('aria-label', wrongQuestion.label);
  await expect(page.getByTestId('card-count')).toHaveText('2 / 20');
  await page.clock.runFor(1);
  await expect(page.getByTestId('question')).not.toHaveAttribute('aria-label', wrongQuestion.label);
  await expect(page.getByTestId('answer-digit-0')).toHaveText('');
  await expect(page.getByTestId('timer')).toHaveText('∞');
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
  await page.clock.runFor(900);
  await clickResultAction(page, 'Choose a mode');
  await page.getByTestId('start-speed').click();
  for (let step = 0; step < 3; step++) await page.clock.runFor(800);
  await expect(page.getByTestId('card-count')).toHaveText('0 / 30');
  await page.clock.fastForward(45_000);
  await expect(page.getByText(/Time's up, Player 1/)).toBeVisible();
  await expect(page.getByText('0/30', { exact: true })).toBeVisible();
  await page.clock.runFor(900);
  await clickResultAction(page, 'Choose a mode');
  await page.getByTestId('start-learn').click();
  await page.clock.fastForward(3_600_000);
  await expect(page.getByTestId('card-count')).toHaveText('0 / 20');
  await expect(page.getByTestId('timer')).toHaveText('∞');
});

test('a timeout preserves earlier misses even after a later correct answer', async ({ page }) => {
  await startFrozenTimedRun(page, 'mastery');
  const missed = await readQuestion(page);
  const value = '0'.repeat(String(missed.answer).length);
  await enterDigits(page, value);
  await page.clock.runFor(350);
  const correct = await readQuestion(page);
  await enterDigits(page, String(correct.answer));
  await page.clock.fastForward(60_000);
  await expect(page.getByText(/Time's up, Player 1/)).toBeVisible();
  await expectMissedFacts(page, [{ ...missed, value }]);
});

test.describe('result controls protect the end of a run from trailing touches', () => {
  test.use({ hasTouch: true });

  test('rapid taps stay on the result until both the arrival and quiet periods have passed', async ({ page }) => {
    await startFrozenTimedRun(page, 'mastery');
    await page.clock.fastForward(60_000);
    await expect(page.getByTestId('results-screen')).toBeVisible();
    const replay = page.getByRole('button', { name: 'Try again', exact: true });
    await replay.scrollIntoViewIfNeeded();
    const bounds = await replay.boundingBox();
    expect(bounds).toBeTruthy();

    // These are genuine touchscreen taps, including one after the initial
    // 900 ms guard. Each trailing tap must start a new 450 ms quiet period.
    for (let tap = 0; tap < 5; tap++) {
      if (tap) await page.clock.runFor(250);
      await expect(replay).toBeDisabled();
      await page.touchscreen.tap(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
      await expect(page.getByTestId('results-screen')).toBeVisible();
    }
    await page.clock.runFor(449);
    await expect(replay).toBeDisabled();
    await page.clock.runFor(1);
    await expect(replay).toBeEnabled();
    await page.touchscreen.tap(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await expect(page.getByTestId('results-screen')).toHaveCount(0);
    for (let step = 0; step < 3; step++) await page.clock.runFor(800);
    await expect(page.getByTestId('card-count')).toHaveText('0 / 60');
  });
});

test('a press begun during the result guard cannot navigate when released after it unlocks', async ({ page }) => {
  await startFrozenTimedRun(page, 'mastery');
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId('results-screen')).toBeVisible();
  const replay = page.getByRole('button', { name: 'Try again', exact: true });
  await replay.scrollIntoViewIfNeeded();
  const bounds = await replay.boundingBox();
  expect(bounds).toBeTruthy();
  await expect(replay).toBeDisabled();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.clock.runFor(1_000);
  await page.mouse.up();
  await expect(page.getByTestId('results-screen')).toBeVisible();
  await expect(replay).toBeDisabled();
  await page.clock.runFor(449);
  await expect(replay).toBeDisabled();
  await page.clock.runFor(1);
  await expect(replay).toBeEnabled();
  await replay.click();
  await expect(page.getByTestId('results-screen')).toHaveCount(0);
});

for (const viewport of [{ width: 344, height: 740 }, { width: 768, height: 720 }]) {
  test(`keypad clears the bottom edge and the answer is centered at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await selectMode(page, 'addition', 12, 'learn');
    // Browser safe-area insets are normally zero. Give the enclosing safe-area
    // view a 24 px status and navigation inset to test the available viewport
    // without adding application-only test hooks. Native insets still require
    // a device check; this uses the larger zero-inset JS key heights.
    await page.getByTestId('game-screen').evaluate(element => {
      const safeArea = element.parentElement!;
      safeArea.style.paddingTop = '24px';
      safeArea.style.paddingBottom = '24px';
    });
    await expect(page.getByText(/answer submits automatically/)).toHaveCount(0);
    await expect(page.getByText('=', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('answer-digit-0')).toHaveText('');
    const question = await page.getByTestId('question').boundingBox();
    const answer = await page.getByTestId('answer-slots').boundingBox();
    const zero = await page.getByTestId('key-0').boundingBox();
    const safeViewport = await page.getByTestId('game-screen').boundingBox();
    expect(question).toBeTruthy();
    expect(answer).toBeTruthy();
    expect(zero).toBeTruthy();
    expect(safeViewport).toBeTruthy();
    expect(Math.abs(question!.x + question!.width / 2 - answer!.x - answer!.width / 2)).toBeLessThan(1);
    expect(zero!.height).toBeGreaterThanOrEqual(44);
    expect(safeViewport!.y + safeViewport!.height - zero!.y - zero!.height).toBeGreaterThanOrEqual(32);
    expect(zero!.y + zero!.height).toBeLessThanOrEqual(viewport.height - 24 - 32);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const digit of ['3', '6', '9', '0']) {
      const key = await page.getByTestId(`key-${digit}`).boundingBox();
      expect(key!.x + key!.width).toBeLessThanOrEqual(viewport.width);
    }
    await page.screenshot({ path: `test-results/foldable-${viewport.width}x${viewport.height}.png`, fullPage: true });
  });
}

test('family players persist and switching keeps each player’s progress separate', async ({ page }) => {
  await addPlayer(page, 'Avery');
  await selectMode(page, 'addition', 5, 'learn');
  await completeLearn(page);
  await clickResultAction(page, 'Back to worlds');
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
  await expect(page.locator('[data-testid^="history-check-"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="history-trophy-"]')).toHaveCount(0);
  await page.getByTestId('profile-picker').click();
  await page.getByRole('button', { name: 'Play as Milo', exact: true }).click();
  await expect(page.getByText('Your story starts with one card.', { exact: true })).toBeVisible();
  await expect(page.getByText('Learn · Completed', { exact: true })).toHaveCount(0);
});
