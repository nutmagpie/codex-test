import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MODES, RANGES, WORLDS, createSession, expectedDigits, generateQuestions,
  getLevel, getLevels, submitAnswer, tickSession,
  type Operation, type Question, type Session,
} from '../src/game';

function seededRandom(seed = 1234): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function factKey(question: Question): string {
  return `${question.operation}:${question.left}:${question.right}`;
}

function answerAll(session: Session, wrongIndexes: number[] = []): Session {
  let result = session;
  while (result.status === 'playing') {
    const answer = result.questions[result.index].answer;
    result = submitAnswer(result, wrongIndexes.includes(result.index) ? answer + 1 : answer);
  }
  return result;
}

test('all seven worlds have the three requested level ranges', () => {
  assert.deepEqual(WORLDS.map(world => world.id), [
    'addition', 'subtraction', 'add-subtract', 'multiplication', 'division', 'multiply-divide', 'all',
  ]);
  for (const world of WORLDS) {
    assert.deepEqual(getLevels(world.id).map(level => level.range), [...RANGES]);
    for (const level of getLevels(world.id)) assert.deepEqual(getLevel(level.id), level);
  }
  assert.throws(() => getLevel('missing-world-5'), /Unknown level/);
});

test('question banks cover the arithmetic facts and respect all range rules', () => {
  const operations: Operation[] = ['addition', 'subtraction', 'multiplication', 'division'];
  for (const range of RANGES) {
    for (const operation of operations) {
      const level = getLevel(`${operation}-${range}`);
      const bankSize = operation === 'subtraction' ? range * (range + 1) / 2 : range * range;
      const questions = generateQuestions(level, bankSize, seededRandom(range));
      assert.equal(questions.length, bankSize);
      assert.equal(new Set(questions.map(factKey)).size, bankSize, `${operation} bank must not repeat facts`);
      const actualFacts = new Set(questions.map(factKey));
      for (let a = 1; a <= range; a++) {
        for (let b = 1; b <= range; b++) {
          if (operation === 'subtraction' && b > a) continue;
          assert.ok(actualFacts.has(`${operation}:${operation === 'division' ? a * b : a}:${b}`));
        }
      }
      for (const question of questions) {
        assert.equal(question.operation, operation);
        assert.ok(question.right >= 1 && question.right <= range);
        if (operation !== 'division') assert.ok(question.left >= 1 && question.left <= range);
        switch (operation) {
          case 'addition': assert.equal(question.answer, question.left + question.right); break;
          case 'subtraction':
            assert.ok(question.answer >= 0);
            assert.equal(question.answer, question.left - question.right);
            break;
          case 'multiplication': assert.equal(question.answer, question.left * question.right); break;
          case 'division':
            assert.equal(question.left % question.right, 0);
            assert.equal(question.answer, question.left / question.right);
            assert.ok(question.answer >= 1 && question.answer <= range);
            break;
        }
      }
    }
  }
});

test('mixed worlds distribute operations evenly without adjacent identical facts', () => {
  for (const world of WORLDS) {
    const questions = generateQuestions(getLevels(world.id)[0], 137, seededRandom(45));
    const counts = world.operations.map(operation => questions.filter(question => question.operation === operation).length);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
    assert.equal(new Set(questions.map(question => question.id)).size, questions.length);
    questions.forEach((question, index) => {
      if (index > 0) assert.notEqual(factKey(question), factKey(questions[index - 1]));
    });
  }
});

test('shuffle is reproducible for a seed, varies across seeds, and avoids bank-boundary repeats', () => {
  const level = getLevel('subtraction-5');
  const first = generateQuestions(level, 200, seededRandom(12));
  assert.deepEqual(first, generateQuestions(level, 200, seededRandom(12)));
  assert.notDeepEqual(first, generateQuestions(level, 200, seededRandom(19)));
  // Even an adversarial constant RNG should not put identical facts together.
  const constant = generateQuestions(level, 100, () => 0);
  constant.forEach((question, index) => {
    if (index) assert.notEqual(factKey(question), factKey(constant[index - 1]));
  });
  assert.deepEqual(generateQuestions(level, 0), []);
  assert.throws(() => generateQuestions(level, -1), /card count/);
  assert.throws(() => generateQuestions(level, 1.5), /card count/);
});

test('the three modes start with their documented card and timer counts', () => {
  const level = getLevel('addition-10');
  const sessionIds = new Set<string>();
  assert.deepEqual(Object.values(MODES).map(mode => [mode.cards, mode.seconds]), [[20, null], [30, 45], [60, 60]]);
  for (const mode of ['learn', 'speed', 'mastery'] as const) {
    const session = createSession(level, mode, seededRandom());
    assert.equal(session.questions.length, MODES[mode].cards);
    assert.equal(session.hearts, 3);
    assert.equal(session.status, 'playing');
    assert.equal(session.answered, 0);
    assert.equal(session.lastAnswer, null);
    sessionIds.add(session.id);
  }
  assert.equal(sessionIds.size, 3);
});

