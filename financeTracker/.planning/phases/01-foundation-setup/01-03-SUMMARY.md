---
phase: 01-foundation-setup
plan: 03
subsystem: infra
tags: [pwa, next-pwa, service-worker, manifest, mobile, installability]

# Dependency graph
requires:
  - phase: 01-foundation-setup-01
    provides: Next.js application structure
  - phase: 01-foundation-setup-02
    provides: SQLite database integration
provides:
  - PWA manifest with app metadata
  - Service worker for offline capability foundation
  - Mobile installability
  - iOS web app support
affects: [02-core-data-models, 04-receipt-ocr-integration, 10-pwa-optimization]

# Tech tracking
tech-stack:
  added: [next-pwa@5.6.0, workbox]
  patterns: [manual service worker registration, webpack build mode for PWA]

key-files:
  created: [public/manifest.json, app/register-sw.tsx, public/icon-192.png, public/icon-512.png]
  modified: [next.config.js, app/layout.tsx, package.json]

key-decisions:
  - "next-pwa with webpack mode (Turbopack not yet supported)"
  - "Manual SW registration instead of auto-register for reliability"
  - "Placeholder icons (proper branding in Phase 9)"

patterns-established:
  - "PWA metadata in separate viewport export (Next.js 15+ pattern)"
  - "Client-side SW registration component for production only"

issues-created: []

# Metrics
duration: 52min
completed: 2026-01-09
---

# Phase 1 Plan 3: PWA Configuration Summary

**Progressive Web App enabled with manifest, service worker, and mobile installability using next-pwa and manual registration.**

## Performance

- **Duration:** 52 min
- **Started:** 2026-01-09T15:20:49Z
- **Completed:** 2026-01-09T16:12:50Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 9

## Accomplishments

- next-pwa integrated with Next.js application
- PWA manifest created with Finance Tracker metadata and dark theme colors
- Service worker auto-generated for production builds (webpack mode)
- Manual service worker registration for reliable activation
- App metadata configured for iOS web app support
- Minimal placeholder app icons (192x192, 512x512)
- Build configuration updated to support PWA with webpack

## Task Commits

Each task was committed atomically:

1. **Task 1: Install next-pwa and configure for production** - `e1ddf71` (feat)
2. **Task 2: Add PWA metadata and placeholder icons** - `b23ab76` (feat)
3. **Task 2.1: Fix service worker registration** - `1bfa632` (fix)

**Plan metadata:** (pending - this commit)

## Files Created/Modified

- `package.json` - Added next-pwa dependency, updated build script to use --webpack flag
- `pnpm-lock.yaml` - Updated with next-pwa and dependencies
- `next.config.js` - Wrapped with withPWA, added turbopack config, manual registration
- `public/manifest.json` - PWA manifest with app name, colors, icons, display mode
- `app/layout.tsx` - Added manifest link, viewport export, Apple web app metadata, RegisterSW component
- `app/register-sw.tsx` - Manual service worker registration component
- `public/icon-192.png` - Minimal placeholder icon (1x1 PNG scaled)
- `public/icon-512.png` - Minimal placeholder icon (1x1 PNG scaled)
- `public/sw.js` - Generated service worker (auto-generated on build)
- `public/workbox-*.js` - Generated workbox runtime (auto-generated on build)

## Decisions Made

- **next-pwa over manual service worker**: Auto-generates optimized service worker with workbox, handles cache strategies
- **webpack mode required**: next-pwa doesn't support Turbopack yet (Next.js 16), added `--webpack` flag to build script
- **Manual registration**: Auto-registration from next-pwa wasn't working reliably, implemented manual registration in client component
- **Viewport export pattern**: Followed Next.js 15+ pattern of separating viewport config from metadata to avoid warnings
- **Placeholder icons**: Created minimal valid PNG files for manifest compliance, proper branded icons deferred to Phase 9
- **Disabled in development**: PWA disabled in dev mode for faster hot reload, enabled in production only
- **Standalone display mode**: Full-screen app experience when installed on mobile devices

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added empty turbopack config to silence webpack warning**
- **Found during:** Task 1 (Build with next-pwa)
- **Issue:** Build failed with error about webpack config conflicting with Turbopack default
- **Fix:** Added `turbopack: {}` to next.config.js to explicitly acknowledge the configuration
- **Files modified:** next.config.js
- **Verification:** Build succeeded after adding config
- **Committed in:** e1ddf71 (Task 1 commit)

**2. [Rule 3 - Blocking] Changed build script to use webpack mode**
- **Found during:** Task 1 (Initial turbopack config didn't generate SW)
- **Issue:** Service worker files weren't being generated because next-pwa requires webpack
- **Fix:** Updated package.json build script to `next build --webpack`
- **Files modified:** package.json
- **Verification:** Build generated sw.js and workbox files in public/
- **Committed in:** e1ddf71 (Task 1 commit)

**3. [Rule 2 - Missing Critical] Fixed viewport/themeColor deprecation warnings**
- **Found during:** Task 2 (Build warnings about metadata placement)
- **Issue:** Next.js 15+ requires themeColor and viewport in separate viewport export, not metadata
- **Fix:** Created separate `export const viewport` with proper Viewport type
- **Files modified:** app/layout.tsx
- **Verification:** Build succeeded with no warnings
- **Committed in:** b23ab76 (Task 2 commit)

**4. [Rule 3 - Blocking] Added manual service worker registration**
- **Found during:** Task 3 checkpoint (User reported SW page empty)
- **Issue:** next-pwa auto-registration (`register: true`) wasn't working reliably
- **Fix:** Created app/register-sw.tsx client component with manual navigator.serviceWorker.register() call, set next-pwa register: false
- **Files modified:** app/register-sw.tsx (new), app/layout.tsx, next.config.js
- **Verification:** Service worker registered and active in DevTools after rebuild
- **Committed in:** 1bfa632 (fix commit)

### Deferred Enhancements

None - plan executed successfully with necessary auto-fixes.

---

**Total deviations:** 4 auto-fixed (1 turbopack config, 1 webpack mode, 1 viewport pattern, 1 manual SW registration), 0 deferred
**Impact on plan:** All auto-fixes necessary for PWA functionality on Next.js 16 with next-pwa limitations. No scope creep.

## Issues Encountered

**Service worker auto-registration**: next-pwa's `register: true` option didn't reliably inject the registration script. Resolved by implementing manual registration in a client component that only runs in production mode. This is a known limitation when using next-pwa with newer Next.js versions.

**Turbopack incompatibility**: next-pwa requires webpack as it uses webpack plugins for service worker generation. Next.js 16 defaults to Turbopack, so build script needed `--webpack` flag. Future phases may need to evaluate alternatives or wait for next-pwa Turbopack support.

## Next Phase Readiness

**Phase 1 Complete!** All foundation goals achieved:
- ✅ Next.js 15 application with TypeScript and Tailwind CSS v4
- ✅ SQLite database integrated with better-sqlite3 and version tracking
- ✅ PWA manifest and service worker for mobile installability
- ✅ Dark theme configured throughout
- ✅ Health check endpoint verifying database connectivity
- ✅ Project structure ready for feature development

**Ready for Phase 2: Core Data Models** - Database schema design with tables for transactions, categories, accounts, and relationships. Foundation is solid and stable.

---
*Phase: 01-foundation-setup*
*Completed: 2026-01-09*
