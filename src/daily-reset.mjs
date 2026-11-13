// Daily reset boundary for the Marvis token wallet.
//
// Marvis grants 10,000,000 billed tokens per account per day. The wallet API
// reports the remaining balance but not when the day rolls over, so magpie
// used to see a window with no reset time: its `soon` array held only Go's
// zero time, which the daily-expiry strategy could not rank. Reporting the
// next local midnight as resetsAt gives the window a real renewal date.

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const BEIJING_OFFSET_MS = 8 * HOUR_MS

/**
 * ISO timestamp of the next Beijing rollover strictly after `now`.
 * `hour` shifts the rollover point (0-23) for accounts whose day ends later.
 */
export function nextDailyReset(now = Date.now(), hour = 0) {
  const h = Number.isInteger(Number(hour)) ? Math.min(23, Math.max(0, Number(hour))) : 0
  const local = now + BEIJING_OFFSET_MS
  const dayStart = Math.floor(local / DAY_MS) * DAY_MS
  let next = dayStart + h * HOUR_MS - BEIJING_OFFSET_MS
  if (next <= now) next += DAY_MS
  return new Date(next).toISOString()
}

export const DAILY_SPAN_SECONDS = DAY_MS / 1000
