import { getLevels, WORLDS, type Mode, type Session } from './game';

export const AVATARS = [
  { id: 'sun', emoji: '☀️', label: 'Sunny' },
  { id: 'fox', emoji: '🦊', label: 'Fox' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'planet', emoji: '🪐', label: 'Planet' },
  { id: 'sprout', emoji: '🌱', label: 'Sprout' },
  { id: 'bolt', emoji: '⚡', label: 'Spark' },
  { id: 'dino', emoji: '🦖', label: 'Dino' },
] as const;

export const PROFILE_COLORS = ['#B7DED1', '#F6BF86', '#B8D6F0', '#D0C4EB'];

export interface LevelProgress {
  learn: boolean;
  speed: boolean;
  mastery: boolean;
  bestCorrect: number;
  /** Fastest successful 60-card mastery run; null until mastery is passed. */
  bestTimeMs: number | null;
  attempts: number;
}

export interface RunRecord {
  id: string;
  levelId: string;
  mode: Mode;
  answered: number;
  correct: number;
  mistakes: number;
  elapsedMs: number;
  passed: boolean;
  createdAt: string;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  color: string;
  createdAt: string;
  progress: Record<string, LevelProgress>;
  /** Most recent run first. */
  history: RunRecord[];
}

export interface AppState {
  profiles: Profile[];
  activeProfileId: string | null;
  sound: boolean;
  haptics: boolean;
}

const MODES: Mode[] = ['learn', 'speed', 'mastery'];
const MAX_HISTORY = 100;

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyProgress(): LevelProgress {
  return { learn: false, speed: false, mastery: false, bestCorrect: 0, bestTimeMs: null, attempts: 0 };
}

export function createProfile(
  name: string,
  avatar = 'sun',
  color = PROFILE_COLORS[0],
): Profile {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 20) {
    throw new RangeError('Choose a player name with 1–20 characters.');
  }
  return {
    id: newId('player'),
    name: trimmed,
    avatar: AVATARS.some((option) => option.id === avatar) ? avatar : 'sun',
    color: PROFILE_COLORS.includes(color) ? color : PROFILE_COLORS[0],
    createdAt: new Date().toISOString(),
    progress: {},
    history: [],
  };
}

export function createDefaultState(): AppState {
  const firstPlayer = createProfile('Player 1');
  return { profiles: [firstPlayer], activeProfileId: firstPlayer.id, sound: true, haptics: true };
}

export function getActiveProfile(state: AppState): Profile | null {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) ?? state.profiles[0] ?? null;
}

export function addProfile(state: AppState, name: string, avatar?: string, color?: string): AppState {
  const profile = createProfile(name, avatar, color);
  return { ...state, profiles: [...state.profiles, profile], activeProfileId: profile.id };
}

export function selectProfile(state: AppState, id: string): AppState {
  return state.profiles.some((profile) => profile.id === id) ? { ...state, activeProfileId: id } : state;
}

export function deleteProfile(state: AppState, id: string): AppState {
  if (!state.profiles.some((profile) => profile.id === id)) return state;
  const profiles = state.profiles.filter((profile) => profile.id !== id);
  if (profiles.length === 0) {
    const replacement = createProfile('Player 1');
    return { ...state, profiles: [replacement], activeProfileId: replacement.id };
  }
  return {
    ...state,
    profiles,
    activeProfileId: state.activeProfileId === id ? profiles[0].id : state.activeProfileId,
  };
}

export function recordSession(profile: Profile, session: Session): Profile {
  if (session.status === 'playing') return profile;
  if (profile.history.some((run) => run.id === session.id)) return profile;

  const previous = profile.progress[session.level.id] ?? emptyProgress();
  const passed = session.status === 'passed';
  const masteryTime = passed && session.mode === 'mastery' ? session.elapsedMs : null;
  const next: LevelProgress = {
    ...previous,
    [session.mode]: previous[session.mode] || passed,
    bestCorrect: Math.max(previous.bestCorrect, session.correct),
    bestTimeMs: masteryTime === null
      ? previous.bestTimeMs
      : Math.min(previous.bestTimeMs ?? masteryTime, masteryTime),
    attempts: previous.attempts + 1,
  };
  const run: RunRecord = {
    id: session.id,
    levelId: session.level.id,
    mode: session.mode,
    answered: session.answered,
    correct: session.correct,
    mistakes: session.mistakes,
    elapsedMs: session.elapsedMs,
    passed,
    createdAt: new Date().toISOString(),
  };
  return {
    ...profile,
    progress: { ...profile.progress, [session.level.id]: next },
    history: [run, ...profile.history].slice(0, MAX_HISTORY),
  };
}

