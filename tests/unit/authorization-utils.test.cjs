const {
  normalizeRole,
  isAdminRole,
  canAccessPanel,
} = require('../../server/lib/authorization-utils.cjs')

describe('authorization-utils', () => {
  test('normalizes role input', () => {
    expect(normalizeRole(' Admin ')).toBe('admin')
    expect(normalizeRole(null)).toBe('')
  })

  test('detects admin and super_admin roles', () => {
    expect(isAdminRole('admin')).toBe(true)
    expect(isAdminRole('super_admin')).toBe(true)
    expect(isAdminRole('doctor')).toBe(false)
  })

  test('enforces panel access by role', () => {
    expect(canAccessPanel('farmer', 'farmer')).toBe(true)
    expect(canAccessPanel('farmer', 'doctor')).toBe(false)
    expect(canAccessPanel('doctor', 'admin')).toBe(false)
    expect(canAccessPanel('super_admin', 'admin')).toBe(true)
  })
})
