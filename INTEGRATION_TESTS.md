# 🧪 Integration Testing Guide

## ✅ Complete Backend-Frontend Integration Tests

This document provides step-by-step tests to verify that the entire system works correctly.

---

## 🚀 Quick System Verification

### Test 1: Basic Startup
```bash
# Start the system
npm install
npm run dev

# Expected:
✓ Server starts on http://localhost:5173
✓ No console errors
✓ App loads successfully
```

### Test 2: Demo Mode Authentication
```
1. Open http://localhost:5173
2. Click "Login" button
3. Enter phone: 01712345678
4. Click "Send OTP"
5. Enter OTP: 123456
6. Click "Verify"

Expected:
✓ Login successful
✓ User name appears in header
✓ Dashboard loads
✓ No errors in console
```

### Test 3: Guest Mode
```
1. Open http://localhost:5173
2. Click "Continue as Guest"

Expected:
✓ Dashboard loads
✓ Limited features available
✓ "Login" button visible
```

---

## 🔐 Authentication Tests

### Test 4: Sign Up (New User)
```
1. Click "Sign Up"
2. Enter phone: 01798765432
3. Enter name: "Test Farmer"
4. Select role: "Farmer"
5. Enter location: "Dhaka"
6. Click "Send OTP"
7. Enter OTP: 123456
8. Click "Sign Up"

Expected:
✓ Account created
✓ Logged in automatically
✓ User data saved
✓ Token stored
```

### Test 5: Sign Up (Doctor)
```
1. Click "Sign Up"
2. Enter phone: 01798765433
3. Enter name: "Dr. Test"
4. Select role: "Doctor"
5. Enter specialty: "Crop Disease"
6. Enter registration: "BMA12345"
7. Click "Send OTP"
8. Enter OTP: 123456
9. Click "Sign Up"

Expected:
✓ Account created
✓ Status: "Pending verification"
✓ Limited access until verified
```

### Test 6: Session Persistence
```
1. Login as: 01712345678
2. Refresh page (F5)

Expected:
✓ Still logged in
✓ User data retained
✓ No re-login required
```

### Test 7: Logout
```
1. Login as: 01712345678
2. Click profile icon
3. Click "Logout"

Expected:
✓ Logged out
✓ Redirected to home
✓ Token cleared
✓ Guest mode activated
```

---

## 🌾 Feature Tests (Farmer)

### Test 8: Disease Detection
```
1. Login as Farmer
2. Go to "Disease Detection"
3. Click "Take Photo" (or use mock)
4. Wait for analysis

Expected:
✓ Disease identified
✓ Confidence score shown
✓ Treatment recommendations
✓ Option to consult expert
```

### Test 9: Create Consultation
```
1. From disease detection result
2. Click "Consult Expert"
3. Fill in description
4. Click "Submit"

Expected:
✓ Consultation created
✓ Status: "Pending"
✓ Visible in "Consultations" tab
✓ Real-time notification (if enabled)
```

### Test 10: View Market Prices
```
1. Go to "Market Prices"
2. Select location: "Dhaka"
3. Select crop: "Rice"

Expected:
✓ Current price displayed
✓ Price trend chart
✓ Historical data
✓ "Set Alert" button
```

### Test 11: Create Price Alert
```
1. In Market Prices
2. Click "Set Alert"
3. Select crop: "Rice"
4. Enter target price: 50
5. Select condition: "Below"
6. Click "Create Alert"

Expected:
✓ Alert created
✓ Visible in alerts list
✓ Active status
```

### Test 12: Smart Irrigation
```
1. Go to "Irrigation"
2. View current moisture level
3. Toggle automatic mode
4. Set schedule

Expected:
✓ Current status displayed
✓ Schedule saved
✓ Device status updated
```

---

## 👨‍⚕️ Feature Tests (Doctor)

### Test 13: Doctor Login
```
1. Login as: 01812345678 (Doctor)
2. OTP: 123456

Expected:
✓ Login successful
✓ Doctor dashboard loads
✓ Consultation queue visible
```

### Test 14: View Consultation Queue
```
1. Login as Doctor
2. Go to "Consultations"

Expected:
✓ Pending consultations listed
✓ Farmer details visible
✓ Images displayed
✓ Priority indicators
```

### Test 15: Respond to Consultation
```
1. Click on pending consultation
2. Write response
3. Add treatment recommendations
4. Change status to "Resolved"
5. Click "Submit"

Expected:
✓ Response saved
✓ Status updated
✓ Farmer receives notification
✓ Removed from pending queue
```

### Test 16: Review Disease Detection
```
1. Go to "Disease Review"
2. View AI detection results
3. Confirm or correct diagnosis
4. Add expert notes
5. Submit review

Expected:
✓ Review saved
✓ AI accuracy improved
✓ Feedback recorded
```