test('mastery passes with 58 correct answers and two mistakes', () => {
  const original = createSession(getLevel('addition-10'), 'mastery', seededRandom());
  const result = answerAll(original, [0, 59]);
  assert.equal(result.status, 'passed');
  assert.equal(result.correct, 58);
  assert.equal(result.answered, 60);
  assert.equal(result.mistakes, 2);
  assert.equal(result.hearts, 1);
  assert.equal(result.failureReason, null);
  assert.equal(result.index, 60);
  assert.equal(result.id, original.id);
  assert.equal(original.answered, 0, 'submission must preserve the previous state');
  assert.equal(original.hearts, 3);
});

test('the third mistake ends the run, including on the final card', () => {
  const original = createSession(getLevel('division-12'), 'mastery', seededRandom());
  let session = submitAnswer(original, -1);
  assert.equal(session.hearts, 2);
  assert.equal(session.status, 'playing');
  session = submitAnswer(session, -1);
  assert.equal(session.hearts, 1);
  assert.equal(session.status, 'playing');
  session = submitAnswer(session, -1);
  assert.equal(session.hearts, 0);
  assert.equal(session.answered, 3);
  assert.equal(session.status, 'failed');
  assert.equal(session.failureReason, 'hearts');
  assert.equal(session.lastAnswer?.correct, false);
  assert.strictEqual(submitAnswer(session, 1), session);

  const lastCardFailure = answerAll(original, [0, 1, 59]);
  assert.equal(lastCardFailure.answered, 60);
  assert.equal(lastCardFailure.correct, 57);
  assert.equal(lastCardFailure.status, 'failed');
  assert.equal(lastCardFailure.failureReason, 'hearts');
});

test('timers are monotonic and fail exactly at the mode deadline', () => {
  const level = getLevel('multiplication-12');
  for (const mode of ['speed', 'mastery'] as const) {
    const deadline = MODES[mode].seconds! * 1000;
    const original = createSession(level, mode, seededRandom());
    const running = tickSession(original, deadline - 1);
    assert.equal(running.status, 'playing');
    assert.strictEqual(tickSession(running, 10), running);
    const stopped = tickSession(running, deadline);
    assert.equal(stopped.status, 'failed');
    assert.equal(stopped.failureReason, 'time');
    assert.equal(stopped.elapsedMs, deadline);
    assert.equal(original.elapsedMs, 0);
    assert.strictEqual(tickSession(stopped, deadline + 5000), stopped);
    assert.strictEqual(submitAnswer(stopped, stopped.questions[0].answer), stopped);
  }
  const learning = tickSession(createSession(level, 'learn', seededRandom()), 3_600_000);
  assert.equal(learning.status, 'playing');
  assert.equal(learning.elapsedMs, 3_600_000);
  const won = answerAll(createSession(level, 'mastery', seededRandom()));
  assert.strictEqual(tickSession(won, 60_000), won);
  assert.strictEqual(submitAnswer(won, 1), won);
});

test('the final answer passes just before the deadline and is refused at the deadline', () => {
  let session = createSession(getLevel('all-12'), 'mastery', seededRandom());
  for (let index = 0; index < 59; index++) {
    session = submitAnswer(session, session.questions[session.index].answer);
  }
  const finalAnswer = session.questions[session.index].answer;
  const justInTime = submitAnswer(tickSession(session, 59_999), finalAnswer);
  assert.equal(justInTime.status, 'passed');
  assert.equal(justInTime.correct, 60);
  assert.equal(justInTime.elapsedMs, 59_999);
  assert.strictEqual(tickSession(justInTime, 60_000), justInTime);

  const tooLate = tickSession(session, 60_000);
  assert.strictEqual(submitAnswer(tooLate, finalAnswer), tooLate);
  assert.equal(tooLate.status, 'failed');
  assert.equal(tooLate.answered, 59);
  assert.equal(tooLate.correct, 59);
  assert.equal(tooLate.failureReason, 'time');
});

test('auto-submit uses one, two, or three digits, including a zero answer', () => {
  const base: Question = { id: 'digits', left: 1, right: 1, operation: 'addition', symbol: '+', answer: 0 };
  assert.equal(expectedDigits(base), 1);
  assert.equal(expectedDigits({ ...base, answer: 24 }), 2);
  assert.equal(expectedDigits({ ...base, answer: 144 }), 3);
});
