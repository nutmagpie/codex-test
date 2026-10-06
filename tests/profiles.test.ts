import assert from 'node:assert/strict';
import test from 'node:test';
import type { Mode, Session } from '../src/game';
import {
  addProfile,
  createDefaultState,
  createProfile,
  deleteProfile,
  getActiveProfile,
  recordSession,
  sanitizeState,
  selectProfile,
  unlockedWorldIndex,
} from '../src/profileModel';

function completedRun(mode: Mode = 'mastery', overrides: Partial<Session> = {}): Session {
  return {
    id: `test-${Math.random()}`,
    level: { id: 'addition-5', worldId: 'addition', range: 5, name: 'Numbers 1–5' },
    mode,
    questions: [],
    index: 60,
    answered: 60,
    correct: 58,
    mistakes: 2,
    hearts: 1,
    elapsedMs: 59000,
    status: 'passed',
    failureReason: null,
    lastAnswer: null,
    missedAnswers: [],
    ...overrides,
  };
}

test('fresh players have no fabricated achievements and validate their names', () => {
  const state = createDefaultState();
  assert.equal(getActiveProfile(state)?.name, 'Player 1');
  assert.deepEqual(getActiveProfile(state)?.progress, {});
  assert.deepEqual(getActiveProfile(state)?.history, []);
  assert.equal(unlockedWorldIndex(state.profiles[0]), 0);
  assert.equal(createProfile('  Jordan  ').name, 'Jordan');
  assert.throws(() => createProfile('   '), RangeError);
  assert.throws(() => createProfile('a'.repeat(21)), RangeError);
});

test('completed sessions retain success per mode without sharing progress between players', () => {
  const first = createProfile('Alex');
  const second = createProfile('Sam');
  const learn = recordSession(first, completedRun('learn', {
    answered: 20, correct: 20, mistakes: 0, elapsedMs: 92000,
  }));
  assert.equal(learn.progress['addition-5'].learn, true);
  assert.equal(learn.progress['addition-5'].speed, false);
  assert.equal(learn.progress['addition-5'].mastery, false);
  assert.equal(learn.progress['addition-5'].bestTimeMs, null);

  const mastered = recordSession(learn, completedRun());
  const failedLater = recordSession(mastered, completedRun('mastery', {
    status: 'failed', correct: 5, answered: 8, mistakes: 3, failureReason: 'hearts', elapsedMs: 5000,
  }));
  assert.equal(failedLater.progress['addition-5'].learn, true);
  assert.equal(failedLater.progress['addition-5'].mastery, true);
  assert.equal(failedLater.progress['addition-5'].bestTimeMs, 59000);
  assert.equal(failedLater.progress['addition-5'].bestCorrect, 58);
  assert.equal(failedLater.progress['addition-5'].attempts, 3);
  assert.equal(failedLater.history[0].passed, false);
  assert.deepEqual(first.progress, {});
  assert.deepEqual(second.progress, {});
});

test('active and duplicate completions never increase attempt counts', () => {
  const profile = createProfile('Alex');
  const active = completedRun('mastery', { status: 'playing' });
  assert.equal(recordSession(profile, active), profile);
  const run = completedRun();
  const finished = recordSession(profile, run);
  assert.equal(recordSession(finished, run), finished);
  assert.equal(finished.progress['addition-5'].attempts, 1);
});

test('best mastery time improves while history stays bounded', () => {
  let profile = recordSession(createProfile('Alex'), completedRun());
  profile = recordSession(profile, completedRun('mastery', { elapsedMs: 54000, correct: 60, mistakes: 0 }));
  for (let index = 0; index < 110; index += 1) {
    profile = recordSession(profile, completedRun('mastery', { id: `run-${index}` }));
  }
  assert.equal(profile.history.length, 100);
  assert.equal(profile.history[0].id, 'run-109');
  assert.equal(profile.progress['addition-5'].attempts, 112);
  assert.equal(profile.progress['addition-5'].bestCorrect, 60);
  assert.equal(profile.progress['addition-5'].bestTimeMs, 54000);
});

