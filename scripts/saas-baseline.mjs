import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const directory = 'docs/EVOLUCAO_SAAS/logs';
mkdirSync(directory, { recursive: true });
const results = [];
for (const args of [['install', '--frozen-lockfile', '--offline'], ['lint'], ['typecheck'], ['test'], ['build'], ['test:e2e']]) {
  const command = `pnpm ${args.join(' ')}`;
  const result = spawnSync(command, { shell: true, encoding: 'utf8', timeout: 900000, maxBuffer: 16 * 1024 * 1024 });
  const log = `${command}\n${result.stdout ?? ''}\n${result.stderr ?? ''}\nEXIT_CODE=${result.status}\n${result.error?.message ?? ''}`;
  writeFileSync(`${directory}/baseline-${args[0].replace(':', '-')}.txt`, log);
  results.push({ command, exitCode: result.status });
  console.log(command, result.status);
  if (result.status !== 0) break;
}
writeFileSync(`${directory}/baseline-results.json`, JSON.stringify(results, null, 2));
process.exitCode = results.some(r => r.exitCode !== 0) ? 1 : 0;
