// Beem SMS authentication tests against a strict mock gateway. Usage: node e2e-beem.mjs <serverDir>
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const serverDir = process.argv[2];
const API_KEY = 'a1b2c3d4e5f60718';
const SECRET = 'MzQ1NjdhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODk=';
const expected = `Basic ${Buffer.from(`${API_KEY}:${SECRET}`).toString('base64')}`;
const seen = [];

const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    seen.push({ url: req.url, auth: req.headers.authorization, contentType: req.headers['content-type'], accept: req.headers.accept, body });
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization !== expected) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ code: 120, message: 'Invalid Authentication Parameters' }));
    }
    if (req.url === '/balance') return res.end(JSON.stringify({ data: { credit_balance: 5400 } }));
    const payload = JSON.parse(body);
    const shapeOk = payload.source_addr === 'ALNOOR' && payload.encoding === 0 && payload.schedule_time === ''
      && typeof payload.message === 'string' && Array.isArray(payload.recipients)
      && payload.recipients.every((r) => Number.isInteger(r.recipient_id) && /^255\d{9}$/.test(r.dest_addr));
    if (!shapeOk) { res.statusCode = 400; return res.end(JSON.stringify({ code: 101, message: 'Invalid payload' })); }
    return res.end(JSON.stringify({ successful: true, request_id: 777, code: 100, message: 'Message Submitted Successfully', valid: payload.recipients.length, invalid: 0, duplicates: 0 }));
  });
});
await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${mock.address().port}`;

let passed = 0;
let failed = 0;
const check = (name, ok, extra) => {
  if (ok) passed += 1;
  else { failed += 1; console.log(`FAIL  ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 900) : ''); }
};

const DB_NAME = `sms_beem_${Date.now()}`;
const baseEnv = {
  ...process.env, NODE_ENV: 'development', DB_HOST: '127.0.0.1', DB_PORT: '3307', DB_USER: 'root', DB_PASSWORD: '', DB_NAME,
  JWT_SECRET: 'e'.repeat(64), SCHOOL_NAME: 'Beem Test School', BEEM_SENDER_ID: 'ALNOOR', BEEM_BASE_URL: `${base}/v1/send`, BEEM_BALANCE_URL: `${base}/balance`,
};
delete baseEnv.BEEM_API_KEY;
delete baseEnv.BEEM_SECRET_KEY;
execFileSync(process.execPath, ['src/scripts/migrate.js'], { cwd: serverDir, env: baseEnv, encoding: 'utf8' });

// Runs `npm run sms:check [number]` in a child process with the given credentials.
function smsCheck(extraEnv, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['src/scripts/checkSms.js', ...args], { cwd: serverDir, env: { ...baseEnv, ...extraEnv } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out }));
  });
}

// 1. Correct keys → balance call authenticates; exact headers.
let r = await smsCheck({ BEEM_API_KEY: API_KEY, BEEM_SECRET_KEY: SECRET });
check('valid keys accepted', r.code === 0 && r.out.includes('Beem accepted the credentials') && r.out.includes('5400'), r.out);
let last = seen.at(-1);
check('Authorization header is Basic base64(key:secret)', last.auth === expected, last);
check('Accept: application/json', last.accept === 'application/json', last);
check('keys masked in output', !r.out.includes(SECRET) && r.out.includes('a1b2…0718 (16 chars)'), r.out);

// 2. Copy/paste damage is cleaned: quotes, spaces, zero-width and non-breaking spaces, BOM.
r = await smsCheck({ BEEM_API_KEY: `  "${API_KEY}"\u200B `, BEEM_SECRET_KEY: `\uFEFF'${SECRET}'\u00A0\n` });
check('quoted/whitespace/invisible chars stripped', r.code === 0, r.out);

// 3. Wrong secret → Beem 401/code 120 surfaced with a clear, actionable message and hints.
r = await smsCheck({ BEEM_API_KEY: API_KEY, BEEM_SECRET_KEY: 'wrong-secret-value-1234567890' });
check('wrong secret rejected', r.code === 1 && r.out.includes('Invalid Authentication Parameters') && r.out.includes('BEEM_SECRET_KEY in server/.env'), r.out);
check('detailed log entry on rejection', r.out.includes('Beem rejected the SMS credentials') && r.out.includes('"beemCode":120') && r.out.includes('"httpStatus":401'), r.out);
check('log never contains the secret', !r.out.includes('wrong-secret-value-1234567890'), r.out);

// 4. Swapped keys → hint.
r = await smsCheck({ BEEM_API_KEY: SECRET, BEEM_SECRET_KEY: API_KEY });
check('swapped keys hint', r.code === 1 && r.out.includes('may be swapped'), r.out);

// 5. Sending: payload shape accepted with good keys; failure message stored with bad keys.
r = await smsCheck({ BEEM_API_KEY: API_KEY, BEEM_SECRET_KEY: SECRET }, ['0777 123 456']);
last = seen.at(-1);
check('test SMS sent', r.code === 0 && r.out.includes('Test SMS accepted'), r.out);
check('send request headers', last.url === '/v1/send' && last.contentType === 'application/json' && last.accept === 'application/json' && last.auth === expected, last);
const body = JSON.parse(last.body);
check('payload per Beem spec', body.source_addr === 'ALNOOR' && body.encoding === 0 && body.schedule_time === '' && body.recipients[0].dest_addr === '255777123456' && Number.isInteger(body.recipients[0].recipient_id), body);

// 6. Stale credentials in the process environment lose to server/.env.
const envFile = path.join(serverDir, '.env');
const hadEnv = existsSync(envFile);
if (!hadEnv) {
  try {
    writeFileSync(envFile, `BEEM_API_KEY=${API_KEY}\nBEEM_SECRET_KEY='${SECRET}'\n`);
    r = await smsCheck({ BEEM_API_KEY: 'stale-key-from-pm2', BEEM_SECRET_KEY: 'stale-secret-from-pm2' });
    check('.env overrides stale process env', r.code === 0 && r.out.includes('were replaced by server/.env'), r.out);
  } finally {
    rmSync(envFile, { force: true });
  }
} else {
  console.log('skip: server/.env exists locally, override test not run');
}

console.log(`\nBeem: ${passed} passed, ${failed} failed`);
mock.close();
process.exit(failed ? 1 : 0);
