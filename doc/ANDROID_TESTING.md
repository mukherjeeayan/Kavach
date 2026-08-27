# Android UI Testing & Permission Review

## 1. Test Coverage
| Feature | Test Class | Package | Framework |
|---------|------------|---------|-----------|
| Onboarding flow | `OnboardingTest.kt` | `com.safeguard.parentalcontrol.ui.screens.onboarding` | Espresso / Compose |
| Device-List screen | `DeviceListTest.kt` | `com.safeguard.parentalcontrol.ui.screens.devicelist` | Espresso / Compose |
| SOS Screen | `SOSScreenTest.kt` | `com.safeguard.parentalcontrol.ui.screens.sos` | Espresso / Compose |
| Geofence Settings | `GeofenceSettingsTest.kt` | `com.safeguard.parentalcontrol.ui.screens.geofence` | Espresso / Compose |
| Screen-Time Settings | `ScreenTimeSettingsTest.kt` | `com.safeguard.parentalcontrol.ui.screens.screentime` | Espresso / Compose |

All tests follow the patterns established in **`ParentLockScreenTest.kt`**:
- Use `createComposeRule()` (or `ComposeTestRule`) as a `@get:Rule`.
- Interact with UI via `onNodeWithText`, `performClick`, `performTextInput`.
- Assertions use JUnit `Assert.assertTrue/false` or `assertExists()`.

## 2. Permission Review
- **Removed** `android.permission.GET_TASKS` – deprecated, no longer needed.
- **Removed** `android.permission.READ_CALL_LOG` – not required for call‑screen blocking.
- Remaining dangerous permissions (`RECORD_AUDIO`, `ACCESS_FINE_LOCATION`, etc.) are justified by the app's feature set.

## 3. CI Configuration
- The GitHub Actions workflow `.github/workflows/android-ci.yml` now includes a step:
  ```
  ./gradlew :app:connectedDebugAndroidTest
  ```
- This builds the debug APK and runs all instrumentation tests (unit + UI) on the configured emulator/device.
- The `testOptions` block in `app/build.gradle.kts` ensures Android resources are packaged for instrumentation.

## 4. Re‑using Existing Test Patterns
- `ParentLockScreenTest.kt` demonstrates the minimal boiler‑plate:
  1. `createComposeRule()` rule.
  2. Pin‑store setup via `ApplicationProvider.getApplicationContext()`.
  3. UI interaction + assertions.
- New test classes should copy the import section, the `@get:Rule` declaration, and the helper `newPinStore()` / context‑provider pattern, then replace the screen‑specific components.