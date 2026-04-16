function normalizeRole(role) {
  return String(role || '').trim().toLowerCase()
}

function isAdminRole(role) {
  const normalized = normalizeRole(role)
  return normalized === 'admin' || normalized === 'super_admin'
}

function canAccessPanel(role, panel) {
  const normalizedRole = normalizeRole(role)
  const normalizedPanel = String(panel || '').trim().toLowerCase()

  if (!normalizedPanel) return false
  if (normalizedPanel === 'farmer') return normalizedRole === 'farmer'
  if (normalizedPanel === 'doctor') return normalizedRole === 'doctor'
  if (normalizedPanel === 'admin') return isAdminRole(normalizedRole)
  return false
}

module.exports = {
  normalizeRole,
  isAdminRole,
  canAccessPanel,
}
