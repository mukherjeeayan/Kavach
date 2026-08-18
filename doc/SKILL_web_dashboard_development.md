# SKILL: Web Dashboard Development for SafeGuard Parental Control App

**Applies to:** Any AI model (Claude, GPT-4, Llama, Gemini, Mistral, etc.)
**Purpose:** Guide AI in generating consistent React/TypeScript dashboard code
**How to use:** Paste this entire file as context/system prompt before requesting dashboard code generation

---

## 1. PROJECT CONTEXT

You are helping build the **parent-facing web dashboard** for SafeGuard. Parents use this to view analytics, manage rules, and respond to alerts for their children's devices.

---

## 2. TECHNICAL STANDARDS (NON-NEGOTIABLE)

- **Framework:** React 18 + TypeScript (strict mode)
- **State Management:** Redux Toolkit for global state, React Query for server state (never mix the two roles)
- **Styling:** Tailwind CSS or Material-UI v5 — pick ONE and stay consistent
- **Charts:** Recharts (primary) for time-series/analytics
- **Maps:** Mapbox GL for location features
- **Real-time:** Socket.io client for live updates (device status, alerts)
- **Forms:** React Hook Form + Yup/Zod validation
- **Build Tool:** Vite

### Project Structure
```
src/
├── components/
│   ├── {Feature}/         -> Feature-specific components
│   └── Common/             -> Shared components (Navbar, Sidebar, Modal, etc.)
├── pages/                  -> Route-level page components
├── services/                -> API client functions (one file per feature)
├── hooks/                   -> Custom hooks
├── store/                   -> Redux slices
├── context/                 -> React context providers
├── types/                   -> Shared TypeScript types/interfaces
├── utils/
└── App.tsx
```

### Naming Conventions
- Components: `PascalCase.tsx` (e.g., `ScreenTimeChart.tsx`)
- Hooks: `use{Name}.ts` (e.g., `useScreenTimeData.ts`)
- Redux slices: `{feature}Slice.ts`
- API services: `{feature}Api.ts`

---

## 3. MANDATORY CODE PATTERNS

### Every Component Must:
1. Be a functional component with TypeScript props interface (`interface {Name}Props`)
2. Handle loading, error, and empty states explicitly (never assume data is present)
3. Be responsive (mobile-first Tailwind classes or MUI breakpoints)

### Every API Call Must:
1. Go through React Query (`useQuery`/`useMutation`), never raw `fetch`/`axios` in components
2. Have typed request/response interfaces matching the backend DTOs
3. Handle 401 (redirect to login) and 403 (show permission error) globally via an interceptor

### Every Form Must:
1. Use React Hook Form with Yup/Zod schema validation
2. Show inline validation errors
3. Disable submit button while request is in-flight

### Real-time Updates Must:
1. Use Socket.io for: device status changes, emergency alerts, new location pings
2. Fall back gracefully to polling if WebSocket connection fails
3. Clean up socket listeners in `useEffect` cleanup function

---

## 4. SECURITY REQUIREMENTS

1. **Never store tokens in localStorage** — use httpOnly cookies (backend sets these) or in-memory storage with refresh-on-load
2. **Sanitize any user-generated content** before rendering (prevent XSS) — especially chat/SMS content shown in monitoring views
3. **Role-based UI gating** — hide/disable actions the logged-in parent role (Admin/Moderator/Viewer) isn't permitted to perform, but never rely on frontend-only enforcement (backend must also enforce)
4. **Sensitive data masking** — mask full location history and communication logs behind an explicit "reveal" action, not shown by default

---

## 5. FEATURE-SPECIFIC GUIDANCE

| Feature | Key Frontend Considerations |
|---|---|
| Screen Time Dashboard | Use Recharts LineChart/BarChart; support day/week/month toggle; lazy-load historical data |
| Location Map | Mapbox GL with clustering for history points; show geofence overlays as circles/polygons |
| App Blocking UI | Optimistic UI updates (toggle switches update immediately, rollback on API failure) |
| Emergency Alerts | Must show as a persistent, high-visibility banner/modal — cannot be dismissed without acknowledgment |
| Analytics/Reports | Support CSV/PDF export; paginate large datasets; use virtualization for long lists |
| Mental Health Dashboard | Extra confirmation step before viewing sensitive content; log access on frontend analytics |
| Multi-child Management | Clear child-switcher in the navbar; never mix data between children in the same view |

---

## 6. WHAT NOT TO DO

- ❌ Do not fetch data directly inside `useEffect` with raw fetch — use React Query
- ❌ Do not store JWT tokens in localStorage/sessionStorage
- ❌ Do not build custom date pickers/chart libraries — use established libraries
- ❌ Do not render raw HTML from user/child-generated content (`dangerouslySetInnerHTML`) without sanitization
- ❌ Do not create deeply nested prop-drilling — use Redux or Context instead
- ❌ Do not skip empty/loading/error states in any data-driven component

---

## 7. OUTPUT FORMAT EXPECTATIONS

When asked to generate a dashboard feature, always output in this order:
1. TypeScript types/interfaces (matching backend DTOs)
2. API service functions (React Query hooks)
3. Redux slice (if global state needed)
4. Component(s) — smallest reusable pieces first, then the composed page
5. Unit test stubs (React Testing Library)

---

## 8. VALIDATION CHECKLIST (Before Accepting Generated Code)

- [ ] TypeScript strict mode compatible (no implicit `any`)
- [ ] Loading/error/empty states handled
- [ ] API calls go through React Query, typed
- [ ] No tokens in localStorage
- [ ] Responsive design classes included
- [ ] Accessible (proper labels, ARIA where needed)
- [ ] No prop-drilling beyond 2 levels
