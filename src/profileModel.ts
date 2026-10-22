import { factFromKey, getLevel, OPERATIONS, RANGES, Session } from './game';
import { Calibration, deriveTrophies, emptyCalibration, FactStat, localDay, median, RecallData } from './recall';

export const AVATARS = [
  { id: 'sun', emoji: '☀️', label: 'Sunny' }, { id: 'fox', emoji: '🦊', label: 'Fox' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' }, { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'planet', emoji: '🪐', label: 'Planet' }, { id: 'sprout', emoji: '🌱', label: 'Sprout' },
  { id: 'bolt', emoji: '⚡', label: 'Spark' }, { id: 'dino', emoji: '🦖', label: 'Dino' },
] as const;
export const PROFILE_COLORS = ['#B7DED1', '#F6BF86', '#B8D6F0', '#D0C4EB'];
export interface RunRecord {
  id: string; levelId: string; answered: number; correct: number; elapsedMs: number;
  medianMs: number | null; practiceMissed: boolean; showWhatYouKnow: boolean; createdAt: string;
}
export interface Profile extends RecallData {
  id: string; name: string; avatar: string; color: string; createdAt: string; history: RunRecord[];
}
export interface AppState { schemaVersion: 2; profiles: Profile[]; activeProfileId: string | null; sound: boolean; haptics: boolean }
export function validBirthYear(value: unknown, now = new Date()): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= now.getFullYear();
}
export function createProfile(name: string, avatar = 'sun', color = PROFILE_COLORS[0], birthYear: number | null = null): Profile {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 20) throw new RangeError('Choose a player name with 1–20 characters.');
  if (birthYear !== null && !validBirthYear(birthYear)) throw new RangeError('Choose a valid birth year.');
  return { id: `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`, name: trimmed,
    avatar: AVATARS.some(a => a.id === avatar) ? avatar : 'sun', color: PROFILE_COLORS.includes(color) ? color : PROFILE_COLORS[0],
    createdAt: new Date().toISOString(), birthYear, facts: {}, calibration: emptyCalibration(), earnedTrophies: [], history: [] };
}
export function createDefaultState(): AppState {
  const first = createProfile('Player 1'); return { schemaVersion: 2, profiles: [first], activeProfileId: first.id, sound: true, haptics: true };
}
export function getActiveProfile(state: AppState): Profile | null { return state.profiles.find(p => p.id === state.activeProfileId) ?? state.profiles[0] ?? null; }
export function addProfile(state: AppState, name: string, avatar?: string, color?: string, birthYear: number | null = null): AppState {
  const profile = createProfile(name, avatar, color, birthYear); return { ...state, profiles: [...state.profiles, profile], activeProfileId: profile.id };
}
export function selectProfile(state: AppState, id: string): AppState { return state.profiles.some(p => p.id === id) ? { ...state, activeProfileId: id } : state; }
export function deleteProfile(state: AppState, id: string): AppState {
  if (!state.profiles.some(p => p.id === id)) return state;
  const profiles = state.profiles.filter(p => p.id !== id);
  if (!profiles.length) { const first = createProfile('Player 1'); return { ...state, profiles: [first], activeProfileId: first.id }; }
  return { ...state, profiles, activeProfileId: state.activeProfileId === id ? profiles[0].id : state.activeProfileId };
}
export function sessionRecord(session: Session, now = new Date()): RunRecord {
  return { id: session.id, levelId: session.level.id, answered: session.answers.length, correct: session.answers.filter(a => a.correct).length,
    elapsedMs: session.elapsedMs, medianMs: median(session.answers.filter(a => a.firstKeyMs <= 20_000).map(a => a.firstKeyMs)),
    practiceMissed: session.practiceMissed, showWhatYouKnow: session.showWhatYouKnow, createdAt: now.toISOString() };
}
export function recordSession(profile: Profile, session: Session, now = new Date()): Profile {
  if (session.status !== 'complete' || profile.history.some(r => r.id === session.id)) return profile;
  return { ...profile, history: [sessionRecord(session, now), ...profile.history].slice(0, 100) };
}
export function practiceStreak(history: RunRecord[], now = new Date()): number {
  const days = new Set(history.filter(r => !r.practiceMissed).map(r => localDay(new Date(r.createdAt))));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(localDay(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); }
  return count;
}

