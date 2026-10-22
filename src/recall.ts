import { Answer, CreditContext, Fact, factBank, factFromKey, Level, NumberRange, OPERATIONS, Operation, RANGES, SetSelection, WORLDS } from './game';

export type RecallState = 'not-yet' | 'learning' | 'almost' | 'by-heart';
export interface FactStat {
  attempts: number; correct: number; firstSeen: string; lastSeenDate: string;
  lastCreditDate: string | null; cleanDays: number; creditedOnFirstSight: boolean;
  nextReviewDate: string | null; reviewAnchorDate: string | null; reviewStage: number; firstKeyMs: number[];
}
export interface Calibration { sampleCount: number; medianMs: number | null; samples: number[] }
export interface RecallData { facts: Record<string, FactStat>; earnedTrophies: string[]; calibration: Calibration; birthYear: number | null }
export const emptyCalibration = (): Calibration => ({ sampleCount: 0, medianMs: null, samples: [] });
export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b); const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
/** Local calendar dates, rather than elapsed 24-hour periods, survive DST changes. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number); const next = new Date(y, m - 1, d, 12); next.setDate(next.getDate() + days); return localDay(next);
}
export function ageFromBirthYear(year: number | null, now = new Date()): number | null { return year === null ? null : now.getFullYear() - year; }
export function recallBar(player: Pick<RecallData, 'birthYear' | 'calibration'>, now = new Date()): number {
  if (player.calibration.sampleCount >= 10 && player.calibration.medianMs !== null) return Math.min(3000, player.calibration.medianMs + 1000);
  const age = ageFromBirthYear(player.birthYear, now); return age === null || age < 13 ? 3000 : 2000;
}
export function stateOf(stat: FactStat | undefined): RecallState {
  return !stat ? 'not-yet' : stat.cleanDays >= 3 ? 'by-heart' : stat.cleanDays > 0 ? 'almost' : 'learning';
}
export function emptyFactStat(at: Date): FactStat {
  return { attempts: 0, correct: 0, firstSeen: at.toISOString(), lastSeenDate: localDay(at), lastCreditDate: null, cleanDays: 0, creditedOnFirstSight: false, nextReviewDate: null, reviewAnchorDate: null, reviewStage: 0, firstKeyMs: [] };
}
/** Mark the presentation, including abandoned cards, before an answer can earn credit. */
export function presentFact(data: RecallData, factKey: string, at: Date, practiceMissed: boolean): { data: RecallData; credit: CreditContext } {
  if (!factFromKey(factKey)) throw new Error('Unknown fact.');
  const previous = data.facts[factKey]; const day = localDay(at);
  const credit = { firstSight: !previous && !practiceMissed, creditEligible: !practiceMissed && previous?.lastSeenDate !== day, creditDate: day, recallBarMs: recallBar(data, at) };
  if (previous?.lastSeenDate === day) return { data, credit };
  return { data: { ...data, facts: { ...data.facts, [factKey]: previous ? { ...previous, lastSeenDate: day } : emptyFactStat(at) } }, credit };
}
export function isCalibrationFact(f: Fact): boolean {
  return (f.operation === 'addition' && (f.a === 1 || f.b === 1 || f.a === f.b)) || (f.operation === 'multiplication' && (f.a === 1 || f.b === 1));
}
export function cleanRecall(answer: Answer, barMs: number): boolean { return answer.correct && !answer.usedBackspace && answer.firstKeyMs <= barMs; }
const REVIEW_DAYS = [3, 7, 21, 60];
export function recordRecall(data: RecallData, answer: Answer, barMs: number): RecallData {
  const old = data.facts[answer.factKey] ?? emptyFactStat(new Date(answer.answeredAt));
  const day = answer.creditDate; const clean = cleanRecall(answer, barMs);
  const next: FactStat = { ...old, attempts: old.attempts + 1, correct: old.correct + Number(answer.correct),
    firstKeyMs: answer.firstKeyMs <= 20_000 ? [...old.firstKeyMs, answer.firstKeyMs].slice(-5) : old.firstKeyMs };
  if (old.cleanDays >= 3 && (!answer.correct || answer.firstKeyMs > barMs)) {
    next.cleanDays = 2; next.nextReviewDate = null; next.reviewAnchorDate = null; next.reviewStage = 0;
  } else if (clean && answer.creditEligible && old.lastCreditDate !== day) {
    next.cleanDays = answer.firstSight ? 3 : Math.min(3, old.cleanDays + 1);
    next.lastCreditDate = day;
    next.creditedOnFirstSight = old.creditedOnFirstSight || answer.firstSight;
    if (next.cleanDays >= 3) {
      if (old.cleanDays < 3) { next.reviewAnchorDate = day; next.reviewStage = 0; next.nextReviewDate = addDays(day, REVIEW_DAYS[0]); }
      else if (old.nextReviewDate && day >= old.nextReviewDate) {
        const anchor = old.reviewAnchorDate ?? old.lastCreditDate ?? day;
        let stage = Math.min(REVIEW_DAYS.length - 1, old.reviewStage + 1);
        // A late successful check-in skips milestones already in the past.
        while (stage < REVIEW_DAYS.length - 1 && addDays(anchor, REVIEW_DAYS[stage]) <= day) stage++;
        next.reviewAnchorDate = anchor; next.reviewStage = stage;
        const milestone = addDays(anchor, REVIEW_DAYS[stage]);
        next.nextReviewDate = milestone > day ? milestone : addDays(day, 60);
      }
    }
  }
  let calibration = data.calibration;
  if (answer.correct && answer.firstKeyMs <= 20_000 && isCalibrationFact(answer.question)) {
    const samples = [...calibration.samples, answer.firstKeyMs];
    calibration = { samples, sampleCount: samples.length, medianMs: median(samples) };
  }
  const facts = { ...data.facts, [answer.factKey]: next };
  return { ...data, facts, calibration, earnedTrophies: deriveTrophies(facts, data.earnedTrophies) };
}
export function knownCount(facts: Record<string, FactStat>, operations: Operation[] = OPERATIONS, range: NumberRange = 12): number {
  return operations.reduce((n, op) => n + factBank(op, range).filter(f => stateOf(facts[f.factKey]) === 'by-heart').length, 0);
}
/** Persist only the earned milestone; live counts always come from current fact states. */
export function deriveTrophies(facts: Record<string, FactStat>, previous: string[] = []): string[] {
  const earned = new Set(previous);
  for (const op of OPERATIONS) for (const r of RANGES) if (!earned.has(`${op}-${r}`) && knownCount(facts, [op], r) === r * r) earned.add(`${op}-${r}`);
  return [...earned];
}
export function rangeEarned(data: Pick<RecallData, 'earnedTrophies'>, operations: Operation[], range: NumberRange): boolean { return operations.every(op => data.earnedTrophies.includes(`${op}-${range}`)); }
export function easiestFirst(f: Fact): number {
  const rank = f.a === 1 || f.b === 1 ? 0 : f.a === 2 || f.b === 2 ? 1
    : (f.operation === 'multiplication' || f.operation === 'division') && (f.a === 10 || f.b === 10) ? 2
      : (f.operation === 'multiplication' || f.operation === 'division') && (f.a === 5 || f.b === 5) ? 3 : f.a === f.b ? 4 : 5;
  return rank * 10000 + (f.a + f.b) * 100 + f.a * 12 + f.b;
}
export function selectSet(level: Level, data: Pick<RecallData, 'facts'>, now = new Date(), rng: () => number = Math.random): SetSelection {
  const operations = WORLDS.find(w => w.id === level.worldId)!.operations;
  const bank = operations.flatMap(op => factBank(op, level.range)); const day = localDay(now);
  const selected: Fact[] = []; const used = new Set<string>(); const counts = new Map(operations.map(op => [op, 0]));
  const take = (candidates: Fact[], count: number) => {
    for (let n = 0; n < count && selected.length < 20; n++) {
      const available = candidates.filter(f => !used.has(f.factKey)); if (!available.length) break;
      const minimum = Math.min(...available.map(f => counts.get(f.operation)!));
      const f = available.find(f => counts.get(f.operation) === minimum)!;
      selected.push(f); used.add(f.factKey); counts.set(f.operation, counts.get(f.operation)! + 1);
    }
  };
  const unseen = bank.filter(f => !data.facts[f.factKey]).sort((a, b) => easiestFirst(a) - easiestFirst(b));
  const showWhatYouKnow = unseen.length > 0;
  // When fewer than 20 unseen facts remain, finish discovery and fill with review.
  if (showWhatYouKnow) take(unseen, 20);
  const tie = new Map(bank.map(f => [f.factKey, rng()]));
  const learningScore = (f: Fact) => { const s = data.facts[f.factKey]; return ((s.attempts - s.correct) / Math.max(1, s.attempts)) * 3000 + (median(s.firstKeyMs) ?? 0); };
  const learning = bank.filter(f => stateOf(data.facts[f.factKey]) === 'learning').sort((a, b) => learningScore(b) - learningScore(a) || tie.get(a.factKey)! - tie.get(b.factKey)!);
  const almost = bank.filter(f => stateOf(data.facts[f.factKey]) === 'almost' && data.facts[f.factKey].lastSeenDate !== day).sort((a, b) => data.facts[a.factKey].cleanDays - data.facts[b.factKey].cleanDays || tie.get(a.factKey)! - tie.get(b.factKey)!);
  const byHeart = bank.filter(f => stateOf(data.facts[f.factKey]) === 'by-heart').sort((a, b) => {
    const aDue = data.facts[a.factKey].nextReviewDate ?? '9999-12-31'; const bDue = data.facts[b.factKey].nextReviewDate ?? '9999-12-31';
    return Number(bDue <= day) - Number(aDue <= day) || aDue.localeCompare(bDue) || tie.get(a.factKey)! - tie.get(b.factKey)!;
  });
  const buckets = [learning, almost, byHeart, unseen];
  for (const [i, target] of [4, 8, 8].entries()) {
    const goal = Math.min(20, selected.length + target);
    for (let j = i; j < buckets.length && selected.length < goal; j++) take(buckets[j], goal - selected.length);
  }
  for (const bucket of [...buckets, bank]) take(bucket, 20 - selected.length);
  // Mixed worlds retain equal operation turns whenever there are enough eligible
  // candidates; discovery takes precedence when only one operation is still unseen.
  if (!showWhatYouKnow && operations.length > 1) {
    const perOp = 20 / operations.length;
    for (const op of operations) while (counts.get(op)! < perOp) {
      const replacement = [...buckets.flat(), ...bank].find(f => f.operation === op && !used.has(f.factKey));
      const replaceAt = selected.findLastIndex(f => counts.get(f.operation)! > perOp);
      if (!replacement || replaceAt < 0) break;
      const old = selected[replaceAt]; counts.set(old.operation, counts.get(old.operation)! - 1); used.delete(old.factKey);
      selected[replaceAt] = replacement; used.add(replacement.factKey); counts.set(op, counts.get(op)! + 1);
    }
  }
  return { facts: selected, showWhatYouKnow, practiceMissed: false };
}
export function practiceSelection(answers: Answer[]): SetSelection {
  const seen = new Set<string>();
  return { facts: answers.filter(a => !a.correct && !seen.has(a.factKey) && !!seen.add(a.factKey)).map(a => a.question), showWhatYouKnow: false, practiceMissed: true };
}
