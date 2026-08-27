# Maestro E2E Tests for Kavach Android App

## Prerequisites
- Install Maestro: `curl -Ls "https://get.maestro.mobile.dev" | bash`
- Android emulator running or device connected
- Kavach APK built: `./gradlew :app:assembleDebug`

## Running Tests

### Run all flows
```bash
maestro test .maestro/flows/
```

### Run a specific flow
```bash
maestro test .maestro/flows/01_onboarding.yaml
```

### Run by tag
```bash
maestro test --include-tags=smoke .maestro/flows/
maestro test --include-tags=feature .maestro/flows/
```

### Run critical path
```bash
maestro test .maestro/e2e-flows.yaml
```

### Record tests (codegen)
```bash
maestro studio
```

## Cloud Testing
```bash
maestro cloud app/build/outputs/apk/debug/app-debug.apk .maestro/flows/
```