# Manual Device Testing Runbook

## Prerequisites
- Android device with API 24+ (7.0+)
- Backend server running locally or on staging
- Parent portal (frontend) deployed and accessible
- USB debugging enabled on Android device

## Setup
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Install APK on device via Android Studio
4. Open browser to `http://localhost:5173`

---

## Test Matrix

### 1. Onboarding Flow
| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 1.1 | Open app | Splash screen, then onboarding | |
| 1.2 | Navigate intro screens | Smooth transitions, skip button works | |
| 1.3 | Register via backend API | Account created, JWT received | |
| 1.4 | Grant permissions | All permission dialogs appear | |
| 1.5 | Verify accessibility | TalkBack reads all UI elements | |

### 2. Device Pairing
| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 2.1 | Register device via API | Device registered, pairing code returned | |
| 2.2 | Pair from parent portal | Device appears in child's device list | |
| 2.3 | Verify device status | Online indicator shows | |
| 2.4 | Re-pair same device | Graceful handling, no duplicates | |

### 3. App Blocking
| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 3.1 | Block Instagram from portal | Rule appears in blocked list | |
| 3.2 | Open Instagram on device | App blocked overlay shown | |
| 3.3 | Unblock from portal | Instagram accessible again | |
| 3.4 | Block with daily time limit | App blocked after limit exceeded | |
| 3.5 | Remove blocking rule | App accessible, rule removed | |

### 4. Screen Time
| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 4.1 | Use apps for 5+ minutes | Usage data uploaded to backend | |
| 4.2 | View daily screen-time in portal | Correct per-app breakdown | |
| 4.3 | View weekly summary | Aggregated data across days | |
| 4.4 | Set 30-min daily limit | Alert triggered after 30 min | |
| 4.5 | Set limit to 0 | All apps blocked immediately | |
| 4.6 | Clear limit | Apps accessible again | |

### 5. Location Tracking
| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 5.1 | Walk 100m with device | Location updates sent to backend | |
| 5.2 | View current location in portal | Map shows correct position | |
| 5.3 | View location history | Timeline of visited locations | |
| 5.4 | Check GPS accuracy | Accuracy < 20m in open area | |
| 5.5 | Test indoor location | Graceful degradation, accuracy noted | |

### 6. Contact Management
| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 6.1 | Add ALLOW contact (parent) | Contact appears in list | |
| 6.2 | Add BLOCK contact (stranger) | Contact appears in list | |
| 6.3 | Block incoming call from BLOCK contact | Call blocked on device | |
| 6.4 | Allow incoming call from ALLOW contact | Call goes through | |
| 6.5 | Toggle contact to opposite rule | Rule type updated | |
| 6.6 | Delete contact | Contact removed, rule inactive | |

### 7. Scheduled Locks
| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 7.1 | Create lock (all days, 9PM-7AM) | Lock appears in list | |
| 7.2 | Wait for lock time (or change device clock) | Device locked | |
| 7.3 | Toggle lock off | Device unlocks | |
| 7.4 | Create lock for specific day only | Only active on that day | |
| 7.5 | Delete lock | Lock removed, no effect | |

### 8. Notifications & Alerts
| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 8.1 | App blocked | Notification shown to parent | |
| 8.2 | Screen-time limit reached | Alert in portal + notification | |
| 8.3 | Tamper attempt (disable accessibility) | Tamper alert sent | |
| 8.4 | Device goes offline | Offline indicator in portal | |

### 9. Security & Edge Cases
| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 9.1 | Login with wrong password | 401 error, no token issued | |
| 9.2 | Use expired JWT | 401 error, re-login required | |
| 9.3 | Access other parent's child | 403 Forbidden | |
| 9.4 | Send oversized request body | 413 Payload Too Large | |
| 9.5 | Send invalid JSON | 400 Bad Request | |
| 9.6 | Rapid-fire 100 requests | Rate limiter responds 429 | |

### 10. Performance
| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 10.1 | Cold start time | < 3 seconds to onboarding | |
| 10.2 | API response time (p95) | < 500ms for all endpoints | |
| 10.3 | Battery drain (1 hour) | < 5% additional drain | |
| 10.4 | Memory usage | < 150MB RAM average | |
| 10.5 | Location battery impact | Minimal when GPS not active | |

---

## Regression Checklist (Post-Fix)
After any bug fix, re-run:
- [ ] The specific failing test case
- [ ] Adjacent test cases in the same feature
- [ ] Authentication flow (register/login/pair)
- [ ] All test suites: `cd backend && npm test`
- [ ] Frontend builds: `cd frontend && npm run build`

## Device Compatibility
Test on at minimum:
- [ ] Pixel 7 (Android 14) — primary dev device
- [ ] Samsung Galaxy (Android 13) — Samsung-specific ROM differences
- [ ] Android emulator API 24 (7.0) — minimum supported version
