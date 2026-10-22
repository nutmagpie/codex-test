import assert from 'node:assert/strict';
import test from 'node:test';
import { createSession, getLevel, makeFact, submitAnswer } from '../src/game';
import { addProfile, createDefaultState, createProfile, deleteProfile, getActiveProfile, practiceStreak, recordSession, sanitizeState, selectProfile, validBirthYear } from '../src/profileModel';
import { emptyFactStat, presentFact, recordRecall } from '../src/recall';
const now = new Date(2026, 9, 21, 12);
function completed() {
  const fact = makeFact('addition', 1, 1);
  let s = createSession(getLevel('addition-5'), { facts: [fact], showWhatYouKnow: true, practiceMissed: false }, 3000, now);
  return submitAnswer(s, 2, { firstKeyMs: 1000, submitMs: 1200, usedBackspace: false }, { creditEligible: true, firstSight: true, creditDate: '2026-10-21', recallBarMs: 3000 }, now);
}
test('new players start with empty facts and real birth years only', () => {
  const s = createDefaultState(); const p = getActiveProfile(s)!;
  assert.deepEqual(p.facts, {}); assert.deepEqual(p.earnedTrophies, []); assert.equal(p.birthYear, null);
  assert.equal(createProfile('  Alex  ', 'sun', undefined, 2015).birthYear, 2015);
  assert.throws(() => createProfile(' '), RangeError); assert.throws(() => createProfile('a'.repeat(21)), RangeError); assert.throws(() => createProfile('A', 'sun', undefined, 9999), RangeError);
  assert.equal(validBirthYear(2027, now), false); assert.equal(validBirthYear(2026, now), true);
});
test('family selection, deletion, and fact progress stay isolated', () => {
  const initial = createDefaultState(); let s = addProfile(initial, 'Avery', 'fox', undefined, 2016); const a = getActiveProfile(s)!;
  assert.equal(a.name, 'Avery'); const shown = presentFact(a, 'addition:1:1', now, false); const answer = { ...completed().answers[0], ...shown.credit };
  s = { ...s, profiles: s.profiles.map(p => p.id === a.id ? { ...p, ...recordRecall(shown.data, answer, 3000) } : p) };
  assert.equal(Object.keys(getActiveProfile(s)!.facts).length, 1);
  s = selectProfile(s, initial.activeProfileId!); assert.deepEqual(getActiveProfile(s)!.facts, {});
  const restored = sanitizeState(JSON.parse(JSON.stringify(s))); assert.equal(restored.profiles[1].facts['addition:1:1'].cleanDays, 3); assert.equal(restored.profiles[1].birthYear, 2016);
  assert.equal(selectProfile(s, 'missing'), s); assert.equal(deleteProfile(s, 'missing'), s);
  s = deleteProfile(s, initial.activeProfileId!); assert.equal(getActiveProfile(s)!.name, 'Avery');
  s = deleteProfile(s, a.id); assert.equal(s.profiles.length, 1);
});
test('recording completion is idempotent and history is bounded without deleting facts', () => {
  let p = createProfile('A'); const s = completed(); p.facts['addition:1:1'] = { ...emptyFactStat(now), cleanDays: 3 };
  assert.equal(recordSession(p, { ...s, status: 'playing' }), p);
  p = recordSession(p, s, now); assert.equal(recordSession(p, s), p); assert.equal(p.history[0].correct, 1); assert.equal(p.history[0].medianMs, 1000);
  for (let i = 0; i < 105; i++) p = recordSession(p, { ...s, id: `set-${i}` }, now);
  assert.equal(p.history.length, 100); assert.equal(p.facts['addition:1:1'].cleanDays, 3);
});
test('upgrading resets old timed progress once, retaining player identities and preferences', () => {
  const old = { profiles: [{ id: 'kid', name: 'Avery', avatar: 'fox', color: '#F6BF86', createdAt: now.toISOString(), progress: { 'addition-5': { mastery: true } }, history: [{ id: 'old' }], facts: { 'addition:1:1': { ...emptyFactStat(now), cleanDays: 3 } } }], activeProfileId: 'kid', haptics: false, sound: false };
  const s = sanitizeState(old); assert.equal(s.schemaVersion, 2); assert.equal(s.profiles[0].id, 'kid'); assert.equal(s.profiles[0].name, 'Avery'); assert.equal(s.profiles[0].avatar, 'fox'); assert.equal(s.haptics, false); assert.equal(s.sound, false);
  assert.deepEqual(s.profiles[0].facts, {}); assert.deepEqual(s.profiles[0].history, []); assert.deepEqual(s.profiles[0].earnedTrophies, []);
  s.profiles[0].facts['addition:1:1'] = { ...emptyFactStat(now), cleanDays: 1 }; assert.equal(sanitizeState(s).profiles[0].facts['addition:1:1'].cleanDays, 1);
});
test('new-field sanitization rejects invalid facts, dates, timings and trophy identifiers', () => {
  const p = createProfile('A'); const good = emptyFactStat(now);
  const s = sanitizeState({ schemaVersion: 2, activeProfileId: p.id, profiles: [{ ...p, birthYear: 9999,
    facts: { 'addition:1:1': { ...good, attempts: 2, correct: 99, cleanDays: 8, firstKeyMs: [-1, '9', 50, 20_001, 100, Infinity], lastSeenDate: '2026-02-30', reviewStage: 99 }, 'addition:0:0': good, '__proto__': good, 'division:1:2': { firstSeen: 'bad' } },
    calibration: { sampleCount: 999, medianMs: 1, samples: [500, 700, -2, 'no', 20_001] }, earnedTrophies: ['addition-5', 'all-12', '__proto__', 'addition-5'] }] });
  const restored = s.profiles[0]; assert.equal(restored.birthYear, null); assert.equal(restored.facts['addition:1:1'].correct, 2); assert.equal(restored.facts['addition:1:1'].cleanDays, 3);
  assert.deepEqual(Object.keys(restored.facts), ['addition:1:1']); assert.deepEqual(restored.facts['addition:1:1'].firstKeyMs, [50, 100]); assert.equal(restored.facts['addition:1:1'].lastSeenDate, '2026-10-21');
  assert.equal(restored.calibration.sampleCount, 2); assert.equal(restored.calibration.medianMs, 600); assert.deepEqual(restored.earnedTrophies, ['addition-5']);
  assert.equal(sanitizeState({ profiles: [] }).profiles.length, 1); assert.equal(sanitizeState(null).profiles.length, 1);
});
test('streaks count distinct calendar days rather than sets, and reset after a missed day', () => {
  const p = createProfile('A'); const r = recordSession(p, completed(), now).history[0];
  const history = [21, 21, 20, 19].map((d, i) => ({ ...r, id: `${i}`, createdAt: new Date(2026, 9, d, 12).toISOString() }));
  assert.equal(practiceStreak(history, now), 3); assert.equal(practiceStreak(history, new Date(2026, 9, 22)), 3); assert.equal(practiceStreak(history, new Date(2026, 9, 23)), 0);
  assert.equal(practiceStreak(history.map(r => ({ ...r, practiceMissed: true })), now), 0);
});
