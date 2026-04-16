function toCoordBucket(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '0.000'
  return parsed.toFixed(3)
}

function buildWeatherCacheKey(lat, lng) {
  return `${toCoordBucket(lat)}:${toCoordBucket(lng)}`
}

function isWeatherCacheFresh(entry, ttlMs, nowMs = Date.now()) {
  const ttl = Math.max(1000, Number(ttlMs || 0))
  const fetchedAt = Number(entry?.fetchedAtMs || 0)
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return false
  return (nowMs - fetchedAt) <= ttl
}

function buildDegradedWeatherPayload(cachedPayload, reason, nowIso = new Date().toISOString()) {
  const payload = cachedPayload && typeof cachedPayload === 'object' ? { ...cachedPayload } : {}
  return {
    ...payload,
    source: 'cache-fallback',
    degradedMode: {
      active: true,
      fallbackReason: String(reason || 'Live weather provider failed'),
      fallbackAt: nowIso,
      advisory: 'Live provider unavailable. Cached weather is being served temporarily.',
    },
  }
}

module.exports = {
  buildWeatherCacheKey,
  isWeatherCacheFresh,
  buildDegradedWeatherPayload,
}
