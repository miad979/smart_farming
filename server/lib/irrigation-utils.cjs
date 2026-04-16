function applyPumpCapacityForCycle({ targetLiters, pumpCapacityLpm, maxCycleMinutes, respectCycleLimit = true }) {
  const safeTarget = Math.max(0, Number(targetLiters || 0))
  const safeCapacity = Math.max(1, Number(pumpCapacityLpm || 1))
  const safeMaxCycleMinutes = Math.max(1, Number(maxCycleMinutes || 1))

  if (safeTarget <= 0) {
    return {
      targetLiters: 0,
      appliedLiters: 0,
      runtimeSeconds: 0,
      cappedByCycle: false,
    }
  }

  const flowPerSecond = safeCapacity / 60
  const requiredSeconds = safeTarget / flowPerSecond
  const allowedSeconds = respectCycleLimit ? (safeMaxCycleMinutes * 60) : requiredSeconds
  const runtimeSeconds = Math.max(1, Math.ceil(Math.min(requiredSeconds, allowedSeconds)))
  const deliveredLiters = Math.max(1, Math.round(flowPerSecond * runtimeSeconds))
  const appliedLiters = Math.min(safeTarget, deliveredLiters)

  return {
    targetLiters: safeTarget,
    appliedLiters,
    runtimeSeconds,
    cappedByCycle: respectCycleLimit && (requiredSeconds > allowedSeconds),
  }
}

module.exports = {
  applyPumpCapacityForCycle,
}
