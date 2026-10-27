// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Notifications, validateWebhook, reportText } = require('../electron/notifications.cjs');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const key = randomBytes(32);
const crypto = { isAsyncEncryptionAvailable: async () => true,
  async encryptStringAsync(text) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); const bytes = Buffer.concat([cipher.update(text), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), bytes]); },
  async decryptStringAsync(bytes) { const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(12, 28)); return { result: Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString(), shouldReEncrypt: false }; },
};
const slack = 'https://hooks.slack.com/services/TEST/TEST/not_a_real_webhook';
const discord = 'https://discord.com/api/webhooks/123456/not_a_real_webhook';
test('webhooks accept only official endpoints and reject redirects, local and credential URLs', () => {
  assert.equal(validateWebhook('slack', slack), slack);
  assert.equal(validateWebhook('discord', discord), discord);
  for (const value of ['http://hooks.slack.com/services/T/B/key', 'https://hooks.slack.com.evil.test/services/T/B/key', 'https://127.0.0.1/services/T/B/key', slack + '?redirect=1', 'https://user@hooks.slack.com/services/T/B/key']) assert.throws(() => validateWebhook('slack', value));
});
test('encrypted settings, completion fan-out, deduplication and failure isolation', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chickadee-notification-'));
  try {
    const calls = [], notices = [];
    const args = { directory, safeStorage: crypto, focused: () => true, notify: (...args) => notices.push(args), fetcher: async (url, options) => { calls.push({ url, options }); return { ok: !url.includes('discord'), status: 429 }; } };
    const service = new Notifications(args);
    assert.equal((await service.state()).secureStorage, true);
    await service.save({ slack: true, discord: true, desktop: true, slackUrl: slack, discordUrl: discord });
    const stored = await fs.readFile(service.file, 'utf8'); assert.ok(!stored.includes('not_a_real_webhook'));
    assert.ok(!JSON.stringify(await service.state()).includes(slack));
    const restored = new Notifications(args); await restored.load();
    const event = { run_id: 'one', report: { status: 'completed', pages_scanned: ['https://private.example/secret'], ad_candidates: [{}] }, result: { findings: [{ text: 'SECRET_PAGE_TEXT' }] } };
    await restored.completed(event); await restored.completed(event);
    assert.equal(calls.length, 2); assert.equal(notices.length, 0);
    assert.equal((await restored.state()).lastDelivery[0].success, true); assert.equal((await restored.state()).lastDelivery[1].success, false);
    assert.equal(calls[0].options.redirect, 'error');
    assert.deepEqual(JSON.parse(calls[1].options.body).allowed_mentions, { parse: [] });
    assert.ok(!reportText(event).includes('private.example')); assert.ok(!reportText(event).includes('SECRET_PAGE_TEXT'));
    await restored.save({ slackRemove: true, discord: false, suppressFocused: false });
    await restored.completed({ ...event, run_id: 'two' }); assert.equal(calls.length, 2); assert.equal(notices.length, 1);
    const insecure = new Notifications({ ...args, safeStorage: { isAsyncEncryptionAvailable: async () => false } });
    assert.equal((await insecure.state()).secureStorage, false);
    await assert.rejects(insecure.save({ slackUrl: slack }));
    const plaintext = new Notifications({ ...args, safeStorage: { ...crypto, getSelectedStorageBackend: () => 'basic_text' } });
    await assert.rejects(plaintext.save({ slackUrl: slack }));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('native notification reports show, failure and unconfirmed delivery', async () => {
  const { EventEmitter } = require('node:events');
  const { createNotifier } = require('../electron/native-notification.cjs');
  class Native extends EventEmitter { show() { queueMicrotask(() => this.emit(Native.event)); } }
  Native.event = 'show';
  assert.equal((await createNotifier(Native, () => null, 10)('test', 'body', true)).confirmed, true);
  Native.event = 'failed';
  await assert.rejects(createNotifier(Native, () => null, 10)('test', 'body', true), /알림/);
  Native.event = 'nothing';
  assert.equal((await createNotifier(Native, () => null, 10)('test', 'body', true)).confirmed, false);
});
