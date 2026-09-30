import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDefaultState, sanitizeState, type AppState } from './profileModel';

export * from './profileModel';

const STORAGE_KEY = '@60-in-60/profiles/v1';
let writes: Promise<void> = Promise.resolve();
let storageReadable = true;

export async function loadState(): Promise<AppState> {
  await writes.catch(() => undefined);
  let saved: string | null;
  try {
    saved = await AsyncStorage.getItem(STORAGE_KEY);
    storageReadable = true;
  } catch {
    // Let the app run, but do not replace inaccessible saved profiles with a default.
    storageReadable = false;
    return createDefaultState();
  }
  if (!saved) return createDefaultState();
  try {
    return sanitizeState(JSON.parse(saved));
  } catch {
    return createDefaultState();
  }
}

/** Queue immutable snapshots so slow storage writes cannot overwrite newer progress. */
export function saveState(state: AppState): Promise<void> {
  if (!storageReadable) {
    return Promise.reject(new Error('Saved players could not be read. Reload before saving new progress.'));
  }
  const snapshot = JSON.stringify(state);
  writes = writes.catch(() => undefined).then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot));
  return writes;
}
