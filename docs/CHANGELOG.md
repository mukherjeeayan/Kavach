# Changelog

All notable changes to the Kavach parental control platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Admin dashboard with system stats, user management, and feature flags
- Subscription management with Razorpay payment integration
- 7-day free trial for new users
- Premium feature gating with tier-based access control (FREE / TRIAL / PREMIUM)
- PremiumLockOverlay component for blurred content with upgrade prompts
- Subscription tier display in dashboard header with upgrade link
- Dark mode support across all pages including Settings
- Screen time analytics gated for TRIAL tier users
- Backend subscription middleware (requirePremium) on all premium routes
- Trial expiry background job (daily scheduler)
- Refresh token now preserves subscription context
- Tests for AdminDashboard, SubscriptionPage, and PremiumLockOverlay

### Fixed
- Critical: PremiumLockOverlay now correctly enforces tier access (TRIAL users cannot see PREMIUM features)
- Token refresh no longer loses subscription tier context
- Settings page now has full dark mode support
- Admin dashboard table now scrolls horizontally on mobile
- Header test mock for subscription tier

### Changed
- Razorpay is now the sole payment gateway (Stripe and Google Play removed)
- Subscription upgrade link added to dashboard header navigation

## [0.1.0] - 2026-08-01

### Added
- Initial release
- Backend: 31 feature modules with REST API
- Frontend: React dashboard with 17 pages
- Android: Kotlin/Jetpack Compose app with 18 screens
- PostgreSQL database with 21 migrations
- Docker deployment (dev + production)
- CI pipeline with GitHub Actions
- OpenAPI documentation
- Comprehensive test suites (backend: 643 tests, frontend: 515 tests)
