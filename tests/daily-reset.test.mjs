// Regression: the daily token wallet must report a real renewal time.
// Without resetsAt magpie exposes Go's zero time in seat.soon, and the
// daily-expiry strategy cannot rank the channel.

import test from "node:test"
import assert from "node:assert/strict"

import { DAILY_SPAN_SECONDS, nextDailyReset } from "../src/daily-reset.mjs"
import { usageWindow } from "../src/quota.mjs"
import { usageHook } from "../src/hooks/usage.mjs"

const HOUR = 3_600_000

test("wallet usage reports the next Beijing midnight and daily span", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: { total_tokens: 10_000_000, used_tokens: 2_000_000, avail_tokens: 8_000_000 },
  }))
  try {
    const before = Date.now()
    const result = await usageHook()(async () => ({
      access: "test-token", metadata: { openid: "test-openid", guid: "test-guid" },
    }))
    const after = Date.now()
    const window = result.windows[0]
    assert.equal(window.used, 20)
    assert.equal(window.span, 86400)
    assert.ok([nextDailyReset(before), nextDailyReset(after)].includes(window.resetsAt))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("nextDailyReset returns the next Beijing midnight, strictly in the future", () => {
  const now = Date.parse("2026-11-13T15:45:48Z") // 23:45:48 Beijing
  const iso = nextDailyReset(now)
  assert.equal(iso, "2026-11-13T16:00:00.000Z") // 2026-11-14 00:00 Beijing
  assert.ok(Date.parse(iso) > now)
})

test("nextDailyReset rolls to the following day once midnight has passed", () => {
  const now = Date.parse("2026-11-13T16:00:01Z") // just past Beijing midnight
  const iso = nextDailyReset(now)
  assert.equal(iso, "2026-11-14T16:00:00.000Z")
})

test("nextDailyReset honours a later rollover hour", () => {
  const now = Date.parse("2026-11-13T15:45:48Z")
  assert.equal(nextDailyReset(now, 4), "2026-11-13T20:00:00.000Z") // 04:00 Beijing
})

test("span is one whole day", () => {
  assert.equal(DAILY_SPAN_SECONDS, 86400)
})

test("usageWindow accepts the quantity window carrying resetsAt and span", () => {
  const w = usageWindow({
    name: "令牌用量",
    amount: 0,
    limit: 10_000_000,
    unit: "tokens",
    resetsAt: nextDailyReset(Date.parse("2026-11-13T15:45:48Z")),
    span: DAILY_SPAN_SECONDS,
  })
  assert.equal(w.used, 0)
  assert.equal(w.span, 86400)
  assert.match(w.resetsAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  assert.ok(Date.parse(w.resetsAt) > 0, "must not be Go's zero time")
})

test("reset is always within one horizon day", () => {
  for (let i = 0; i < 24; i++) {
    const now = Date.parse("2026-11-13T00:00:00Z") + i * HOUR
    const delta = Date.parse(nextDailyReset(now)) - now
    assert.ok(delta > 0 && delta <= 86_400_000, `hour ${i}: delta ${delta}`)
  }
})
