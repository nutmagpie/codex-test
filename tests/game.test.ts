import assert from 'node:assert/strict';
import test from 'node:test';
import { createSession, expectedDigits, factBank, factFromKey, getLevel, getLevels, makeFact, OPERATIONS, RANGES, submitAnswer, WORLDS } from '../src/game';
import { createProfile, sessionRecord } from '../src/profileModel';
import { practiceSelection, selectSet } from '../src/recall';
import { coachingLine, setWin, strategy } from '../src/coaching';
const now = new Date(2026, 9, 21, 12);
const credit = { firstSight: true, creditEligible: true, creditDate: '2026-10-21', recallBarMs: 3000 };
function finish(wrong = 0, firstKeyMs = 1000) {
  const p = createProfile('A'); let s = createSession(getLevel('addition-5'), selectSet(getLevel('addition-5'), p), 3000, now);
  while (s.status === 'playing') s = submitAnswer(s, s.questions[s.index].answer + Number(s.index < wrong), { firstKeyMs, submitMs: firstKeyMs + 200, usedBackspace: false }, credit, now);
  return s;
}
test('all worlds expose all three ranges without modes', () => {
  assert.equal(WORLDS.length, 7);
  for (const w of WORLDS) { assert.deepEqual(getLevels(w.id).map(l => l.range), RANGES); for (const l of getLevels(w.id)) assert.deepEqual(getLevel(l.id), l); }
  assert.throws(() => getLevel('bad'), /Unknown/);
});
test('every operation fills a canonical 12 by 12 grid and smaller square banks', () => {
  for (const op of OPERATIONS) for (const r of RANGES) {
    const bank = factBank(op, r); assert.equal(bank.length, r * r); assert.equal(new Set(bank.map(f => f.factKey)).size, r * r);
    for (const f of bank) {
      assert.deepEqual(factFromKey(f.factKey), f); assert.equal(f.symbol, { addition: '+', subtraction: '−', multiplication: '×', division: '÷' }[op]);
      assert.equal(f.answer, op === 'addition' ? f.left + f.right : op === 'subtraction' ? f.left - f.right : op === 'multiplication' ? f.left * f.right : f.left / f.right);
      if (op === 'subtraction') { assert.equal(f.left, f.a + f.b); assert.equal(f.answer, f.a); }
      if (op === 'division') { assert.equal(f.left, f.a * f.b); assert.equal(f.answer, f.a); }
    }
  }
  assert.deepEqual(makeFact('subtraction', 12, 12), { factKey: 'subtraction:12:12', operation: 'subtraction', a: 12, b: 12, left: 24, right: 12, answer: 12, symbol: '−' });
  for (const key of ['addition:0:1', 'addition:13:1', 'addition:01:1', '__proto__', 'division:1:1:1']) assert.equal(factFromKey(key), null);
});
test('sets always reach twenty answers even if all twenty are missed', () => {
  const s = finish(20); assert.equal(s.status, 'complete'); assert.equal(s.answers.length, 20); assert.equal(s.answers.filter(a => a.correct).length, 0);
  assert.equal(submitAnswer(s, 1, { firstKeyMs: 1, submitMs: 1, usedBackspace: false }, credit), s);
  assert.ok(!('hearts' in s)); assert.ok(!('mode' in s)); assert.ok(!('failureReason' in s));
});
test('answer records retain the fact, typed value, both timings, backspace and credit context', () => {
  const level = getLevel('multiplication-12'); let s = createSession(level, { facts: [makeFact('multiplication', 12, 12)], showWhatYouKnow: false, practiceMissed: true }, 3000, now);
  const timing = { firstKeyMs: 1250, submitMs: 1700, usedBackspace: true }; s = submitAnswer(s, 140, timing, credit, now);
  assert.equal(s.answers[0].value, 140); assert.equal(s.answers[0].correct, false); assert.equal(s.answers[0].factKey, 'multiplication:12:12');
  assert.deepEqual(Object.fromEntries(Object.keys(timing).map(k => [k, s.answers[0][k as keyof typeof timing]])), timing);
  assert.equal(s.elapsedMs, 1700); assert.equal(expectedDigits(s.questions[0]), 3);
  assert.throws(() => submitAnswer(createSession(level, { facts: [makeFact('addition', 1, 1)], showWhatYouKnow: false, practiceMissed: false }, 3000), -1, timing, credit), RangeError);
});
test('interruptions longer than twenty seconds are absent from both timing statistics', () => {
  let s = createSession(getLevel('addition-5'), { facts: [makeFact('addition', 1, 1), makeFact('addition', 2, 2)], showWhatYouKnow: false, practiceMissed: false }, 3000, now);
  s = submitAnswer(s, 2, { firstKeyMs: 20_001, submitMs: 21_000, usedBackspace: false }, credit, now);
  s = submitAnswer(s, 4, { firstKeyMs: 1000, submitMs: 1500, usedBackspace: false }, credit, now);
  assert.equal(s.elapsedMs, 1500); assert.equal(sessionRecord(s).medianMs, 1000); assert.equal(s.answers.length, 2);
  assert.equal(sessionRecord(finish(0, 20_001)).medianMs, null);
});
test('Practice missed contains exactly the missed facts, deduplicated, without discovery credit', () => {
  const s = finish(3); const selection = practiceSelection([...s.answers, s.answers[0]]);
  assert.equal(selection.facts.length, 3); assert.equal(selection.practiceMissed, true); assert.equal(selection.showWhatYouKnow, false);
});
test('coaching is conditional and never calls 95 percent a perfect result', () => {
  assert.match(coachingLine(finish(3))!, /^Accuracy first/); assert.equal(coachingLine(finish(2)), null);
  assert.match(coachingLine(finish(1, 4000))!, /^Almost every answer right/);
  assert.match(coachingLine(finish(0, 4000))!, /^Every answer right/);
  assert.equal(coachingLine(finish(3, 4000)), null); assert.equal(coachingLine(finish(0, 20_001)), null);
});
test('derived-fact coaching is available for every fact and uses exact arithmetic', () => {
  for (const op of OPERATIONS) for (const f of factBank(op)) { const text = strategy(f); assert.ok(text.length > 15); assert.match(text, new RegExp(`\\b${f.answer}\\b`)); }
  assert.equal(strategy(makeFact('multiplication', 9, 7)), 'Think 10 × 7 = 70, then take away one 7. That’s 63.');
  assert.equal(strategy(makeFact('multiplication', 12, 8)), 'Think 10 × 8 = 80, plus 2 × 8 = 16. That’s 96.');
});
test('wins are earned: no generic consolation, no invented perfect set, no practice credit', () => {
  const before = createProfile('A'); assert.equal(setWin(finish(2), before, before, now), null);
  assert.equal(setWin(finish(), before, before, now)?.title, 'Your first perfect set.');
  const s = { ...finish(), practiceMissed: true }; assert.equal(setWin(s, before, before, now), null);
});
