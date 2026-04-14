$ErrorActionPreference='Stop'
$base='http://localhost:5181/api'
$ts=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$fEmail="qa_fix_farmer_$ts@smartfarming.local"
$dEmail="qa_fix_doctor_$ts@smartfarming.local"
$pwd='TestPass123!'
$summary=[ordered]@{}

# 1) Terms enforcement (expected fail)
$termsBlocked=$false
try {
  Invoke-RestMethod -Method Post -Uri "$base/auth/signup" -ContentType 'application/json' -Body (@{ email="qa_terms_$ts@smartfarming.local"; password=$pwd; name='No Terms'; role='farmer'; location='Dhaka'; termsAccepted=$false; privacyAccepted=$false }|ConvertTo-Json) | Out-Null
} catch {
  $termsBlocked = $true
}
$summary.termsBlocked = $termsBlocked

# 2) Create farmer/doctor with terms accepted
$null = Invoke-RestMethod -Method Post -Uri "$base/auth/signup" -ContentType 'application/json' -Body (@{ email=$fEmail; password=$pwd; name='Fix Farmer'; role='farmer'; location='Dhaka'; termsAccepted=$true; privacyAccepted=$true }|ConvertTo-Json)
$null = Invoke-RestMethod -Method Post -Uri "$base/auth/signup" -ContentType 'application/json' -Body (@{ email=$dEmail; password=$pwd; name='Fix Doctor'; role='doctor'; phone='+8801700000002'; location='Dhaka'; specialty='Plant'; registrationNumber='REG-FIX'; certificateDocument='https://example.com/c1.pdf'; resumeDocument='https://example.com/r1.pdf'; termsAccepted=$true; privacyAccepted=$true }|ConvertTo-Json)

$admin = Invoke-RestMethod -Method Post -Uri "$base/auth/signin" -ContentType 'application/json' -Body (@{ email='admin@smartfarming.local'; password='admin123' }|ConvertTo-Json)
$h=@{Authorization="Bearer $($admin.accessToken)"}
$users=Invoke-RestMethod -Method Get -Uri "$base/users" -Headers $h
$fUser=($users.users|Where-Object{$_.email -eq $fEmail}|Select-Object -First 1)
$dUser=($users.users|Where-Object{$_.email -eq $dEmail}|Select-Object -First 1)

# 3) Doctor access removal should notify
$upd=Invoke-RestMethod -Method Put -Uri "$base/users/$($dUser.id)" -Headers $h -ContentType 'application/json' -Body (@{ role='farmer' }|ConvertTo-Json)
$dSignin=Invoke-RestMethod -Method Post -Uri "$base/auth/signin" -ContentType 'application/json' -Body (@{ email=$dEmail; password=$pwd }|ConvertTo-Json)
$dh=@{Authorization="Bearer $($dSignin.accessToken)"}
$alerts=Invoke-RestMethod -Method Get -Uri "$base/alerts" -Headers $dh
$hasDoctorRemovalAlert = ($alerts.alerts | Where-Object { $_.message -like '*doctor access has been removed*' -or $_.message_bn -like '*ডাক্তার অ্যাক্সেস বাতিল*' } | Measure-Object).Count -gt 0
$summary.doctorRemovalAlert = $hasDoctorRemovalAlert

# 4) main admin can delete super user
$super=Invoke-RestMethod -Method Post -Uri "$base/auth/signin" -ContentType 'application/json' -Body (@{ email='super@smartfarming.local'; password='super123' }|ConvertTo-Json)
$sh=@{Authorization="Bearer $($super.accessToken)"}
$null = Invoke-RestMethod -Method Put -Uri "$base/users/$($fUser.id)" -Headers $sh -ContentType 'application/json' -Body (@{ role='super_admin' }|ConvertTo-Json)
$deletedSuperByAdmin=$false
try {
  $del=Invoke-RestMethod -Method Delete -Uri "$base/users/$($fUser.id)" -Headers $h
  $deletedSuperByAdmin = [bool]$del.userId
} catch {
  $deletedSuperByAdmin = $false
}
$summary.mainAdminCanDeleteSuper = $deletedSuperByAdmin

# cleanup
try { Invoke-RestMethod -Method Delete -Uri "$base/users/$($dUser.id)" -Headers $h | Out-Null } catch {}

[pscustomobject]$summary | ConvertTo-Json -Depth 8