function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? Math.min(value, max) : 0; }
function ms(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null; }
function iso(value: unknown): string | null { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
function day(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`); return Number.isFinite(date.getTime()) && localDay(date) === value ? value : null;
}
function samples(value: unknown): number[] { return Array.isArray(value) ? value.filter((n): n is number => ms(n) !== null && (n as number) <= 20_000) : []; }
function restoreFacts(value: unknown): Record<string, FactStat> {
  const facts: Record<string, FactStat> = {};
  if (!object(value)) return facts;
  for (const [key, saved] of Object.entries(value)) {
    if (!factFromKey(key) || !object(saved) || !iso(saved.firstSeen)) continue;
    const cleanDays = integer(saved.cleanDays, 3);
    facts[key] = { attempts: integer(saved.attempts), correct: integer(saved.correct, integer(saved.attempts)),
      firstSeen: iso(saved.firstSeen)!, lastSeenDate: day(saved.lastSeenDate) ?? localDay(new Date(iso(saved.firstSeen)!)),
      lastCreditDate: day(saved.lastCreditDate), cleanDays, creditedOnFirstSight: saved.creditedOnFirstSight === true,
      nextReviewDate: cleanDays === 3 ? day(saved.nextReviewDate) ?? day(saved.lastCreditDate) ?? localDay(new Date()) : null,
      reviewAnchorDate: cleanDays === 3 ? day(saved.reviewAnchorDate) ?? day(saved.lastCreditDate) ?? localDay(new Date(iso(saved.firstSeen)!)) : null,
      reviewStage: cleanDays === 3 ? integer(saved.reviewStage, 3) : 0, firstKeyMs: samples(saved.firstKeyMs).slice(-5) };
  }
  return facts;
}
function restoreCalibration(value: unknown): Calibration {
  const valid = object(value) ? samples(value.samples) : [];
  return { samples: valid, sampleCount: valid.length, medianMs: median(valid) };
}
function restoreHistory(value: unknown): RunRecord[] {
  if (!Array.isArray(value)) return [];
  const result: RunRecord[] = []; const ids = new Set<string>();
  for (const saved of value) {
    if (!object(saved) || typeof saved.id !== 'string' || !saved.id || ids.has(saved.id) || typeof saved.levelId !== 'string' || !iso(saved.createdAt)) continue;
    try { getLevel(saved.levelId); } catch { continue; }
    const answered = integer(saved.answered, 20); if (!answered) continue;
    result.push({ id: saved.id, levelId: saved.levelId, answered, correct: integer(saved.correct, answered), elapsedMs: ms(saved.elapsedMs) ?? 0,
      medianMs: ms(saved.medianMs), practiceMissed: saved.practiceMissed === true, showWhatYouKnow: saved.showWhatYouKnow === true, createdAt: iso(saved.createdAt)! });
    ids.add(saved.id); if (result.length === 100) break;
  }
  return result;
}
/** Version 1 timed progress is intentionally reset; player identities and settings survive. */
export function sanitizeState(value: unknown): AppState {
  if (!object(value) || !Array.isArray(value.profiles)) return createDefaultState();
  const profiles: Profile[] = []; const ids = new Set<string>(); const current = value.schemaVersion === 2;
  const trophyIds = OPERATIONS.flatMap(op => RANGES.map(r => `${op}-${r}`));
  for (const saved of value.profiles) {
    if (!object(saved) || typeof saved.id !== 'string' || !saved.id || ids.has(saved.id) || typeof saved.name !== 'string' || !saved.name.trim()) continue;
    const facts = current ? restoreFacts(saved.facts) : {};
    const earned = current && Array.isArray(saved.earnedTrophies) ? saved.earnedTrophies.filter((v): v is string => typeof v === 'string' && trophyIds.includes(v)) : [];
    profiles.push({ id: saved.id, name: saved.name.trim().slice(0, 20), avatar: typeof saved.avatar === 'string' && AVATARS.some(a => a.id === saved.avatar) ? saved.avatar : 'sun',
      color: typeof saved.color === 'string' && PROFILE_COLORS.includes(saved.color) ? saved.color : PROFILE_COLORS[0], createdAt: iso(saved.createdAt) ?? new Date().toISOString(),
      birthYear: validBirthYear(saved.birthYear) ? saved.birthYear : null, facts, earnedTrophies: deriveTrophies(facts, earned), calibration: current ? restoreCalibration(saved.calibration) : emptyCalibration(), history: current ? restoreHistory(saved.history) : [] });
    ids.add(saved.id);
  }
  if (!profiles.length) return { ...createDefaultState(), sound: value.sound !== false, haptics: value.haptics !== false };
  return { schemaVersion: 2, profiles, activeProfileId: typeof value.activeProfileId === 'string' && ids.has(value.activeProfileId) ? value.activeProfileId : profiles[0].id, sound: value.sound !== false, haptics: value.haptics !== false };
}
