$ErrorActionPreference = 'Stop'
$base = 'http://localhost:5181/api'
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$u1Email = "qa_perm_a_$ts@smartfarming.local"
$u2Email = "qa_perm_b_$ts@smartfarming.local"
$pwd = 'TestPass123!'
$adminHeaders = $null
$u1Id = $null
$u2Id = $null

try {
  $super = Invoke-RestMethod -Method Post -Uri "$base/auth/signin" -ContentType 'application/json' -Body (@{ email = 'super@smartfarming.local'; password = 'super123' } | ConvertTo-Json)
  $superHeaders = @{ Authorization = "Bearer $($super.accessToken)" }

  $null = Invoke-RestMethod -Method Post -Uri "$base/auth/signup" -ContentType 'application/json' -Body (@{ email = $u1Email; password = $pwd; name = 'Perm A'; role = 'farmer'; location = 'Dhaka'; termsAccepted = $true; privacyAccepted = $true } | ConvertTo-Json)
  $null = Invoke-RestMethod -Method Post -Uri "$base/auth/signup" -ContentType 'application/json' -Body (@{ email = $u2Email; password = $pwd; name = 'Perm B'; role = 'farmer'; location = 'Dhaka'; termsAccepted = $true; privacyAccepted = $true } | ConvertTo-Json)

  $users = Invoke-RestMethod -Method Get -Uri "$base/users" -Headers $superHeaders
  $u1 = $users.users | Where-Object { $_.email -eq $u1Email } | Select-Object -First 1
  $u2 = $users.users | Where-Object { $_.email -eq $u2Email } | Select-Object -First 1
  $u1Id = $u1.id
  $u2Id = $u2.id

  $grantAdmin = Invoke-RestMethod -Method Put -Uri "$base/users/$u1Id" -Headers $superHeaders -ContentType 'application/json' -Body (@{ role='admin' } | ConvertTo-Json)
  $grantSuper = Invoke-RestMethod -Method Put -Uri "$base/users/$u2Id" -Headers $superHeaders -ContentType 'application/json' -Body (@{ role='super_admin' } | ConvertTo-Json)

  $adminLogin = Invoke-RestMethod -Method Post -Uri "$base/auth/signin" -ContentType 'application/json' -Body (@{ email = $u1Email; password = $pwd } | ConvertTo-Json)
  $adminHeaders = @{ Authorization = "Bearer $($adminLogin.accessToken)" }

  $adminEscalationBlocked = $false
  try {
    Invoke-RestMethod -Method Put -Uri "$base/users/$u1Id" -Headers $adminHeaders -ContentType 'application/json' -Body (@{ role='super_admin' } | ConvertTo-Json) | Out-Null
  } catch {
    $adminEscalationBlocked = $true
  }

  $adminDeleteSuperBlocked = $false
  try {
    Invoke-RestMethod -Method Delete -Uri "$base/users/$u2Id" -Headers $adminHeaders | Out-Null
  } catch {
    $adminDeleteSuperBlocked = $true
  }

  $adminCanListUsers = $false
  try {
    $null = Invoke-RestMethod -Method Get -Uri "$base/users" -Headers $adminHeaders
    $adminCanListUsers = $true
  } catch {}

  [pscustomobject]@{
    superLogin = $super.user.email
    grantedAdminRole = $grantAdmin.user.role
    grantedSuperRole = $grantSuper.user.role
    adminCanListUsers = $adminCanListUsers
    adminEscalationBlocked = $adminEscalationBlocked
    adminDeleteSuperBlocked = $adminDeleteSuperBlocked
  } | ConvertTo-Json -Depth 6
}
finally {
  if (-not $adminHeaders) {
    try {
      $super = Invoke-RestMethod -Method Post -Uri "$base/auth/signin" -ContentType 'application/json' -Body (@{ email = 'super@smartfarming.local'; password = 'super123' } | ConvertTo-Json)
      $adminHeaders = @{ Authorization = "Bearer $($super.accessToken)" }
    } catch {}
  }

  if ($adminHeaders -and $u1Id) {
    try { Invoke-RestMethod -Method Delete -Uri "$base/users/$u1Id" -Headers $adminHeaders | Out-Null } catch {}
  }
  if ($adminHeaders -and $u2Id) {
    try { Invoke-RestMethod -Method Delete -Uri "$base/users/$u2Id" -Headers $adminHeaders | Out-Null } catch {}
  }
}