---

## 👑 Feature Tests (Admin)

### Test 17: Admin Login
```
1. Login as: 01912345678 (Admin)
2. OTP: 123456

Expected:
✓ Login successful
✓ Admin dashboard loads
✓ System statistics visible
✓ SMS status badge shown
```

### Test 18: View All Users
```
1. Go to "User Management"
2. View user list

Expected:
✓ All users displayed
✓ Filter by role works
✓ Search works
✓ User details accessible
```

### Test 19: Verify Doctor
```
1. Go to "Doctor Verification"
2. View pending doctors
3. Click "Verify" on a doctor
4. Confirm verification

Expected:
✓ Doctor status: "Verified"
✓ Removed from pending list
✓ Doctor receives notification
✓ Full access granted
```

### Test 20: Update Market Price
```
1. Go to "Market Prices"
2. Click "Update Price"
3. Select crop: "Rice"
4. Enter new price: 52
5. Submit

Expected:
✓ Price updated
✓ Timestamp recorded
✓ Real-time update sent
✓ Alerts triggered (if any)
```

### Test 21: Monitor SMS Status
```
1. View SMS Status Badge
2. Click to expand

Expected:
✓ Current mode displayed
✓ Configuration details shown
✓ Test button visible (if admin)
```

---

## ⚡ Real-time Tests

### Test 22: Live Notifications
```
Setup: Two browsers
Browser 1: Login as Farmer
Browser 2: Login as Doctor

Test:
1. Farmer creates consultation (Browser 1)
2. Check Doctor dashboard (Browser 2)

Expected:
✓ Doctor receives toast notification
✓ Consultation appears in queue
✓ Unread badge updates
✓ No page refresh needed
```

### Test 23: Consultation Status Update
```
Setup: Two browsers
Browser 1: Login as Farmer
Browser 2: Login as Doctor

Test:
1. Doctor responds to consultation (Browser 2)
2. Check Farmer consultations (Browser 1)

Expected:
✓ Farmer receives notification
✓ Status changes to "Resolved"
✓ Response visible immediately
✓ Unread badge updates
```

### Test 24: Market Price Alert
```
Setup: Alert created for Rice < 50

Test:
1. Admin updates Rice price to 48
2. Check Farmer notifications

Expected:
✓ Alert triggered
✓ Toast notification displayed
✓ Notification panel updated
✓ Alert marked as triggered
```

### Test 25: Connection Status
```
Test:
1. Open app (online)
2. Disable network
3. Try to perform action
4. Enable network

Expected:
✓ Online indicator: Green pulse
✓ Offline indicator: Red
✓ Auto-reconnect on network restore
✓ Queued actions sync
```

---

## 📱 SMS Integration Tests

### Test 26: SMS Service Status (Demo Mode)
```
Config: No Twilio credentials

Test:
1. Request OTP for: 01712345678

Expected:
✓ "OTP sent (demo mode)" message
✓ Console log: "OTP: 123456"
✓ Any 6-digit OTP accepted
✓ No actual SMS sent
```

### Test 27: SMS Service Status (Production Mode)
```
Config: Twilio credentials configured

Test:
1. Request OTP for: +8801712345678

Expected:
✓ "OTP sent" message
✓ Real SMS received
✓ Only correct OTP accepted
✓ SMS Status Badge: "SMS Active"
```

### Test 28: Phone Number Formatting
```
Test various formats:
- 01712345678
- +8801712345678
- 8801712345678
- 1712345678

Expected:
✓ All formats accepted
✓ Converted to: +8801712345678
✓ SMS sent correctly
✓ No validation errors
```

### Test 29: OTP Expiration
```
Config: Production mode

Test:
1. Request OTP
2. Wait 6 minutes
3. Try to verify

Expected:
✓ "Expired OTP" error
✓ "Resend OTP" button shown
✓ New OTP request allowed
```

---

## 🌐 Offline Mode Tests

### Test 30: Offline Disease Detection
```
Test:
1. Login while online
2. Disable network
3. Go to Disease Detection
4. Take/upload photo

Expected:
✓ Detection works offline
✓ Result displayed
✓ Cached recommendations shown
✓ Saved to local storage
```

### Test 31: Offline Data Access
```
Test:
1. View market prices (online)
2. Disable network
3. Refresh page
4. View market prices again

Expected:
✓ Cached data displayed
✓ "Offline" indicator shown
✓ Last sync time visible
✓ No network errors
```

### Test 32: Sync on Reconnect
```
Test:
1. Create consultation (offline)
2. Enable network

Expected:
✓ Auto-sync triggered
✓ Consultation uploaded
✓ "Synced" indicator shown
✓ Confirmation notification
```

---

## 🎨 UI/UX Tests