/** Highest world earned through mastery. Practice remains available in every world. */
export function unlockedWorldIndex(profile: Profile): number {
  let unlocked = 0;
  for (let index = 0; index < WORLDS.length - 1; index += 1) {
    const mastered = getLevels(WORLDS[index].id).every((level) => profile.progress[level.id]?.mastery);
    if (!mastered) break;
    unlocked = index + 1;
  }
  return unlocked;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, maximum)
    : 0;
}

function duration(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function dateString(value: unknown): string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : new Date().toISOString();
}

function isLevelId(value: string): boolean {
  return WORLDS.some((world) => getLevels(world.id).some((level) => level.id === value));
}

function restoreProgress(value: unknown): Record<string, LevelProgress> {
  const progress: Record<string, LevelProgress> = {};
  if (!isObject(value)) return progress;
  for (const [levelId, saved] of Object.entries(value)) {
    if (!isLevelId(levelId) || !isObject(saved)) continue;
    progress[levelId] = {
      learn: saved.learn === true,
      speed: saved.speed === true,
      mastery: saved.mastery === true,
      bestCorrect: count(saved.bestCorrect, 60),
      bestTimeMs: duration(saved.bestTimeMs),
      attempts: count(saved.attempts),
    };
  }
  return progress;
}

function restoreHistory(value: unknown): RunRecord[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const history: RunRecord[] = [];
  for (const saved of value) {
    if (!isObject(saved)
      || typeof saved.id !== 'string' || !saved.id || ids.has(saved.id)
      || typeof saved.levelId !== 'string' || !isLevelId(saved.levelId)
      || !MODES.includes(saved.mode as Mode)) continue;
    const answered = count(saved.answered, 60);
    const correct = count(saved.correct, answered);
    history.push({
      id: saved.id,
      levelId: saved.levelId,
      mode: saved.mode as Mode,
      answered,
      correct,
      mistakes: count(saved.mistakes, answered - correct),
      elapsedMs: duration(saved.elapsedMs) ?? 0,
      passed: saved.passed === true,
      createdAt: dateString(saved.createdAt),
    });
    ids.add(saved.id);
    if (history.length === MAX_HISTORY) break;
  }
  return history;
}

/** Restore only known, well-formed fields; old or damaged local data cannot crash startup. */
export function sanitizeState(value: unknown): AppState {
  if (!isObject(value) || !Array.isArray(value.profiles)) return createDefaultState();
  const profiles: Profile[] = [];
  const ids = new Set<string>();
  for (const saved of value.profiles) {
    if (!isObject(saved)
      || typeof saved.id !== 'string' || !saved.id || ids.has(saved.id)
      || typeof saved.name !== 'string' || !saved.name.trim()) continue;
    const avatar = typeof saved.avatar === 'string' && AVATARS.some((option) => option.id === saved.avatar)
      ? saved.avatar : 'sun';
    const color = typeof saved.color === 'string' && PROFILE_COLORS.includes(saved.color)
      ? saved.color : PROFILE_COLORS[0];
    profiles.push({
      id: saved.id,
      name: saved.name.trim().slice(0, 20),
      avatar,
      color,
      createdAt: dateString(saved.createdAt),
      progress: restoreProgress(saved.progress),
      history: restoreHistory(saved.history),
    });
    ids.add(saved.id);
  }
  if (!profiles.length) {
    const defaultState = createDefaultState();
    return { ...defaultState, sound: value.sound !== false, haptics: value.haptics !== false };
  }
  return {
    profiles,
    activeProfileId: typeof value.activeProfileId === 'string' && ids.has(value.activeProfileId)
      ? value.activeProfileId : profiles[0].id,
    sound: value.sound !== false,
    haptics: value.haptics !== false,
  };
}
