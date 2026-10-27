// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Schedules, nextTime, validate } = require('../electron/schedules.cjs');
const input = () => ({ name: 'Morning', enabled: true, repeat: 'daily', time: '09:00', days: [1, 2, 3, 4, 5], options: { url: 'https://example.com', max_pages: 10, timeout_sec: 60, profile: 'default', preview: false, workflow: { version: 1 } } });
test('calendar recurrence, once, validation and disabled schedule', () => {
  const monday = new Date(2026, 9, 19, 8, 30).getTime();
  assert.equal(nextTime(input(), monday), +new Date(2026, 9, 19, 9));
  assert.equal(nextTime(input(), +new Date(2026, 9, 19, 9)), +new Date(2026, 9, 20, 9));
  assert.equal(nextTime({ ...input(), repeat: 'weekly', days: [1] }, +new Date(2026, 9, 19, 9)), +new Date(2026, 9, 26, 9));
  assert.equal(nextTime({ ...input(), enabled: false }, monday), null);
  assert.throws(() => validate({ ...input(), time: '25:00' }));
  assert.throws(() => validate({ ...input(), options: { ...input().options, interval_sec: 31 } }));
  assert.throws(() => validate({ ...input(), repeat: 'weekly', days: [] }));
  assert.throws(() => validate({ ...input(), repeat: 'once', date: '2026-02-30' }));
  assert.throws(() => validate({ ...input(), options: { ...input().options, url: 'file:///etc/passwd' } }));
});
test('persistent dispatch is once-only, skips overlap and missed slots, removes secrets', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chickadee-schedule-'));
  try {
    let clock = +new Date(2026, 9, 19, 8, 59), occupied = false;
    const calls = [];
    const args = { directory, now: () => clock, busy: async () => occupied, start: async options => { calls.push(options); occupied = true; return { run_id: 'run-1' }; } };
    const service = new Schedules(args); await service.load();
    await service.save({ ...input(), options: { ...input().options, api_key: 'secret', demo: true, interval_sec: 5 } });
    await service.save({ ...input(), name: 'Second' });
    clock = +new Date(2026, 9, 19, 9);
    await Promise.all([service.tick(), service.tick()]);
    assert.equal(calls.length, 1); assert.equal(calls[0].interval_sec, 5); assert.equal(calls[0].api_key, undefined); assert.equal(calls[0].demo, undefined);
    assert.equal(service.state().items[1].last.status, 'skipped');
    const restored = new Schedules(args); await restored.load(); await restored.tick(); assert.equal(calls.length, 1);
    clock = +new Date(2026, 9, 20, 10); occupied = false;
    await restored.tick(); assert.equal(calls.length, 1); assert.match(restored.state().items[0].last.message, /놓쳤/);
    const saved = restored.state().items[0]; await restored.save({ ...saved, enabled: false });
    assert.equal(restored.state().items[0].nextAt, null);
    await restored.remove(saved.id); assert.equal(restored.state().items.length, 1);
    await restored.save({ ...input(), repeat: 'once', date: '2026-10-21' });
    clock = +new Date(2026, 9, 21, 9); await restored.tick();
    assert.equal(restored.state().items.find(i => i.repeat === 'once').enabled, false);
    const restart = new Schedules(args); clock = +new Date(2026, 9, 22, 9); await restart.load();
    assert.equal(restart.state().items[0].last.status, 'skipped');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
test('failed dispatch advances reservation and does not retry', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chickadee-schedule-'));
  try {
    let clock = +new Date(2026, 9, 19, 8), calls = 0;
    const service = new Schedules({ directory, now: () => clock, busy: async () => false, start: async () => { calls++; throw new Error('secret backend detail'); } });
    await service.save(input()); clock = +new Date(2026, 9, 19, 9); await service.tick(); await service.tick();
    assert.equal(calls, 1); assert.equal(service.state().items[0].last.status, 'failed'); assert.ok(!JSON.stringify(service.state()).includes('secret'));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
