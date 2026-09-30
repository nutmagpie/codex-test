/** Pure game rules shared by the mobile UI and its tests. */
export type Operation = 'addition' | 'subtraction' | 'multiplication' | 'division';
export type Mode = 'learn' | 'speed' | 'mastery';
export type WorldId = Operation | 'add-subtract' | 'multiply-divide' | 'all';

export interface World {
  id: WorldId;
  name: string;
  subtitle: string;
  symbol: string;
  color: string;
  operations: Operation[];
}

export const WORLDS: World[] = [
  { id: 'addition', name: 'Addition', subtitle: 'Small sums. Strong foundations.', symbol: '+', color: '#B5ECC5', operations: ['addition'] },
  { id: 'subtraction', name: 'Subtraction', subtitle: 'Make a little room for less.', symbol: '−', color: '#AADAEF', operations: ['subtraction'] },
  { id: 'add-subtract', name: 'Addition & subtraction', subtitle: 'Switch gears. Find your rhythm.', symbol: '±', color: '#C8BBF3', operations: ['addition', 'subtraction'] },
  { id: 'multiplication', name: 'Multiplication', subtitle: 'Little facts. Bigger possibilities.', symbol: '×', color: '#F4CE92', operations: ['multiplication'] },
  { id: 'division', name: 'Division', subtitle: 'Break it down, one fact at a time.', symbol: '÷', color: '#F4B6B0', operations: ['division'] },
  { id: 'multiply-divide', name: 'Multiplication & division', subtitle: 'Meet the other side of every fact.', symbol: '×÷', color: '#A9DDD6', operations: ['multiplication', 'division'] },
  { id: 'all', name: 'All four operations', subtitle: 'Your whole toolkit. One great run.', symbol: '✦', color: '#D9D9F0', operations: ['addition', 'subtraction', 'multiplication', 'division'] },
];

export const RANGES = [5, 10, 12] as const;
export type NumberRange = (typeof RANGES)[number];

export interface Level {
  id: string;
  worldId: WorldId;
  range: NumberRange;
  name: string;
}

export function getLevels(worldId: WorldId): Level[] {
  if (!WORLDS.some(world => world.id === worldId)) {
    throw new Error(`Unknown world: ${worldId}`);
  }
  return RANGES.map(range => ({ id: `${worldId}-${range}`, worldId, range, name: `Numbers 1–${range}` }));
}

export function getLevel(id: string): Level {
  for (const world of WORLDS) {
    const level = getLevels(world.id).find(candidate => candidate.id === id);
    if (level) return level;
  }
  throw new Error(`Unknown level: ${id}`);
}

export const MODES: Record<Mode, {
  name: string;
  tagline: string;
  description: string;
  cards: number;
  seconds: number | null;
}> = {
  learn: {
    name: 'Learn',
    tagline: 'Accuracy comes first',
    description: '20 cards, no clock. Take your time and get to know the facts.',
    cards: 20,
    seconds: null,
  },
  speed: {
    name: 'Speed',
    tagline: 'Find your flow',
    description: '30 cards in 45 seconds. A little pace, a lot of progress.',
    cards: 30,
    seconds: 45,
  },
  mastery: {
    name: 'Mastery',
    tagline: 'Make it your own',
    description: '60 cards in 60 seconds. Three hearts. One personal milestone.',
    cards: 60,
    seconds: 60,
  },
};

export interface Question {
  id: string;
  left: number;
  right: number;
  operation: Operation;
  answer: number;
  symbol: string;
}

type Fact = Omit<Question, 'id'>;
const SYMBOLS: Record<Operation, string> = { addition: '+', subtraction: '−', multiplication: '×', division: '÷' };

function makeBank(operation: Operation, range: NumberRange): Fact[] {
  const bank: Fact[] = [];
  for (let a = 1; a <= range; a++) {
    for (let b = 1; b <= range; b++) {
      if (operation === 'subtraction' && b > a) continue;
      const left = operation === 'division' ? a * b : a;
      const answer = operation === 'addition' ? a + b
        : operation === 'subtraction' ? a - b
        : operation === 'multiplication' ? a * b : a;
      bank.push({ left, right: b, operation, answer, symbol: SYMBOLS[operation] });
    }
  }
  return bank;
}

