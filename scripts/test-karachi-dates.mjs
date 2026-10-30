import test from 'node:test';
import assert from 'node:assert/strict';
import { karachiToday, formatKarachiDate, formatKarachiTimestamp } from '../src/lib/karachiDate.ts';

test('Asia/Karachi Date Utility Tests', async (t) => {
  await t.test('Simulate 02:00 PKT on Oct 30, 2026: UTC is 21:00 Oct 29, 2026', () => {
    // 2026-10-30 02:00:00 PKT is equal to 2026-10-29 21:00:00 UTC
    const dateAt2amPKT = new Date('2026-10-29T21:00:00.000Z');

    // Flawed UTC method yields yesterday (Oct 29)
    const flawedIsoDate = dateAt2amPKT.toISOString().split('T')[0];
    assert.equal(flawedIsoDate, '2026-10-29', 'Confirm flawed UTC method rolls back to Oct 29');

    // Authoritative Karachi date yields the correct business day (Oct 30)
    const correctKarachiDate = formatKarachiDate(dateAt2amPKT);
    assert.equal(correctKarachiDate, '2026-10-30', 'formatKarachiDate must yield Oct 30 at 02:00 PKT');
  });

  await t.test('Simulate 23:59 PKT on Oct 30, 2026: UTC is 18:59 Oct 30, 2026', () => {
    const dateAtLateNightPKT = new Date('2026-10-30T18:59:59.000Z');
    assert.equal(formatKarachiDate(dateAtLateNightPKT), '2026-10-30');
  });

  await t.test('Simulate 00:01 PKT on Nov 1, 2026: Month rollover', () => {
    // 2026-11-01 00:01:00 PKT is 2026-10-31 19:01:00 UTC
    const monthRollover = new Date('2026-10-31T19:01:00.000Z');
    assert.equal(formatKarachiDate(monthRollover), '2026-11-01');
  });

  await t.test('karachiToday() returns valid YYYY-MM-DD pattern', () => {
    const today = karachiToday();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  });

  await t.test('formatKarachiTimestamp returns formatted 24h string', () => {
    const d = new Date('2026-10-29T21:15:30.000Z'); // 02:15:30 PKT Oct 30
    const ts = formatKarachiTimestamp(d);
    assert.equal(ts, '2026-10-30 02:15:30');
  });
});
