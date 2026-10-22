import assert from 'node:assert/strict';
import test from 'node:test';
import { Answer, factBank, getLevel, makeFact, OPERATIONS } from '../src/game';
import { createProfile, Profile } from '../src/profileModel';
import { addDays, ageFromBirthYear, deriveTrophies, easiestFirst, emptyFactStat, knownCount, localDay, median, presentFact, rangeEarned, recallBar, recordRecall, selectSet, stateOf } from '../src/recall';
const date = (day = 21) => new Date(2026, 9, day, 12);
function answer(profile: Profile, key = 'addition:3:4', day = 21, options: Partial<Pick<Answer, 'correct' | 'firstKeyMs' | 'usedBackspace'>> & { practice?: boolean } = {}): Profile {
  const at = date(day); const shown = presentFact(profile, key, at, options.practice ?? false); const f = key.split(':'); const fact = makeFact(f[0] as 'addition', Number(f[1]), Number(f[2]));
  const a: Answer = { question: { ...fact, id: `${day}:${key}` }, factKey: key, value: options.correct === false ? fact.answer + 1 : fact.answer,
    correct: options.correct ?? true, firstKeyMs: options.firstKeyMs ?? 1000, submitMs: (options.firstKeyMs ?? 1000) + 200, usedBackspace: options.usedBackspace ?? false, answeredAt: at.toISOString(), ...shown.credit };
  return { ...profile, ...recordRecall(shown.data, a, a.recallBarMs) };
}
test('first-sight clean recall jumps straight to By heart with a check-in within seven days', () => {
  const original = createProfile('A'); const p = answer(original); const stat = p.facts['addition:3:4'];
  assert.equal(stateOf(stat), 'by-heart'); assert.equal(stat.cleanDays, 3); assert.equal(stat.creditedOnFirstSight, true); assert.equal(stat.nextReviewDate, '2026-10-24');
  assert.equal(stateOf(original.facts['addition:3:4']), 'not-yet');
});
test('first-sight misses, slow answers and backspace do not earn first-sight credit', () => {
  for (const option of [{ correct: false }, { firstKeyMs: 3001 }, { usedBackspace: true }]) {
    const p = answer(createProfile('A'), undefined, 21, option); assert.equal(stateOf(p.facts['addition:3:4']), 'learning'); assert.equal(p.facts['addition:3:4'].cleanDays, 0);
  }
});
test('only the first appearance can earn credit, including after a same-day miss or abandoned card', () => {
  let p = answer(createProfile('A'), undefined, 21, { correct: false }); p = answer(p);
  assert.equal(p.facts['addition:3:4'].cleanDays, 0); assert.equal(p.facts['addition:3:4'].attempts, 2);
  const abandoned = presentFact(createProfile('A'), 'addition:3:4', date(), false);
  p = answer({ ...createProfile('A'), ...abandoned.data }); assert.equal(p.facts['addition:3:4'].cleanDays, 0); assert.equal(p.facts['addition:3:4'].creditedOnFirstSight, false);
});
test('three separate clean days make an already-seen fact By heart; repeated days never add days', () => {
  let p = answer(createProfile('A'), undefined, 21, { correct: false });
  for (const [day, cleanDays] of [[22, 1], [23, 2], [25, 3]]) {
    p = answer(p, undefined, day); assert.equal(p.facts['addition:3:4'].cleanDays, cleanDays);
    p = answer(p, undefined, day); assert.equal(p.facts['addition:3:4'].cleanDays, cleanDays);
  }
  assert.equal(stateOf(p.facts['addition:3:4']), 'by-heart');
});
test('Practice missed earns no daily credit even on a new day', () => {
  let p = answer(createProfile('A'), undefined, 21, { correct: false }); p = answer(p, undefined, 22, { practice: true });
  assert.equal(p.facts['addition:3:4'].cleanDays, 0); p = answer(p, undefined, 22); assert.equal(p.facts['addition:3:4'].cleanDays, 0);
  p = answer(p, undefined, 23); assert.equal(p.facts['addition:3:4'].cleanDays, 1);
});
test('misses and slow recall drop By heart to Almost; slips do not subtract Learning or Almost days', () => {
  for (const option of [{ correct: false }, { firstKeyMs: 3001 }]) {
    let p = answer(createProfile('A')); p = answer(p, undefined, 22, option); assert.equal(p.facts['addition:3:4'].cleanDays, 2); assert.equal(p.facts['addition:3:4'].nextReviewDate, null);
    p = answer(p, undefined, 23, option); assert.equal(p.facts['addition:3:4'].cleanDays, 2);
    p = answer(p, undefined, 24); assert.equal(p.facts['addition:3:4'].cleanDays, 3);
  }
});
test('reviews fall on days 3, 7, 21 and 60 after becoming By heart', () => {
  let p = answer(createProfile('A')); p = answer(p, undefined, 22); assert.equal(p.facts['addition:3:4'].nextReviewDate, '2026-10-24');
  p = answer(p, undefined, 24); assert.equal(p.facts['addition:3:4'].nextReviewDate, '2026-10-28');
  p = answer(p, undefined, 28); assert.equal(p.facts['addition:3:4'].nextReviewDate, '2026-11-11');
  const shown = presentFact(p, 'addition:3:4', new Date(2026, 10, 11, 12), false);
  const f = makeFact('addition', 3, 4); const a: Answer = { ...shown.credit, question: { ...f, id: 'review' }, factKey: f.factKey, value: 7, correct: true, firstKeyMs: 1000, submitMs: 1000, usedBackspace: false, answeredAt: new Date(2026, 10, 11, 12).toISOString() };
  const next = recordRecall(shown.data, a, 3000); assert.equal(next.facts[f.factKey].nextReviewDate, '2026-12-20');
});
test('recall calibration uses correct familiar facts, median plus one second, and a three-second cap', () => {
  let p = createProfile('A', 'sun', undefined, 2000); assert.equal(recallBar(p, date()), 2000);
  assert.equal(recallBar(createProfile('B', 'sun', undefined, 2020), date()), 3000); assert.equal(ageFromBirthYear(2010, date()), 16);
  p = answer(p, 'subtraction:1:1'); assert.equal(p.calibration.sampleCount, 0);
  p = answer(p, 'addition:1:1', 21, { correct: false }); assert.equal(p.calibration.sampleCount, 0);
  p = answer(p, 'addition:1:1', 21, { firstKeyMs: 20_001 }); assert.equal(p.calibration.sampleCount, 0);
  for (let i = 0; i < 9; i++) p = answer(p, 'multiplication:1:3', 21, { firstKeyMs: 600 });
  assert.equal(recallBar(p, date()), 2000); p = answer(p, 'addition:4:4', 21, { firstKeyMs: 800 });
  assert.equal(p.calibration.sampleCount, 10); assert.equal(p.calibration.medianMs, 600); assert.equal(recallBar(p, date()), 1600);
  assert.equal(presentFact(p, 'addition:3:4', date(22), false).credit.recallBarMs, 1600);
  const slow = { ...p, calibration: { sampleCount: 10, medianMs: 2500, samples: Array(10).fill(2500) } }; assert.equal(recallBar(slow, date()), 3000);
});
test('last-five timing samples exclude interruptions, while attempts still count', () => {
  let p = createProfile('A'); for (let i = 0; i < 7; i++) p = answer(p, undefined, 21, { firstKeyMs: 1000 + i * 100 });
  p = answer(p, undefined, 21, { firstKeyMs: 20_001 }); assert.deepEqual(p.facts['addition:3:4'].firstKeyMs, [1200, 1300, 1400, 1500, 1600]); assert.equal(p.facts['addition:3:4'].attempts, 8);
});
test('Show what you know selects unseen facts, easiest first, then fills a short remainder with review', () => {
  const p = createProfile('A'); const level = getLevel('multiplication-5'); const first = selectSet(level, p, date(), () => .5);
  assert.equal(first.facts.length, 20); assert.equal(first.showWhatYouKnow, true); assert.ok(first.facts.every(f => !p.facts[f.factKey]));
  assert.deepEqual(first.facts.map(easiestFirst), first.facts.map(easiestFirst).sort((a, b) => a - b));
  first.facts.forEach(f => { p.facts[f.factKey] = { ...emptyFactStat(date()), cleanDays: 3 }; });
  const second = selectSet(level, p, date(), () => .5); assert.equal(second.facts.length, 20); assert.equal(second.facts.slice(0, 5).filter(f => !p.facts[f.factKey]).length, 5);
  assert.equal(new Set(second.facts.map(f => f.factKey)).size, 20);
});
test('review picker respects 4 Learning, 8 Almost and 8 By heart; overdue facts lead their bucket', () => {
  const p = createProfile('A'); const bank = factBank('addition', 12);
  bank.forEach((f, i) => { p.facts[f.factKey] = { ...emptyFactStat(date(20)), attempts: 5, correct: i < 4 ? 0 : 5, cleanDays: i < 4 ? 0 : i < 12 ? 2 : 3, nextReviewDate: i === 30 ? '2026-10-19' : '2026-11-01' }; });
  const selected = selectSet(getLevel('addition-12'), p, date(), () => .5);
  const states = selected.facts.map(f => stateOf(p.facts[f.factKey])); assert.equal(states.filter(s => s === 'learning').length, 4); assert.equal(states.filter(s => s === 'almost').length, 8); assert.equal(states.filter(s => s === 'by-heart').length, 8);
  assert.equal(selected.facts[12].factKey, bank[30].factKey);
});
test('short buckets and same-day-only profiles still produce twenty distinct cards', () => {
  const p = createProfile('A'); factBank('addition', 5).forEach(f => { p.facts[f.factKey] = { ...emptyFactStat(date()), cleanDays: 2 }; });
  const set = selectSet(getLevel('addition-5'), p, date()); assert.equal(set.showWhatYouKnow, false); assert.equal(set.facts.length, 20); assert.equal(new Set(set.facts.map(f => f.factKey)).size, 20);
});
test('mixed operation sets are balanced and contribute canonical facts to the four shared grids', () => {
  const p = createProfile('A');
  for (const world of ['add-subtract', 'multiply-divide', 'all']) {
    const level = getLevel(`${world}-5`); const s = selectSet(level, p, date()); const counts = OPERATIONS.map(op => s.facts.filter(f => f.operation === op).length).filter(Boolean);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1); assert.equal(new Set(s.facts.map(f => f.factKey)).size, 20);
  }
});
test('range trophies come from complete squares and stay earned after slips', () => {
  const p = createProfile('A'); for (const f of factBank('addition', 5)) p.facts[f.factKey] = { ...emptyFactStat(date()), cleanDays: 3 };
  p.earnedTrophies = deriveTrophies(p.facts); assert.deepEqual(p.earnedTrophies, ['addition-5']); assert.equal(knownCount(p.facts), 25);
  const slipped = answer(p, 'addition:3:4', 22, { correct: false }); assert.equal(knownCount(slipped.facts), 24); assert.equal(rangeEarned(slipped, ['addition'], 5), true); assert.equal(rangeEarned(slipped, ['addition', 'subtraction'], 5), false);
});
test('calendar day arithmetic handles month/year boundaries and median handles even samples', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02'); assert.equal(addDays('2028-02-28', 1), '2028-02-29'); assert.equal(localDay(date()), '2026-10-21');
  assert.equal(median([4, 1, 3, 2]), 2.5); assert.equal(median([]), null);
});
test('late reviews skip expired milestones and successful day-60 reviews enter maintenance', () => {
  let p = answer(createProfile('A')); p = answer(p, undefined, 31); assert.equal(p.facts['addition:3:4'].nextReviewDate, '2026-11-11');
  p = answer(p, undefined, 42); assert.equal(p.facts['addition:3:4'].nextReviewDate, '2026-12-20');
  p = answer(p, undefined, 81); assert.equal(p.facts['addition:3:4'].nextReviewDate, '2027-02-18');
});
test('picker prioritizes slow and frequently missed Learning facts and defers Almost facts seen today', () => {
  const p = createProfile('A'); const bank = factBank('addition', 5);
  for (const f of bank) p.facts[f.factKey] = { ...emptyFactStat(date(20)), attempts: 10, correct: 10, firstKeyMs: [100] };
  p.facts[bank[3].factKey].firstKeyMs = [4000]; p.facts[bank[4].factKey].correct = 0; p.facts[bank[4].factKey].firstKeyMs = [3000];
  p.facts[bank[0].factKey].cleanDays = 2; p.facts[bank[0].factKey].lastSeenDate = '2026-10-21';
  const s = selectSet(getLevel('addition-5'), p, date(), () => .5);
  assert.equal(s.facts[0].factKey, bank[4].factKey); assert.equal(s.facts[1].factKey, bank[3].factKey); assert.ok(!s.facts.some(f => f.factKey === bank[0].factKey));
});
test('age thirteen and the inclusive recall boundary use the intended defaults', () => {
  assert.equal(recallBar(createProfile('A', 'sun', undefined, 2013), date()), 2000); assert.equal(recallBar(createProfile('A', 'sun', undefined, 2014), date()), 3000);
  const atBar = answer(createProfile('A'), undefined, 21, { firstKeyMs: 3000 }); assert.equal(atBar.facts['addition:3:4'].cleanDays, 3);
  const beyond = answer(createProfile('A'), undefined, 21, { firstKeyMs: 3001 }); assert.equal(beyond.facts['addition:3:4'].cleanDays, 0);
});
