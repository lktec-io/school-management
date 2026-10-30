// Runs every API suite against a THROWAWAY MySQL on 127.0.0.1:3307 (root, no password). Each suite creates its
// own uniquely named database there and sets its own DB_* variables, so production data cannot be touched.
//
//   mysqld --initialize-insecure --datadir=<empty folder>
//   mysqld --datadir=<that folder> --port=3307 --bind-address=127.0.0.1 --mysqlx=OFF
//   npm test                      (or: npm test -- phase9 results)
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.dirname(testsDir);
const filters = process.argv.slice(2);

const reachable = await new Promise((resolve) => {
  const socket = net.connect({ host: '127.0.0.1', port: 3307 });
  socket.setTimeout(1500);
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('timeout', () => { socket.destroy(); resolve(false); });
  socket.once('error', () => resolve(false));
});
if (!reachable) {
  console.error('No test MySQL on 127.0.0.1:3307. See the commands at the top of tests/run.mjs.');
  process.exit(1);
}

const suites = readdirSync(testsDir).filter((name) => name.startsWith('e2e') && name.endsWith('.mjs') && (!filters.length || filters.some((f) => name.includes(f)))).sort();
let failedSuites = 0;
for (const suite of suites) {
  const { code, summary, failures } = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(testsDir, suite), serverDir.split(path.sep).join('/')], { cwd: serverDir });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { out += chunk; });
    child.on('close', (exitCode) => {
      const lines = out.split(/\r?\n/);
      resolve({
        code: exitCode,
        summary: lines.filter((line) => /\d+ passed, \d+ failed/.test(line)).at(-1) ?? 'no summary',
        failures: lines.filter((line) => /^FAIL|Error:/.test(line)),
      });
    });
  });
  console.log(`${code === 0 ? 'ok  ' : 'FAIL'} ${suite.padEnd(20)} ${summary.trim()}`);
  failures.slice(0, 20).forEach((line) => console.log(`     ${line.slice(0, 300)}`));
  if (code !== 0) failedSuites += 1;
}
console.log(failedSuites ? `\n${failedSuites} suite(s) failed` : `\nAll ${suites.length} suites passed`);
process.exit(failedSuites ? 1 : 0);
