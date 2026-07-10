# App Shell Requirements

The app shell is the first usable V1 surface. It provides navigation, authentication states, offline/sync visibility, and empty states for later ledger features.

## Scope

This spec covers:

- initial PWA shell
- top-level navigation
- signed-out and signed-in states
- empty states for V1 sections
- offline and local-only status indicators
- review queue entry point
- minimal manual transaction draft capture

This spec does not implement confirmed ledger CRUD, account/category CRUD, balance calculation, import parsing, media upload, AI/OCR, or Supabase schema. Those features get separate specs.

## Requirements

WHEN the app first loads
THE SYSTEM SHALL show a stable application shell without requiring ledger data.

WHEN the user is not authenticated
THE SYSTEM SHALL show a signed-out state with the product name and a sign-in entry point.

WHEN the user is authenticated
THE SYSTEM SHALL show the primary navigation.

WHEN primary navigation is visible
THE SYSTEM SHALL include Overview, Ledger, Capture, and Settings.

WHEN the user selects Overview
THE SYSTEM SHALL show account summary, confirmed ledger records, and draft review status placeholders.

WHEN the user selects Ledger
THE SYSTEM SHALL show an empty confirmed ledger state and any local drafts waiting for review.

WHEN the user selects Capture
THE SYSTEM SHALL show capture choices for manual entry, scan receipt or invoice, meal photo, and attachment.

WHEN the user selects manual entry from Capture
THE SYSTEM SHALL show a minimal transaction draft form.

WHEN the user submits the minimal transaction draft form
THE SYSTEM SHALL create a local draft that is visible in the review queue.

WHEN a local draft is created
THE SYSTEM SHALL NOT create a confirmed ledger record.

WHEN the user selects Settings
THE SYSTEM SHALL show account, sync, import, and export safeguards.

WHEN the app is offline
THE SYSTEM SHALL show an offline indicator without blocking navigation.

WHEN the app has local-only data
THE SYSTEM SHALL show a local-only indicator until data is synced or discarded.

WHEN the app has unresolved review items
THE SYSTEM SHALL show the review count in the shell and a draft review entry point from Capture and Ledger.

WHEN a section is not implemented yet
THE SYSTEM SHALL show a useful empty state instead of a broken or hidden page.

WHEN viewed on mobile width
THE SYSTEM SHALL keep primary navigation reachable and avoid overlapping text.

WHEN viewed on desktop width
THE SYSTEM SHALL keep the main content readable without marketing-style landing page layout.

## Non-Functional Requirements

The shell must build with Vite, React, and TypeScript.

The shell must be PWA-ready but does not need final service-worker behavior in this spec.

The shell must not require real Supabase credentials to render local smoke-test states.

The shell must not create official ledger records.

The shell must not upload media or call AI/OCR services.

The shell must not treat local draft data as backed up cloud data.
