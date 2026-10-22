/** Canonical arithmetic facts and the untimed set engine. */
export type Operation = 'addition' | 'subtraction' | 'multiplication' | 'division';
export type WorldId = Operation | 'add-subtract' | 'multiply-divide' | 'all';
export const OPERATIONS: Operation[] = ['addition', 'subtraction', 'multiplication', 'division'];
export const SYMBOLS: Record<Operation, string> = { addition: '+', subtraction: '−', multiplication: '×', division: '÷' };
export interface World { id: WorldId; name: string; subtitle: string; symbol: string; color: string; operations: Operation[] }
export const WORLDS: World[] = [
  { id: 'addition', name: 'Addition', subtitle: 'Little sums. A strong beginning.', symbol: '+', color: '#B5ECC5', operations: ['addition'] },
  { id: 'subtraction', name: 'Subtraction', subtitle: 'Find the difference. Feel the progress.', symbol: '−', color: '#AADAEF', operations: ['subtraction'] },
  { id: 'add-subtract', name: 'Addition & subtraction', subtitle: 'Switch it up. Keep your rhythm.', symbol: '±', color: '#C8BBF3', operations: ['addition', 'subtraction'] },
  { id: 'multiplication', name: 'Multiplication', subtitle: 'Make your times tables second nature.', symbol: '×', color: '#F4CE92', operations: ['multiplication'] },
  { id: 'division', name: 'Division', subtitle: 'Break it down. Build it up.', symbol: '÷', color: '#F4B6B0', operations: ['division'] },
  { id: 'multiply-divide', name: 'Multiplication & division', subtitle: 'Two operations. One smooth flow.', symbol: '×÷', color: '#A9DDD6', operations: ['multiplication', 'division'] },
  { id: 'all', name: 'All four operations', subtitle: 'Bring it all together.', symbol: '✦', color: '#D9D9F0', operations: ['addition', 'subtraction', 'multiplication', 'division'] },
];
export const RANGES = [5, 10, 12] as const;
export type NumberRange = (typeof RANGES)[number];
export interface Level { id: string; worldId: WorldId; range: NumberRange; name: string }
export function getLevels(worldId: WorldId): Level[] {
  if (!WORLDS.some(w => w.id === worldId)) throw new Error(`Unknown world: ${worldId}`);
  return RANGES.map(range => ({ id: `${worldId}-${range}`, worldId, range, name: `Numbers 1–${range}` }));
}
export function getLevel(id: string): Level {
  const level = WORLDS.flatMap(w => getLevels(w.id)).find(l => l.id === id);
  if (!level) throw new Error(`Unknown level: ${id}`);
  return level;
}
export interface Fact {
  factKey: string; operation: Operation; a: number; b: number;
  left: number; right: number; answer: number; symbol: string;
}
/** Grid coordinates are the two positive source numbers for every operation. */
export function makeFact(operation: Operation, a: number, b: number): Fact {
  if (!OPERATIONS.includes(operation) || !Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1 || a > 12 || b > 12) throw new RangeError('Unknown fact.');
  return { factKey: `${operation}:${a}:${b}`, operation, a, b,
    left: operation === 'division' ? a * b : operation === 'subtraction' ? a + b : a,
    right: b, answer: operation === 'addition' ? a + b : operation === 'multiplication' ? a * b : a,
    symbol: SYMBOLS[operation] };
}
export function factFromKey(key: string): Fact | null {
  const [operation, a, b, extra] = key.split(':');
  if (extra !== undefined || !OPERATIONS.includes(operation as Operation)) return null;
  try { const f = makeFact(operation as Operation, Number(a), Number(b)); return f.factKey === key ? f : null; } catch { return null; }
}
export function factBank(operation: Operation, range: NumberRange = 12): Fact[] {
  return Array.from({ length: range }, (_, a) => Array.from({ length: range }, (_, b) => makeFact(operation, a + 1, b + 1))).flat();
}
export interface Question extends Fact { id: string }
export interface CreditContext { firstSight: boolean; creditEligible: boolean; creditDate: string; recallBarMs: number }
export interface Answer extends CreditContext {
  question: Question; factKey: string; value: number; correct: boolean;
  firstKeyMs: number; submitMs: number; usedBackspace: boolean; answeredAt: string;
  typedValue?: string;
}
export interface SetSelection { facts: Fact[]; showWhatYouKnow: boolean; practiceMissed: boolean }
export interface Session {
  id: string; level: Level; questions: Question[]; answers: Answer[]; index: number;
  status: 'playing' | 'complete'; elapsedMs: number; startedAt: string;
  showWhatYouKnow: boolean; practiceMissed: boolean; recallBarMs: number;
}
let sequence = 0;
export function createSession(level: Level, selection: SetSelection, recallBarMs: number, now = new Date()): Session {
  if (!selection.facts.length) throw new Error('A set needs at least one fact.');
  const id = `set-${now.getTime().toString(36)}-${sequence++}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, level, questions: selection.facts.map((f, i) => ({ ...f, id: `${id}:${i}` })), answers: [], index: 0, status: 'playing', elapsedMs: 0,
    startedAt: now.toISOString(), showWhatYouKnow: selection.showWhatYouKnow, practiceMissed: selection.practiceMissed, recallBarMs };
}
export function expectedDigits(question: Pick<Fact, 'answer'>): number { return String(question.answer).length; }
export function submitAnswer(session: Session, value: number, timing: { firstKeyMs: number; submitMs: number; usedBackspace: boolean; typedValue?: string }, credit: CreditContext, now = new Date()): Session {
  if (session.status !== 'playing') return session;
  if (!Number.isSafeInteger(value) || value < 0 || !Number.isFinite(timing.firstKeyMs) || timing.firstKeyMs < 0 || !Number.isFinite(timing.submitMs) || timing.submitMs < timing.firstKeyMs) throw new RangeError('Invalid answer.');
  const question = session.questions[session.index];
  const answer: Answer = { question, factKey: question.factKey, value, correct: value === question.answer, ...timing, typedValue: timing.typedValue ?? String(value), ...credit, answeredAt: now.toISOString() };
  const index = session.index + 1;
  return { ...session, index, answers: [...session.answers, answer], recallBarMs: credit.recallBarMs, elapsedMs: session.elapsedMs + (timing.firstKeyMs <= 20_000 ? timing.submitMs : 0), status: index === session.questions.length ? 'complete' : 'playing' };
}
export function missedAnswers(session: Session): Answer[] { return session.answers.filter(a => !a.correct); }
