# App Shell Tasks

## Task 1: Project Shell

Create the Vite + React + TypeScript app structure if it does not already exist.

Expected verification:

- `npm run build`

## Task 2: Route Layout

Add routes for Overview, Ledger, Capture, Meals, Imports, and Settings.

Expected verification:

- Browser smoke test confirms each route renders.

## Task 3: Responsive Navigation

Implement primary navigation for mobile and desktop.

Expected verification:

- Desktop and mobile viewport screenshots or manual notes.
- Current route is visually indicated.

## Task 4: Empty States

Add empty states and placeholders for each section.

Expected verification:

- Each section has meaningful content and no broken links.

## Task 5: Status Indicators

Add offline, sync, local-only, and review-count UI placeholders.

Expected verification:

- Mock states can be toggled or rendered for smoke testing.

## Task 6: Documentation Links

Add settings links to relevant documentation or make room for them if the runtime should not open local files.

Expected verification:

- UI does not expose broken local paths in production mode.

## Task 7: Final Smoke Test

Run final verification before PR.

Expected verification:

- `npm run build`
- app loads at `http://127.0.0.1:5173/`
- console has no errors
- desktop and mobile layouts have no overlapping text
