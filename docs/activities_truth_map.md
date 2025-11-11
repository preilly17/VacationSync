# Activities Truth Map

## Inventory (current code paths)

### Client pages & entry points
- `client/src/pages/activities.tsx` – Trip calendar hub; mounts month/day views and exposes the add-activity modal trigger.
- `client/src/pages/member-schedule.tsx` – Personal schedule view that filters activities by attendee/RSVP state.
- `client/src/pages/proposals.tsx` – Proposal management UI for activities plus other asset types; drives accept/decline flows.
- `client/src/pages/trip.tsx` – Trip overview shell that includes the activity calendar and modal entry point.
- `client/src/pages/home.tsx` – Dashboard tiles linking into activities, proposals, and schedule views.
- `client/src/pages/amadeus-test.tsx` – Developer/testing surface that calls activity search endpoints.
- `client/src/pages/how-it-works.tsx`, `client/src/pages/landing.tsx`, `client/src/pages/join.tsx`, `client/src/pages/restaurants.tsx` – Marketing/onboarding pages referencing activities in copy or navigation.

### Client components
- `client/src/components/add-activity-modal.tsx` – Primary activity creation form (schedule + propose) powered by React Hook Form + `useCreateActivity`.
- `client/src/components/activity-card.tsx`, `client/src/components/activity-details-dialog.tsx` – Render activity details and interactions in calendar/proposal contexts.
- `client/src/components/calendar-grid.tsx` – Month grid renderer for activities, proposals, and RSVP state; includes compact chip layout.
- `client/src/components/activity-search.tsx`, `client/src/components/booking-confirmation-modal.tsx`, `client/src/components/wish-list-board.tsx` – Surfaces that search for, recommend, or bookmark activities.
- `client/src/components/notifications-section.tsx`, `client/src/components/notification-icon.tsx`, `client/src/components/ApiDebug.tsx` – Notification stream and debugging UI referencing activity notifications.
- `client/src/components/dashboard/how-it-works-panel.tsx`, `client/src/components/leave-trip-button.tsx`, `client/src/components/expense-tracker.tsx` – Additional components with activity-related messaging or links.
- `client/src/components/__tests__/calendar-grid.proposal.test.tsx` – Unit coverage for proposal rendering inside the calendar grid.

### Client hooks & libraries
- `client/src/lib/activities/createActivity.ts` – React Query mutation hook orchestrating submissions, optimistic updates, and query syncing.
- `client/src/lib/activities/activityCreation.ts` – Client-side submission prep, optimistic builders, and API helpers.
- `client/src/lib/activitySubmission.ts` – Shared payload normalizer for both legacy and "v2" endpoints.
- `client/src/lib/activities/clientValidation.ts` – Additional form validation helpers.
- `client/src/lib/api.ts` – Generic fetch helpers including `/search/activities` discovery endpoint.
- `client/src/lib/__tests__/activitySubmission.test.ts`, `client/src/lib/activities/__tests__/createActivity.test.ts` – Unit tests for submission building and hook logic.
- `client/src/hooks/useBookingConfirmation.ts` – Notification flows that include activities.
- `client/src/lib/externalRedirects.ts`, `client/src/components/ApiDebug.tsx` – Utility functions referencing external activity booking/search URLs.

### Server routes & services
- `server/routes.ts` – Primary REST API including legacy create/propose endpoints, RSVP handlers, cancellations, notifications, and calendar queries.
- `server/storage.ts` – Database abstraction for activities, invites, responses, notifications, and calendar listings (legacy schema).
- `server/activitiesV2.ts` – Parallel service implementing a new activities_v2 table and create path.
- `server/amadeusService.ts`, `server/googleMapsService.ts` – Activity discovery integrations feeding search endpoints.
- `server/observability.ts` – Logging/metrics utilities invoked during activity lifecycle events.

### Shared schema & validation
- `shared/schema.ts` – Legacy activity types, Zod schemas, and invite status enums used across client/server.
- `shared/activityValidation.ts` – Shared validation/normalization utilities for form inputs.
- `shared/activitiesV2.ts` – Alternative schema definitions for the activities_v2 implementation.

