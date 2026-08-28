# SKILL: Android Development for Kavach Parental Control App

**Applies to:** Any AI model (Claude, GPT-4, Llama, Gemini, Mistral, etc.)
**Purpose:** Guide AI in generating consistent, production-quality Android/Kotlin code for this project
**How to use:** Paste this entire file as context/system prompt before requesting Android code generation

---

## 1. PROJECT CONTEXT

You are helping build **Kavach**, a parental control Android app with 24 features across 5 phases. When generating code, you must follow the standards below so that all generated code is consistent, regardless of which AI model produced it.

---

## 2. TECHNICAL STANDARDS (NON-NEGOTIABLE)

### Language & Architecture
- **Language:** Kotlin only (no Java)
- **Architecture:** MVVM + Clean Architecture (UI → ViewModel → Repository → Service/DataSource)
- **UI Framework:** Jetpack Compose (not XML layouts)
- **DI:** Hilt (`@HiltViewModel`, `@Inject`, `@Module`, `@InstallIn`)
- **Async:** Kotlin Coroutines + Flow/StateFlow (never callbacks, never RxJava)
- **Database:** Room (never raw SQLite)
- **Networking:** Retrofit + OkHttp
- **Min SDK:** 26 (Android 8.0) | **Target SDK:** 34

### Package Structure (always follow this)
```
com.safeguard.parentalcontrol/
├── ui/
│   ├── screens/{feature}/       -> Composable screens
│   ├── components/              -> Reusable composables
│   └── theme/                   -> Color, Type, Theme.kt
├── viewmodel/{feature}/         -> ViewModels
├── repository/{feature}/        -> Repositories
├── data/
│   ├── local/
│   │   ├── entity/               -> Room entities
│   │   ├── dao/                  -> Room DAOs
│   │   └── AppDatabase.kt
│   └── remote/
│       ├── api/                  -> Retrofit interfaces
│       └── dto/                  -> Request/response models
├── service/{feature}/           -> Foreground/background services
├── worker/                      -> WorkManager workers
├── di/                          -> Hilt modules
├── utils/                       -> Extension functions, helpers
├── security/                    -> Root detection, tamper detection
└── MainActivity.kt
```

### Naming Conventions
- Entities: `{Feature}Entity.kt` (e.g., `AppBlockRuleEntity.kt`)
- DAOs: `{Feature}Dao.kt`
- Repositories: `{Feature}Repository.kt` (interface) + `{Feature}RepositoryImpl.kt`
- ViewModels: `{Feature}ViewModel.kt`
- Services: `{Feature}Service.kt`
- Screens: `{Feature}Screen.kt`

---

## 3. MANDATORY CODE PATTERNS

### Every Service Must:
1. Extend `Service()` and be declared `foreground` if it runs continuously
2. Use `CoroutineScope(Dispatchers.Default + Job())`, cancel scope in `onDestroy()`
3. Wrap all I/O (API, DB, file) in try-catch with logging (`Log.e(TAG, "message", exception)`)
4. Return `START_STICKY` if the service must survive process death
5. Include a `companion object` with `TAG` and constants

### Every Repository Must:
1. Define an interface + implementation (for testability)
2. Follow "local-first" pattern: read from Room, sync from API in background
3. Expose data via `Flow<T>` for reactive UI updates
4. Handle offline gracefully (never crash if network unavailable)

### Every ViewModel Must:
1. Use `@HiltViewModel` + constructor injection
2. Expose UI state via `StateFlow<UiState>` (sealed class: Loading/Success/Error)
3. Never hold references to Context, Activity, or View directly
4. Use `viewModelScope.launch` for coroutines

### Every API Call Must:
1. Have a timeout (10s connect, 30s read)
2. Have retry logic (exponential backoff: 1s, 2s, 4s — max 3 retries)
3. Fall back to cached/local data on failure
4. Never crash the app on network failure

---

## 4. SECURITY REQUIREMENTS (APPLY TO ALL GENERATED CODE)

1. **Never hardcode secrets** (API keys, URLs) — use `BuildConfig` fields from `local.properties`
2. **Encrypt sensitive local storage** — use `EncryptedSharedPreferences` for PINs/tokens, never plain `SharedPreferences`
3. **Certificate pinning** required for all API clients (OkHttp `CertificatePinner`)
4. **Root/tamper detection** must be checked before allowing any settings changes
5. **No sensitive data in logs** — never log PINs, tokens, location, or personal data in production builds (`if (BuildConfig.DEBUG)` guard)

---

## 5. FEATURE-SPECIFIC GUIDANCE

When generating code for a specific feature, reference this table for the primary Android APIs to use:

| Feature | Primary Android API |
|---|---|
| App Blocking | `UsageStatsManager`, `ActivityManager`, `DevicePolicyManager` |
| Screen Time | `UsageStatsManager`, `UsageEvents` |
| Location Tracking | `FusedLocationProviderClient`, `LocationRequest` (Google Play Services) |
| Scheduled Locks | `WorkManager` (PeriodicWorkRequest), `AlarmManager` for exact timing |
| Parental Auth | `BiometricPrompt`, `EncryptedSharedPreferences` |
| Contact Management | `ContentResolver` (ContactsContract), `CallLog.Calls` |
| Website Filtering | `WebViewClient.shouldOverrideUrlLoading`, VPN Service (`VpnService`) for system-wide filtering |
| Device Health | `BatteryManager`, `StatFs` (storage), `PackageManager` (installed apps) |
| SMS/Call Monitoring | `Telephony.Sms`, `CallLog.Calls`, requires runtime permissions |
| Emergency SOS | `SmsManager`, `FusedLocationProviderClient`, `NotificationManager` (high priority) |
| Geofencing | `GeofencingClient`, `Geofence.Builder` |
| Offline Sync | `WorkManager` with `NetworkType.CONNECTED` constraint, Room as source of truth |
| Screenshot Prevention | `WindowManager.LayoutParams.FLAG_SECURE` |
| Root Detection | Check `/system/xbin/su`, `/system/bin/su`, `RootBeer` library pattern |
| Voice Commands | `SpeechRecognizer`, `RecognitionListener` |

---

## 6. WHAT NOT TO DO

- ❌ Do not use deprecated APIs (`AsyncTask`, `Loader`, XML `findViewById` in new code)
- ❌ Do not use `GlobalScope` — always use a properly scoped `CoroutineScope`
- ❌ Do not put business logic in Composables — UI layer must stay dumb
- ❌ Do not skip null-safety — avoid `!!` operator except in tests
- ❌ Do not generate code that silently swallows exceptions (empty catch blocks)
- ❌ Do not assume permissions are granted — always check `ContextCompat.checkSelfPermission` first

---

## 7. OUTPUT FORMAT EXPECTATIONS

When asked to generate a feature, always output in this order:
1. Room Entity (if applicable)
2. Room DAO (if applicable)
3. Retrofit API interface + DTOs (if applicable)
4. Repository interface + implementation
5. Service (if it's a background/foreground feature)
6. ViewModel
7. Composable UI screen
8. Hilt module bindings (if new dependencies introduced)
9. Unit test stubs for the above

Always include inline comments explaining **why**, not just what.

---

## 8. VALIDATION CHECKLIST (Before Accepting Generated Code)

- [ ] Compiles without missing imports (list all imports explicitly)
- [ ] Follows package structure above
- [ ] Includes error handling for every I/O operation
- [ ] No hardcoded strings that should be resources (`strings.xml`)
- [ ] No hardcoded secrets/URLs
- [ ] Includes at least one test stub
- [ ] Respects offline-first principle where applicable
