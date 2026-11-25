# Alphex Workbench (Phase 1 of 6)
Static HTML/CSS/vanilla JS. No build step. Open `index.html`, or run `python3 -m http.server` here and visit http://localhost:8000.
Icons (Lucide) and Figtree load from CDNs, so internet access is needed for those.

## Modes
`assets/js/core/config.js` -> `MODE: 'mock'` (sample data in this browser, labelled "Demo") or `'production'` (real API at `API_BASE_URL`).
Production never falls back to mock data; failures show an error card. Placeholders only: no secrets belong in this repo.

## Layers
UI modules (`modules/`) -> services (`services/`) -> `A.util.call` -> transport: `mock-adapter.js` or `api-client.js`.
The mock adapter answers the same REST routes as the backend contract, so switching modes needs no UI change.
Routes used so far beyond the spec (proposed): `POST /auth/verify`, `POST /auth/resend`, `POST /auth/forgot-password`, `GET /dashboard/summary`, `GET /dashboard/activity`.

## Phase 1 status
Done: design system, shell (collapsible sidebar, mobile drawer), login, sign up, forgot password, verify, dashboard, Create Project dialog.
Not built: all other pages (sidebar shows which phase). `docs/` and `router.js` come later; pages are plain multi-page links.