### Tests (server side)
- `server/__tests__/createActivityRoute.test.ts`, `server/__tests__/createActivityWithInvites.test.ts` – Legacy create endpoint and storage unit tests.
- `server/__tests__/activitiesV2.create.test.ts`, `server/__tests__/activitiesV2.ensure.test.ts` – Tests covering the parallel activitiesV2 module and table initialization.
- `server/__tests__/applyActivityResponse.test.ts`, `server/__tests__/getTripActivities.test.ts` – RSVP and list coverage for activities.
- `server/__tests__/storage.ensureActivityTypeColumn.test.ts`, `server/__tests__/websocketBroadcast.test.ts` – Storage migration/notification coverage touching activity flows.

### Supporting documentation & assets
- `docs/activity_management_spec.md` – Prior product spec covering activity management expectations.
- `AMADEUS_INTEGRATION_GUIDE.md`, `LOCATION_DATABASE_GUIDE.md`, `LOCATION_SETUP_GUIDE.md`, `CURRENCY_CONVERSION_SUMMARY.md`, `PAYMENT_*` guides – Ancillary docs referencing activity booking context.
- `attached_assets/*` – Historical prompt assets with activity requirements (not executed code but useful context).

## Canonical ownership decisions

| Area | Canonical file(s) to keep | Duplicate/legacy artifacts to retire | Notes |
| --- | --- | --- | --- |
| UI Form | `client/src/components/add-activity-modal.tsx` | n/a | Single modal drives both schedule & propose; no competing form component found.
| Client API layer | `client/src/lib/activities/createActivity.ts`, `client/src/lib/activities/activityCreation.ts`, `client/src/lib/activitySubmission.ts` | n/a | Hook + helpers handle optimistic updates and validations against the unified legacy endpoint.
| Server API | `server/routes.ts` paired with `server/storage.ts` | `server/activitiesV2.ts` and its tests | Routes currently branch between legacy storage and V2 service via header; plan is to fold logic into the primary stack and drop V2 module.
| Data schema | `shared/schema.ts` + `shared/activityValidation.ts` | `shared/activitiesV2.ts` | We'll extend the existing shared schema to match canonical fields and run migrations to collapse duplicate tables.
| Calendar rendering | `client/src/components/calendar-grid.tsx` (+ `activity-card.tsx`, `activity-details-dialog.tsx`) | n/a | Single implementation for both month/day views; future work will refine layout but no duplicate component exists.
| Proposals handling | `server/routes.ts` proposal endpoints + `client/src/pages/proposals.tsx` | n/a (but rationalize status filters vs new schema) | Need to align statuses/visibility in later steps but there is a single code path today.
| RSVP workflow | `server/routes.ts#__testables.applyActivityResponse`, `server/storage.ts#setActivityInviteStatus` | n/a | RSVP logic centralized in routes/storage; will adapt to canonical statuses without introducing new modules.
| Notifications | `server/routes.ts` notification dispatch + `server/storage.ts` notification persistence + `client/src/components/notifications-section.tsx` | n/a | Ensure notifications remain single-sourced while cleaning up duplicate activity versions.

## Observations
- Activity creation now always targets the legacy endpoint; the previous `use-new-activity-create` flag has been removed.
- Activities exist in two schemas/tables (`activities` via `storage.ts` and `activities_v2` via `activitiesV2.ts`). Storage-based queries back the majority of UI state, so V2 data never surfaces outside creation tests.
- Calendar, proposals, and RSVP code each assume the legacy `ActivityWithDetails` shape from `shared/schema.ts`; adopting the canonical field list will require coordinated updates across these areas.

## Step 2 preparation notes
- Consolidate type definitions by moving canonical fields into `shared/schema.ts` and deleting `shared/activitiesV2.ts` after migration.
- Design migration to merge any data stored in `activities_v2` into the main `activities` table (or a new unified table) and drop the extra tables.
- Update client/server DTOs to use canonical field names (e.g., `startAt`, `endAt`, `status`, `visibility`) while preserving UTC storage guarantees.
- Refresh unit coverage around normalization and timezone utilities once schema is unified.
