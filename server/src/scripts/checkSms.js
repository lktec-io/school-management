/**
 * Beem SMS configuration check — no message is sent.
 *
 *   npm run sms:check                 # credentials + live balance (authenticates against Beem)
 *   npm run sms:check -- 0777123456   # additionally sends one test SMS to that number
 *
 * Prints the loaded configuration with keys masked, then calls the balance endpoint, which uses
 * the same Basic authentication as sending. Exit code 0 = Beem accepted the credentials.
 */
import env from '../config/env.js';
import { closePool } from '../config/db.js';
import { credentialDiagnostics, getBeemBalance, isSmsConfigured, sendSMS } from '../services/smsService.js';

const diagnostics = credentialDiagnostics();
console.log('Beem SMS configuration');
console.log(`  API key     ${diagnostics.apiKey}`);
console.log(`  Secret key  ${diagnostics.secretKey}`);
console.log(`  Fingerprint ${diagnostics.fingerprint ?? '(no keys)'}   <- must match "fingerprint" in the server log`);
console.log(`  Sender ID   ${diagnostics.senderId}`);
console.log(`  Send URL    ${diagnostics.sendUrl}`);
console.log(`  Balance URL ${diagnostics.balanceUrl}`);
if (env.beem.overriddenFromFile.length) {
  console.log(`  Note: stale ${env.beem.overriddenFromFile.join(', ')} in the shell/PM2 environment were replaced by server/.env`);
}

let exitCode = 0;
if (!isSmsConfigured()) {
  console.log('\n✗ Not configured: set BEEM_API_KEY, BEEM_SECRET_KEY and BEEM_SENDER_ID in server/.env');
  exitCode = 1;
} else {
  const balance = await getBeemBalance();
  if (balance.error) {
    console.log(`\n✗ ${balance.error}`);
    console.log('  Likely causes:');
    for (const hint of diagnostics.hints) console.log(`   - ${hint}`);
    exitCode = 1;
  } else {
    console.log(`\n✓ Beem accepted the credentials. Credit balance: ${balance.creditBalance ?? 'unknown'}`);
    const testNumber = process.argv[2];
    if (testNumber) {
      const result = await sendSMS({ recipient: testNumber, message: 'Test SMS from the school management system.', category: 'other' });
      console.log(result.status === 'sent' ? `✓ Test SMS accepted by Beem (log #${result.id})` : `✗ Test SMS failed: ${result.error}`);
      if (result.status !== 'sent') exitCode = 1;
    }
  }
}

await closePool();
process.exit(exitCode);
