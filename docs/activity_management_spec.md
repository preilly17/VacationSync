# Activity Management Spec

## Overview

VacationSync supports two complementary activity modes—**Propose** and **Scheduled**—that share a unified data model, creation flow, and notification framework. This spec defines the functional requirements, UI behaviors, and backend contracts needed to deliver both modes without duplicating logic.

* **Propose** is used to gauge interest and logistics before committing.
* **Scheduled** is used once the details are finalized and RSVP management is required.

Unless explicitly noted, components described in "Shared Systems" apply to both modes.

---

## Shared Systems

### Creation Modal

Single modal with a top-level toggle (`Propose | Scheduled`) that determines which mode-specific fields appear. Fields are grouped as follows:

* **Common fields (all modes):** Title, Category, Description, Location/Virtual link, Optional Cost + Currency, Attachments (image/link/docs).
* **Propose-only fields:** Proposed date/time options (multi-select poll), Minimum quorum, Decision deadline, Interest type (binary or 1–5 scale), Member data collection toggles (time preferences, max budget, ride share, notes).
* **Scheduled-only fields:** Start/end datetime, Optional capacity with waitlist toggle, RSVP deadline, Reminder schedule (default 48h & 4h before), Plus-one allowance (max per person).

Validation rules and submission handlers are shared; only the payload slice controlled by the active toggle differs.

### Activity Cards & Tabs

Tabs partition activities by mode while reusing a shared card component with mode-specific sections.

* **Proposals Tab:** Two sections per user—"Accepted/Booked" (responded or converted) and "Pending" (awaiting response). Each card displays title, earliest proposed window, interest counts vs. group size, quorum progress bar, decision deadline, and the member's status chip.
* **Scheduled Tab:** Cards show sticky Accept/Decline actions, capacity meter, RSVP deadline, member status, and waitlist badge when applicable. Past activities move automatically to a "Completed" sub-section with attendance notes.

### Notifications & Reminders

* Reminder scheduler supports configurable templates; mode-specific timing (see each mode) feeds into the same scheduler service.
* Notifications target only relevant members (non-responders for proposals, confirmed attendees for scheduled events).

### Data Model

```
activities
  id, type {PROPOSE|SCHEDULED}, title, category, description,
  location, cost_minor, currency, creator_id,
  start_at, end_at, capacity, rsvp_deadline_at,
  decision_deadline_at, min_quorum, interest_mode {BINARY|SCALE},
  status {DRAFT|OPEN|MET_QUORUM|PLANNED|CONFIRMED|COMPLETED|CANCELED},
  created_at, updated_at

activity_options   // proposal time poll slots
  id, activity_id, starts_at, ends_at

responses
  id, activity_id, user_id,
  interest {INTERESTED|NOT|SCALE_1..5},
  preferred_option_id (nullable),
  budget_minor (nullable),
  notes (text),
  rsvp {ACCEPT|DECLINE|WAITLIST},
  plus_ones (int),
  created_at, updated_at
```

* `interest` fields are used only when `type=PROPOSE`; `rsvp`/`plus_ones` are used only when `type=SCHEDULED`.
* Freeform notes and budgets are visible only to organizers by default.

### API Endpoints

* `POST /activities` — Create an activity (mode determined by payload `type`).
* `POST /activities/{id}/responses` — Submit interest (Propose) or RSVP (Scheduled).
* `POST /activities/{id}/convert` — Convert a proposal to scheduled, selecting a final option and scheduling details.
* `POST /activities/{id}/cancel` — Cancel any activity (marks status as CANCELED and triggers notices).
* `GET /activities?type=PROPOSE|SCHEDULED&me=pending|responded` — Filtered fetch for tab views.

Authentication, authorization, and timezone normalization are shared concerns.

---

## Propose Mode

### Purpose

Collect interest, availability, and constraints before committing resources.

### Lifecycle States

`Draft → Open → Met Quorum → Closed (Converted | Canceled)`

* **Draft:** Organizer saves but has not opened it; invisible to members.
* **Open:** Visible to members; collecting responses until decision deadline.
* **Met Quorum:** Automatically marked when `Interested` responses ≥ `min_quorum`; triggers organizer prompt to convert.
* **Closed:** Either converted to scheduled (auto-created activity) or canceled/expired.