function shuffle<T>(values: T[], rng: () => number): T[] {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const random = rng();
    if (!Number.isFinite(random) || random < 0 || random >= 1) {
      throw new RangeError('The random source must return a number from 0 (inclusive) to 1 (exclusive).');
    }
    const j = Math.floor(random * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sameFact(first: Fact | undefined, second: Fact): boolean {
  return first?.operation === second.operation && first.left === second.left && first.right === second.right;
}

/**
 * Visit every fact in an operation before repeating it. Mixed worlds give each
 * operation the same number of turns (within one), with a shuffled turn order.
 */
export function generateQuestions(level: Level, count: number, rng: () => number = Math.random): Question[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError('The card count must be a nonnegative integer.');
  }
  const world = WORLDS.find(candidate => candidate.id === level.worldId);
  if (!world || !RANGES.includes(level.range)) throw new Error('Unknown level.');
  const banks = new Map(world.operations.map(operation => [operation, makeBank(operation, level.range)]));
  const remaining = new Map<Operation, Fact[]>();
  let operationTurns: Operation[] = [];
  const questions: Question[] = [];

  while (questions.length < count) {
    if (operationTurns.length === 0) operationTurns = shuffle(world.operations, rng);
    const operation = operationTurns.pop()!;
    let facts = remaining.get(operation);
    if (!facts?.length) {
      facts = shuffle(banks.get(operation)!, rng);
      remaining.set(operation, facts);
    }
    const previous = questions.at(-1);
    const lastIndex = facts.length - 1;
    if (sameFact(previous, facts[lastIndex])) {
      const differentIndex = facts.findIndex(fact => !sameFact(previous, fact));
      if (differentIndex >= 0) [facts[lastIndex], facts[differentIndex]] = [facts[differentIndex], facts[lastIndex]];
    }
    const fact = facts.pop()!;
    questions.push({ ...fact, id: `${level.id}:${questions.length}:${fact.operation}:${fact.left}:${fact.right}` });
  }
  return questions;
}

export interface Session {
  id: string;
  level: Level;
  mode: Mode;
  questions: Question[];
  index: number;
  answered: number;
  correct: number;
  mistakes: number;
  hearts: number;
  elapsedMs: number;
  status: 'playing' | 'passed' | 'failed';
  failureReason: 'hearts' | 'time' | null;
  lastAnswer: { question: Question; value: number; correct: boolean } | null;
}

let sessionSequence = 0;

export function createSession(level: Level, mode: Mode, rng: () => number = Math.random): Session {
  return {
    id: `run-${Date.now().toString(36)}-${(sessionSequence++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    mode,
    questions: generateQuestions(level, MODES[mode].cards, rng),
    index: 0,
    answered: 0,
    correct: 0,
    mistakes: 0,
    hearts: 3,
    elapsedMs: 0,
    status: 'playing',
    failureReason: null,
    lastAnswer: null,
  };
}

/** The number pad submits as soon as this many digits have been entered. */
export function expectedDigits(question: Question): number {
  return String(question.answer).length;
}

export function submitAnswer(session: Session, value: number): Session {
  if (session.status !== 'playing') return session;
  const question = session.questions[session.index];
  const correct = question.answer === value;
  const mistakes = session.mistakes + (correct ? 0 : 1);
  const answered = session.answered + 1;
  const outOfHearts = mistakes >= 3;
  const completed = answered === session.questions.length;
  return {
    ...session,
    index: session.index + 1,
    answered,
    correct: session.correct + (correct ? 1 : 0),
    mistakes,
    hearts: Math.max(0, 3 - mistakes),
    status: outOfHearts ? 'failed' : completed ? 'passed' : 'playing',
    failureReason: outOfHearts ? 'hearts' : null,
    lastAnswer: { question, value, correct },
  };
}

/** elapsedMs is the absolute run time; a delayed timer can never rewind a run. */
export function tickSession(session: Session, elapsedMs: number): Session {
  if (session.status !== 'playing') return session;
  if (!Number.isFinite(elapsedMs)) throw new RangeError('Elapsed time must be finite.');
  const nextElapsedMs = Math.max(session.elapsedMs, elapsedMs, 0);
  const seconds = MODES[session.mode].seconds;
  const outOfTime = seconds !== null && nextElapsedMs >= seconds * 1000;
  if (nextElapsedMs === session.elapsedMs && !outOfTime) return session;
  return {
    ...session,
    elapsedMs: nextElapsedMs,
    status: outOfTime ? 'failed' : 'playing',
    failureReason: outOfTime ? 'time' : null,
  };
}
