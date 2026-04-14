$ErrorActionPreference = 'Stop'
$base = 'http://localhost:5181/api'
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$farmerEmail = "qa_farmer_$ts@smartfarming.local"
$doctorEmail = "qa_doctor_$ts@smartfarming.local"
$pwd = 'TestPass123!'
$cert = 'https://example.com/certificate.pdf'
$resume = 'https://example.com/resume.pdf'
$summary = [ordered]@{}
$adminHeaders = $null
$farmerUserId = $null
$doctorUserId = $null

try {
  $admin = Invoke-RestMethod -Method Post -Uri "$base/auth/signin" -ContentType 'application/json' -Body (@{ email = 'admin@smartfarming.local'; password = 'admin123' } | ConvertTo-Json)
  $adminHeaders = @{ Authorization = "Bearer $($admin.accessToken)" }

  $health = Invoke-RestMethod -Method Get -Uri "$base/health"
  $summary.healthStatus = $health.status
  $summary.bootstrap = $health.storage.bootstrapSource

  $uploadCheck = Invoke-RestMethod -Method Post -Uri "$base/uploads/documents/check-hash" -ContentType 'application/json' -Body (@{ sha256 = 'abc123' } | ConvertTo-Json)
  $summary.uploadCheckExists = $uploadCheck.exists

  $null = Invoke-RestMethod -Method Post -Uri "$base/auth/signup" -ContentType 'application/json' -Body (@{
  email = $farmerEmail
  password = $pwd
  name = 'QA Farmer'
  role = 'farmer'
  location = 'Dhaka'
    termsAccepted = $true
    privacyAccepted = $true
  } | ConvertTo-Json)

  $farmerSignin = Invoke-RestMethod -Method Post -Uri "$base/auth/signin" -ContentType 'application/json' -Body (@{ email = $farmerEmail; password = $pwd } | ConvertTo-Json)
  $farmerHeaders = @{ Authorization = "Bearer $($farmerSignin.accessToken)" }
  $me = Invoke-RestMethod -Method Get -Uri "$base/auth/me" -Headers $farmerHeaders
  $farmerUserId = $farmerSignin.user.id

  $irrigation = Invoke-RestMethod -Method Get -Uri "$base/irrigation/$($farmerSignin.user.id)" -Headers $farmerHeaders
  $setup = Invoke-RestMethod -Method Post -Uri "$base/devices/virtual-irrigation/setup" -Headers $farmerHeaders -ContentType 'application/json' -Body (@{ crop = 'Rice' } | ConvertTo-Json)
  $tick = Invoke-RestMethod -Method Post -Uri "$base/devices/$($setup.device.id)/simulate" -Headers $farmerHeaders -ContentType 'application/json' -Body (@{ moisture = 41 } | ConvertTo-Json)

  $consult = Invoke-RestMethod -Method Post -Uri "$base/consultations" -Headers $farmerHeaders -ContentType 'application/json' -Body (@{
  crop = 'Rice'
  crop_bn = 'ধান'
  disease = 'Leaf blight'
  disease_bn = 'পাতা ব্লাইট'
  description = 'QA flow'
  location = 'Dhaka'
  } | ConvertTo-Json)

  $assistant = Invoke-RestMethod -Method Post -Uri "$base/assistant-chat" -Headers $farmerHeaders -ContentType 'application/json' -Body (@{
  chatId = "qa_chat_$ts"
  message = 'What should I do now?'
  language = 'en'
  disease = 'Leaf blight'
  } | ConvertTo-Json)

  $assistantHistory = Invoke-RestMethod -Method Get -Uri "$base/assistant-chat/history?chatId=qa_chat_$ts"

  $null = Invoke-RestMethod -Method Post -Uri "$base/auth/signup" -ContentType 'application/json' -Body (@{
  email = $doctorEmail
  password = $pwd
  name = 'QA Doctor'
  role = 'doctor'
  phone = '+8801700000001'
  location = 'Rajshahi'
  specialty = 'Plant Pathology'
  registrationNumber = 'REG-QA-001'
  certificateDocument = $cert
  resumeDocument = $resume
  experienceYears = 5
  profileSummary = 'QA doctor profile'
  termsAccepted = $true
  privacyAccepted = $true
  } | ConvertTo-Json)

  $users = Invoke-RestMethod -Method Get -Uri "$base/users" -Headers $adminHeaders
  $docUser = ($users.users | Where-Object { $_.email -eq $doctorEmail } | Select-Object -First 1)
  $farmerUser = ($users.users | Where-Object { $_.email -eq $farmerEmail } | Select-Object -First 1)
  if ($docUser) { $doctorUserId = $docUser.id }
  $pending = Invoke-RestMethod -Method Get -Uri "$base/doctors/pending" -Headers $adminHeaders

  if ($docUser) {
    $verify = Invoke-RestMethod -Method Post -Uri "$base/doctors/$($docUser.id)/verify" -Headers $adminHeaders -ContentType 'application/json' -Body (@{ status = 'verified' } | ConvertTo-Json)
  }

  if ($farmerUser) {
    $upd = Invoke-RestMethod -Method Put -Uri "$base/users/$($farmerUser.id)" -Headers $adminHeaders -ContentType 'application/json' -Body (@{ location = 'Khulna' } | ConvertTo-Json)
  }

  if ($farmerUser) {
    $delFarmer = Invoke-RestMethod -Method Delete -Uri "$base/users/$($farmerUser.id)" -Headers $adminHeaders
    $farmerUserId = $null
  }

  if ($docUser) {
    $delDoctor = Invoke-RestMethod -Method Delete -Uri "$base/users/$($docUser.id)" -Headers $adminHeaders
    $doctorUserId = $null
  }

  $summary.farmerAuth = $me.user.email
  $summary.virtualDeviceId = $setup.device.id
  $summary.irrigationAction = $tick.action
  $summary.consultationCreated = [bool]$consult.consultation.id
  $summary.assistantProvider = $assistant.provider
  $summary.assistantHistoryCount = $assistantHistory.chat.messages.Count
  $summary.pendingBeforeVerify = $pending.doctors.Count
  $summary.doctorVerifiedStatus = $verify.doctor.verificationStatus
  $summary.userUpdateLocation = $upd.user.location
  $summary.cleanupFarmer = $delFarmer.userId
  $summary.cleanupDoctor = $delDoctor.userId
  $summary.totalUsersAfter = (Invoke-RestMethod -Method Get -Uri "$base/users" -Headers $adminHeaders).users.Count

  [pscustomobject]$summary | ConvertTo-Json -Depth 8
}
finally {
  if ($adminHeaders) {
    if ($farmerUserId) {
      try { Invoke-RestMethod -Method Delete -Uri "$base/users/$farmerUserId" -Headers $adminHeaders | Out-Null } catch {}
    }
    if ($doctorUserId) {
      try { Invoke-RestMethod -Method Delete -Uri "$base/users/$doctorUserId" -Headers $adminHeaders | Out-Null } catch {}
    }
  }
}
