# Android Testing & Permission Review

## 1. Test Coverage

### Unit Tests (14 files)

| Feature | Test File | Package |
|---------|-----------|---------|
| Change PIN validation | `ChangePinValidationTest.kt` | `viewmodel.settings` |
| Onboarding ViewModel | `OnboardingViewModelTest.kt` | `viewmodel.onboarding` |
| Self-harm detection | `SelfHarmDetectorTest.kt` | `security` |
| Keylogger detection | `KeyloggerDetectorTest.kt` | `security` |
| Behavior prediction | `BehaviorPredictorTest.kt` | `security` |
| App blocking ViewModel | `AppBlockingViewModelTest.kt` | `viewmodel.appblock` |
| App blocking repository | `AppBlockingRepositoryImplTest.kt` | `repository.appblock` |
| Onboarding repository | `OnboardingRepositoryImplTest.kt` | `repository.onboarding` |
| Screen time ViewModel | `ScreenTimeViewModelTest.kt` | `viewmodel.deviceui` |
| Locks ViewModel | `LocksViewModelTest.kt` | `viewmodel.deviceui` |
| Location ViewModel | `LocationViewModelTest.kt` | `viewmodel.deviceui` |
| Contacts ViewModel | `ContactsViewModelTest.kt` | `viewmodel.deviceui` |
| Phase1 repository | `Phase1RepositoryImplTest.kt` | `repository.phase1` |
| App blocking service | `AppBlockingServiceTest.kt` | `service.appblock` |
| Screen time prefs | `ScreenTimeLimitPreferencesTest.kt` | `data.local` |
| Bedtime prefs | `BedtimePreferencesTest.kt` | `data.local` |

### Instrumentation Tests (1 file)

| Feature | Test File | Package |
|---------|-----------|---------|
| Parent lock screen | `ParentLockScreenTest.kt` | `ui.screens.parentlock` |

All tests follow the patterns established in `ParentLockScreenTest.kt`:
- Use `createComposeRule()` as a `@get:Rule`
- Interact with UI via `onNodeWithText`, `performClick`, `performTextInput`
- Assertions use JUnit `Assert.assertTrue/false` or `assertExists()`

## 2. Permission Review

- **Removed** `android.permission.GET_TASKS` – deprecated, no longer needed
- **Removed** `android.permission.READ_CALL_LOG` – not required for call-screen blocking
- Remaining dangerous permissions (`RECORD_AUDIO`, `ACCESS_FINE_LOCATION`, etc.) are justified by the app's feature set

## 3. CI Configuration

The GitHub Actions workflow `.github/workflows/ci.yml` includes Android steps:
```
./gradlew :app:assembleDebug :app:testDebugUnitTest
```

The `testOptions` block in `android/app/build.gradle.kts` ensures Android resources are packaged for instrumentation.

## 4. Re-using Existing Test Patterns

`ParentLockScreenTest.kt` demonstrates the minimal boilerplate:
1. `createComposeRule()` rule
2. Pin-store setup via `ApplicationProvider.getApplicationContext()`
3. UI interaction + assertions

New test classes should copy the import section, the `@get:Rule` declaration, and the helper `newPinStore()` / context-provider pattern, then replace the screen-specific components.