### Member Experience

* Response actions: Interested / Not interested (or 1–5 scale when configured).
* Optional inputs: preferred time options (multi-select), max budget, rideshare availability, freeform notes.
* Members can propose new time options if enabled by organizer.
* Members see quorum progress, decision deadline countdown, and personal response state.

### Organizer Controls

* Set minimum quorum and decision deadline (auto-close at deadline).
* Receive reminders 24h and 2h before deadline to nudge non-responders.
* Can convert at any time; conversion recommended once quorum met.
* Can re-open a closed proposal if quorum was not met (resets deadline/reminders).

### Conversion Flow

1. Organizer clicks **Convert** on an open or met-quorum proposal.
2. Modal pre-populates with top-voted time option(s); organizer selects final start/end and sets capacity/RSVP settings.
3. System creates linked Scheduled activity, carrying over interested members as pre-filled "Accept" RSVPs awaiting confirmation.
4. Proposal status set to `Closed (Converted)` and card moves to "Accepted/Booked" section.

### Reminders & Auto-Close

* Non-responders receive reminders 24h and 2h before decision deadline.
* At deadline, proposal auto-closes if quorum unmet; organizer gets summary and option to re-open.

---

## Scheduled Mode

### Purpose

Manage confirmed event logistics, capacity, and attendance.

### Lifecycle States

`Planned → Confirmed → Completed / Canceled`

* **Planned:** Created but awaiting minimum organizer criteria (optional).
* **Confirmed:** Active RSVP collection; transitions automatically when organizer confirms details or when a converted proposal goes live.
* **Completed:** Event past start time with attendance recorded.
* **Canceled:** Organizer cancels; members notified and waitlist cleared.

### Member Experience

* Primary actions: Accept or Decline.
* When capacity is enabled and full, Accept adds member to waitlist; status chip reflects WAITLIST.
* Plus-one selection limited by organizer-defined max; counts against capacity.
* Members see RSVP deadline countdown and reminder schedule.

### Organizer Controls

* Configure capacity, automatic waitlist, and auto-promote rules.
* Set RSVP deadline, reminder cadence (defaults provided), and cancellation window messaging.
* Toggle plus-ones, specifying max per member.
* Edit event details; time changes reset RSVPs to Pending and notify members.
* Post-event, mark attendance to feed future reputation signals.

### Waitlist & Auto-Promotion

* Accepting when full appends user to `WAITLIST` ordered by timestamp.
* On cancellations or capacity increase, system promotes next waitlisted member automatically and sends notification.
* Promotion converts RSVP to `ACCEPT` and removes from waitlist.

### Reminders

* RSVP deadline reminders at 48h and 4h for non-responders.
* Optional final reminder to Accepted attendees 2h before start.

---

## Additional Behaviors & Edge Cases

* **Multi-day proposals:** Support multiple options; members can select all workable slots; ranked-choice (Borda count) is a nice-to-have.
* **Privacy:** Organizer-only visibility for notes/budget responses.
* **Timezone handling:** Display times in viewer's local timezone with tooltip referencing organizer timezone.
* **Edits on scheduled activities:** Changing start/end resets RSVPs to Pending and notifies members.
* **No-shows:** Attendance tracking stored post-event for future analytics.

### Nice-to-Haves

* Ranked-choice aggregation for proposal options.
* Comment threads per activity.
* Transportation polls (e.g., carpool seats).
* Budget range filtering for proposals, especially when members decline due to cost.
* Auto-create shared expense draft after completed scheduled activities (payer-included split, FX aware).

---

## Acceptance Criteria

* Propose mode surfaces interest collection controls; no RSVP buttons shown until conversion.
* Scheduled mode surfaces immediate Accept/Decline actions for members.
* Proposals tab separates "Accepted/Booked" vs. "Pending" based on member responses.
* Conversion flow creates a scheduled activity, carries interested members into pre-filled Accept state, and notifies them.
* Capacity with waitlist supports auto-promotion and notification.
* Reminder system targets only non-responders for proposals and attending members for scheduled events.
