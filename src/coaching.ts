import { Answer, Fact, factFromKey, Session } from './game';
import { Profile, practiceStreak, sessionRecord } from './profileModel';
import { median, stateOf } from './recall';

export function factLabel(f: Fact): string { return `${f.left} ${f.symbol} ${f.right}`; }
/** Exact, deterministic strategies, using the fact's source coordinates. */
export function strategy(f: Fact): string {
  const { a, b, answer } = f;
  if (f.operation === 'addition') {
    if (a === b) return `Double ${a}: ${a} + ${a} = ${answer}.`;
    const high = Math.max(a, b); const low = Math.min(a, b);
    if (high < 10 && answer >= 10) { const toTen = 10 - high; return `Make 10: ${high} + ${toTen} = 10, then add ${low - toTen}. That’s ${answer}.`; }
    if (high >= 10) return `Think 10 + ${low} = ${10 + low}, then add ${high - 10}. That’s ${answer}.`;
    return `Start at ${high} and count on ${low}. That’s ${answer}.`;
  }
  if (f.operation === 'subtraction') return `Think ${b} + what makes ${f.left}? ${b} + ${a} = ${f.left}, so ${factLabel(f)} = ${answer}.`;
  if (f.operation === 'division') return `Think ${b} × what makes ${f.left}? ${b} × ${a} = ${f.left}, so ${factLabel(f)} = ${answer}.`;
  if (a === 1 || b === 1) return `One group of ${Math.max(a, b)} is ${answer}.`;
  const groups = Math.min(a, b); const size = Math.max(a, b);
  if (a === 9 || b === 9) { const other = a === 9 ? b : a; return `Think 10 × ${other} = ${10 * other}, then take away one ${other}. That’s ${answer}.`; }
  if (a === 10 || b === 10) return `Ten groups of ${a === 10 ? b : a} make ${answer}.`;
  if (a > 10 || b > 10) { const high = Math.max(a, b); const other = Math.min(a, b); return `Think 10 × ${other} = ${10 * other}, plus ${high - 10} × ${other} = ${(high - 10) * other}. That’s ${answer}.`; }
  if (groups > 10) return `Think 10 × ${size} = ${10 * size}, plus ${groups - 10} × ${size} = ${(groups - 10) * size}. That’s ${answer}.`;
  if (groups > 5) return `Think 5 × ${size} = ${5 * size}, plus ${groups - 5} × ${size} = ${(groups - 5) * size}. That’s ${answer}.`;
  if (groups === 5) return `Think 10 × ${size} = ${10 * size}, then take half. That’s ${answer}.`;
  if (groups === 4) return `Double ${size} to get ${2 * size}, then double again. That’s ${answer}.`;
  if (groups === 3) return `Think 2 × ${size} = ${2 * size}, plus one more ${size}. That’s ${answer}.`;
  return `Double ${size}: ${size} + ${size} = ${answer}.`;
}
export function coachingLine(session: Session): string | null {
  const misses = session.answers.filter(a => !a.correct);
  const accuracy = session.answers.filter(a => a.correct).length / Math.max(1, session.answers.length);
  const missMedian = median(misses.filter(a => a.firstKeyMs <= 20_000).map(a => a.firstKeyMs));
  if (accuracy < .9 && missMedian !== null && missMedian < session.recallBarMs) {
    const fast = misses.filter(a => a.firstKeyMs < session.recallBarMs).length;
    return `Accuracy first. You were quick, and ${fast} of your misses came fast. Slow down a little and get them right; speed comes next.`;
  }
  const time = sessionRecord(session).medianMs;
  if (accuracy >= .95 && time !== null && time > session.recallBarMs) return `${accuracy === 1 ? 'Every answer right.' : 'Almost every answer right.'} Now see if you can go a little faster.`;
  return null;
}
export interface SetWin { title: string; facts: Fact[] }
export function setWin(session: Session, before: Profile, after: Profile, now = new Date()): SetWin | null {
  if (session.practiceMissed) return null;
  const newFacts = [...new Set(session.answers.map(a => a.factKey))].filter(key => stateOf(before.facts[key]) !== 'by-heart' && stateOf(after.facts[key]) === 'by-heart').map(key => factFromKey(key)!);
  if (newFacts.length) return { title: session.showWhatYouKnow ? `You already know ${newFacts.length} ${newFacts.length === 1 ? 'fact' : 'facts'} by heart.` : 'New facts you know by heart', facts: newFacts };
  const faster = session.answers.find(a => {
    const prior = median(before.facts[a.factKey]?.firstKeyMs ?? []);
    return a.correct && !a.usedBackspace && a.firstKeyMs <= 20_000 && prior !== null && prior - a.firstKeyMs >= 300 && a.firstKeyMs <= prior * .7;
  });
  if (faster) return { title: 'That fact came back much faster.', facts: [faster.question] };
  if (session.answers.every(a => a.correct) && !before.history.some(r => !r.practiceMissed && r.correct === r.answered)) return { title: 'Your first perfect set.', facts: [] };
  const streak = practiceStreak(after.history, now);
  return streak >= 2 ? { title: `${streak} days of practice in a row.`, facts: [] } : null;
}
export function eligibleTiming(answer: Answer): boolean { return answer.firstKeyMs <= 20_000; }