test('world advancement requires every range in the preceding worlds', () => {
  let profile = createProfile('Alex');
  for (const range of [5, 10] as const) {
    profile = recordSession(profile, completedRun('mastery', {
      level: { id: `addition-${range}`, worldId: 'addition', range, name: `Numbers 1–${range}` },
    }));
  }
  assert.equal(unlockedWorldIndex(profile), 0);
  profile = recordSession(profile, completedRun('mastery', {
    level: { id: 'addition-12', worldId: 'addition', range: 12, name: 'Numbers 1–12' },
  }));
  assert.equal(unlockedWorldIndex(profile), 1);
  for (const range of [5, 10, 12] as const) {
    profile = recordSession(profile, completedRun('mastery', {
      level: { id: `multiplication-${range}`, worldId: 'multiplication', range, name: `Numbers 1–${range}` },
    }));
  }
  assert.equal(unlockedWorldIndex(profile), 1);
});

test('players can be added, selected, and deleted without leaking achievements', () => {
  let state = createDefaultState();
  const originalId = state.activeProfileId!;
  state = addProfile(state, 'Sam', 'fox');
  const secondId = state.activeProfileId!;
  assert.equal(state.profiles.length, 2);
  assert.equal(getActiveProfile(state)?.name, 'Sam');
  assert.equal(getActiveProfile(state)?.avatar, 'fox');
  state = selectProfile(state, originalId);
  assert.equal(getActiveProfile(state)?.name, 'Player 1');
  assert.equal(selectProfile(state, 'missing'), state);
  state = deleteProfile(state, originalId);
  assert.equal(state.activeProfileId, secondId);
  state = deleteProfile(state, secondId);
  assert.equal(state.profiles.length, 1);
  assert.equal(getActiveProfile(state)?.name, 'Player 1');
  assert.deepEqual(getActiveProfile(state)?.progress, {});
});

test('saved profiles round trip with settings and separate progress intact', () => {
  let state = addProfile(createDefaultState(), 'Taylor', 'rocket');
  state.profiles[1] = recordSession(state.profiles[1], completedRun());
  state.sound = false;
  const restored = sanitizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  assert.deepEqual(restored.profiles[0].progress, {});
});

test('malformed local data is repaired without claiming invalid achievements', () => {
  for (const invalid of [null, [], {}, 'bad', { profiles: [null, {}, { id: 'x', name: '  ' }] }]) {
    const restored = sanitizeState(invalid);
    assert.equal(restored.profiles.length, 1);
    assert.deepEqual(restored.profiles[0].progress, {});
  }
  const restored = sanitizeState({
    profiles: [{
      id: 'player-a', name: '  Alex  ', avatar: 'bad', color: 'url(untrusted)',
      progress: {
        'addition-5': { learn: 'true', speed: true, mastery: false, bestCorrect: 999, bestTimeMs: -10, attempts: NaN },
        'unknown-level': { mastery: true },
        'subtraction-5': null,
      },
      history: [null, {}, { id: 'invalid', levelId: 'addition-5', mode: 'bogus' }],
    }, { id: 'player-a', name: 'Duplicate' }],
    activeProfileId: 'missing', sound: false, haptics: 'false',
  });
  assert.equal(restored.profiles.length, 1);
  assert.equal(restored.activeProfileId, 'player-a');
  assert.equal(restored.profiles[0].name, 'Alex');
  assert.equal(restored.profiles[0].avatar, 'sun');
  assert.deepEqual(Object.keys(restored.profiles[0].progress), ['addition-5']);
  assert.equal(restored.profiles[0].progress['addition-5'].learn, false);
  assert.equal(restored.profiles[0].progress['addition-5'].speed, true);
  assert.equal(restored.profiles[0].progress['addition-5'].bestCorrect, 60);
  assert.equal(restored.profiles[0].progress['addition-5'].bestTimeMs, null);
  assert.equal(restored.profiles[0].progress['addition-5'].attempts, 0);
  assert.deepEqual(restored.profiles[0].history, []);
  assert.equal(restored.sound, false);
  assert.equal(restored.haptics, true);
});
