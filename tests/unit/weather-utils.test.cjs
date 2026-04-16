const {
  buildWeatherCacheKey,
  isWeatherCacheFresh,
  buildDegradedWeatherPayload,
} = require('../../server/lib/weather-utils.cjs')

describe('weather-utils', () => {
  test('builds stable cache key using coordinate buckets', () => {
    expect(buildWeatherCacheKey(23.81031, 90.41249)).toBe('23.810:90.412')
    expect(buildWeatherCacheKey('bad', null)).toBe('0.000:0.000')
  })

  test('checks cache freshness against TTL', () => {
    const now = 1_000_000
    const freshEntry = { fetchedAtMs: now - 5_000 }
    const staleEntry = { fetchedAtMs: now - 25_000 }

    expect(isWeatherCacheFresh(freshEntry, 10_000, now)).toBe(true)
    expect(isWeatherCacheFresh(staleEntry, 10_000, now)).toBe(false)
    expect(isWeatherCacheFresh(null, 10_000, now)).toBe(false)
  })

  test('builds degraded weather payload when fallback is used', () => {
    const payload = buildDegradedWeatherPayload(
      { source: 'open-meteo', current: { temp: 31 } },
      'fetch failed',
      '2026-04-16T12:00:00.000Z',
    )

    expect(payload.source).toBe('cache-fallback')
    expect(payload.current.temp).toBe(31)
    expect(payload.degradedMode.active).toBe(true)
    expect(payload.degradedMode.fallbackReason).toContain('fetch failed')
  })
})
