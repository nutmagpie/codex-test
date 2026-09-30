import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Keep CLI state inside the project: cloud HOME may be read-only.
const require = createRequire(import.meta.url);
const expoHome = resolve('.expo', 'home');
mkdirSync(expoHome, { recursive: true });
const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_NO_TELEMETRY: '1', __UNSAFE_EXPO_HOME_DIRECTORY: expoHome },
});
child.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
