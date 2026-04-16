const { applyPumpCapacityForCycle } = require('../../server/lib/irrigation-utils.cjs')

describe('irrigation-utils', () => {
  test('returns zero delivery for non-positive target', () => {
    const result = applyPumpCapacityForCycle({
      targetLiters: 0,
      pumpCapacityLpm: 30,
      maxCycleMinutes: 10,
    })

    expect(result.appliedLiters).toBe(0)
    expect(result.runtimeSeconds).toBe(0)
    expect(result.cappedByCycle).toBe(false)
  })

  test('applies target when enough runtime exists', () => {
    const result = applyPumpCapacityForCycle({
      targetLiters: 60,
      pumpCapacityLpm: 30,
      maxCycleMinutes: 5,
    })

    expect(result.appliedLiters).toBe(60)
    expect(result.cappedByCycle).toBe(false)
    expect(result.runtimeSeconds).toBeGreaterThan(0)
  })

  test('caps cycle when max minutes are too low', () => {
    const result = applyPumpCapacityForCycle({
      targetLiters: 600,
      pumpCapacityLpm: 30,
      maxCycleMinutes: 5,
      respectCycleLimit: true,
    })

    expect(result.cappedByCycle).toBe(true)
    expect(result.appliedLiters).toBeLessThan(600)
    expect(result.runtimeSeconds).toBeLessThanOrEqual(300)
  })
})