### Test 33: Language Toggle
```
Test:
1. Toggle to English
2. Navigate pages
3. Toggle back to Bengali

Expected:
✓ All text translates
✓ Preference saved
✓ Persists on refresh
✓ No layout breaks
```

### Test 34: Theme Toggle
```
Test:
1. Click theme toggle (Light → Dark)
2. Navigate pages
3. Toggle back

Expected:
✓ Colors change smoothly
✓ Preference saved
✓ System preference respected
✓ No flash of wrong theme
```

### Test 35: Responsive Design
```
Test:
1. Open on mobile (375px)
2. Open on tablet (768px)
3. Open on desktop (1920px)

Expected:
✓ Layout adapts correctly
✓ Navigation changes (bottom ↔ sidebar)
✓ All features accessible
✓ No horizontal scroll
```

### Test 36: Animations
```
Test:
1. Click buttons
2. Open modals
3. Show notifications
4. Navigate pages

Expected:
✓ Smooth transitions
✓ No janky animations
✓ Loading spinners shown
✓ Toast messages animate in/out
```

---

## 🔒 Security Tests

### Test 37: Unauthorized Access
```
Test:
1. Logout
2. Try to access: /admin

Expected:
✓ Redirected to login
✓ "Unauthorized" message
✓ Access denied
```

### Test 38: Role-Based Access
```
Test:
1. Login as Farmer
2. Try to access: /admin

Expected:
✓ Access denied
✓ "Admin access required" message
✓ Redirected to dashboard
```

### Test 39: Token Expiration
```
Test:
1. Login
2. Manually expire token
3. Try to make API call

Expected:
✓ "Unauthorized" error
✓ Auto-logout triggered
✓ Redirect to login
✓ Token cleared
```

### Test 40: XSS Protection
```
Test:
1. Enter: <script>alert('xss')</script>
2. In name field
3. Submit

Expected:
✓ Script not executed
✓ Input sanitized
✓ Displayed as text
✓ No security warning
```

---

## 📊 Performance Tests

### Test 41: Page Load Time
```
Test:
1. Clear cache
2. Load homepage
3. Measure time

Expected:
✓ Initial load < 3 seconds
✓ Time to Interactive < 5 seconds
✓ No console errors
```

### Test 42: API Response Time
```
Test:
1. Login
2. Load consultations
3. Measure time

Expected:
✓ API response < 500ms
✓ Data renders < 100ms
✓ Loading states shown
```

### Test 43: Real-time Latency
```
Test:
1. Trigger notification
2. Measure delivery time

Expected:
✓ Notification received < 1 second
✓ UI updates immediately
✓ No lag or delay
```

---

## ✅ Integration Test Summary

Run all tests and check off:

### Critical Tests (Must Pass):
- [ ] Test 2: Demo Mode Authentication
- [ ] Test 8: Disease Detection
- [ ] Test 13: Doctor Login
- [ ] Test 17: Admin Login
- [ ] Test 22: Live Notifications
- [ ] Test 30: Offline Disease Detection

### Important Tests (Should Pass):
- [ ] Test 6: Session Persistence
- [ ] Test 9: Create Consultation
- [ ] Test 15: Respond to Consultation
- [ ] Test 19: Verify Doctor
- [ ] Test 25: Connection Status
- [ ] Test 33: Language Toggle

### Optional Tests (Nice to Have):
- [ ] Test 27: SMS Production Mode
- [ ] Test 36: Animations
- [ ] Test 41: Page Load Time
- [ ] Test 42: API Response Time

---

## 🐛 Troubleshooting

### Issue: Login not working
**Check:**
1. Browser console for errors
2. Network tab for API calls
3. OTP in demo mode (123456)
4. Phone number format

### Issue: Real-time not working
**Check:**
1. User is logged in
2. Internet connection
3. Browser supports WebSocket
4. Console for connection errors

### Issue: SMS not sending
**Check:**
1. Twilio credentials configured
2. Phone number verified (trial)
3. Twilio Console logs
4. System falls back to demo mode

---

## 📝 Test Report Template

```markdown
## Test Report - [Date]

### Environment:
- Browser: [Chrome/Firefox/Safari]
- Mode: [Demo/Production]
- SMS: [Enabled/Disabled]

### Tests Run:
- Total: 43
- Passed: __
- Failed: __
- Skipped: __

### Failed Tests:
1. Test #X: [Description]
   - Error: [Error message]
   - Expected: [Expected behavior]
   - Actual: [Actual behavior]

### Notes:
[Additional observations]

### Conclusion:
[Pass/Fail with recommendations]
```

---

## 🎉 Success Criteria

The system is fully workable if:
- ✅ All Critical Tests pass
- ✅ 90%+ of Important Tests pass
- ✅ No security vulnerabilities
- ✅ Performance metrics met
- ✅ User experience smooth

---

**Ready to test!** 🧪✨
