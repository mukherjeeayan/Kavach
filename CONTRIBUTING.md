# Contributing to Kavach

Thank you for your interest in contributing to Kavach! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 15+
- **Android Studio** (for Android development)
- **JDK 17**

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/kavach.git
   cd kavach
   ```

2. **Backend setup**
   ```bash
   cd backend
   cp .env.example .env    # Edit with your local DB credentials
   npm install
   npm run migrate
   npm run dev
   ```

3. **Frontend setup**
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

4. **Android setup**
   - Open `android/` in Android Studio
   - Sync Gradle
   - Run on device/emulator

## Project Structure

```
kavach/
├── .env.example        # Environment variable template
├── package.json        # Root monorepo config
├── scripts/
│   └── dev-server.ts   # Dev server entry point (npm run dev)
├── backend/            # Node.js/Express REST API
│   ├── src/
│   │   ├── modules/    # Feature modules (auth, children, location, etc.)
│   │   ├── middleware/
│   │   ├── db/
│   │   └── jobs/
│   └── tests/
├── frontend/           # React + Vite SPA
│   ├── eslint.config.js
│   ├── vite.config.ts
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── store/
│   └── e2e/
├── android/            # Android (Kotlin/Jetpack Compose)
│   ├── metadata.json   # App metadata
│   └── app/src/main/java/com/safeguard/parentalcontrol/
├── admin-panel/        # Admin React app (Vite)
├── deploy/             # Deployment configs (Docker, nginx)
├── docs/               # Documentation
└── loadtest/           # Load testing scripts
```

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Write or update tests
4. Run the test suite: `npm test` (backend and frontend)
5. Run linting: `npm run lint`
6. Submit a pull request

## Code Style

### Backend (TypeScript)
- Use strict TypeScript
- Follow existing module patterns (service + controller + routes + DTO)
- All route handlers use `try/catch` with `next(err)`
- Validate inputs with Zod schemas
- Write tests for new modules

### Frontend (TypeScript/React)
- Use functional components with hooks
- Follow existing component patterns
- Use Tailwind CSS for styling
- Add dark mode support (`dark:` variants)
- Write tests for new components and hooks

### Android (Kotlin)
- Use Jetpack Compose for UI
- Follow MVVM architecture
- Use Hilt for dependency injection
- Write unit tests for ViewModels and repositories

## Testing

### Backend
```bash
cd backend
npm test                    # Run all tests
npm run test:watch          # Watch mode
```

### Frontend
```bash
cd frontend
npx vitest run              # Run all tests
npx vitest run --watch      # Watch mode
```

### Android
```bash
./gradlew testDebugUnitTest  # Unit tests
./gradlew connectedDebugAndroidTest  # Instrumentation tests
```

## Pull Request Guidelines

- Write clear commit messages
- Keep PRs focused on a single change
- Include tests for new functionality
- Update documentation if needed
- Ensure all CI checks pass

## Reporting Issues

- Use GitHub Issues for bug reports
- Include steps to reproduce
- Include environment details (OS, browser, app version)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
