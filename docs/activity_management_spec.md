# Activity Management Spec

## Overview

VacationSync supports two complementary activity modes—**Propose** and **Scheduled**—that share a unified data model, creation flow, and notification framework. This spec defines the functional requirements, UI behaviors, and backend contracts needed to deliver both modes without duplicating logic.

* **Propose** is used to gauge interest and logistics before committing.
* **Scheduled** is used once the details are finalized and RSVP management is required.

Unless explicitly noted, components described in "Shared Systems" apply to both modes.

---

## Activity Creation – End-to-End Behavior

### Entry Points

Activity creation can be launched from three primary surfaces. Each surface pre-fills the creation modal with contextual data to reduce effort:

1. **Calendar cell click** — Selecting a day cell in either **Group Calendar** or **My Schedule** opens the modal with the chosen date and trip destination already selected.
2. **Add/New Activity button** — Available on the trip dashboard and both calendars. Defaults the date to "today" (or the next day that still lies within the trip window) until the user changes it.
3. **Discover Activities tab** — Pressing **Propose** or **Add to schedule** on a discovery result fills the modal with the activity title, location, and any supplied schedule metadata. If the search card includes a datetime range it becomes the default; otherwise the time remains empty for the creator to decide.

### Unified Activity Modal

There is a single activity modal with a toggle at the top that switches between **Propose to group (voting)** and **Add to schedule (RSVP)** modes. Both modes share a common field set and validation copy:

* **Required:** Activity name, date (pre-filled from entry point), and start time when the mode is Scheduled. Proposals treat start time as optional but collect it when supplied.
* **Optional:** Description, location, end time, cost per person, max participants (defaults to "No limit"), attendee selection (multi-select defaults to the entire trip, including the creator who cannot be removed), and category.
* **Validation copy:**
  * Missing required fields → “Please add a name and date.”
  * Invalid time ordering → “End time must be after start time.”
  * Date outside the trip window → “Pick a date between Trip Start and Trip End.”
  * Zero invitees → “We can’t invite zero people—add at least one attendee.”

Submission buttons show `Saving…` while requests are in flight to prevent duplicates. Successful submissions close the modal, toast “Proposal sent” or “Activity scheduled,” and immediately refresh calendars, proposal lists, and schedules.

### Proposal Submission Flow

When the creator submits in **Propose** mode:

* A proposal entity is persisted and surfaces on the **Proposals tab** under Activities.
* Lightweight "Proposed" chips appear on both the **Group Calendar** and the creator’s **My Schedule** for the selected date.
* Notifications ping selected invitees with thumbs-up / thumbs-down voting actions. Any member of the trip can vote.
* Proposals stay visible until the creator (or a trip admin) converts them to scheduled or cancels them.

**Conversion** keeps the existing details while allowing final tweaks to timing and attendees. Converting removes the proposal chip/listing and creates a scheduled activity (see below), triggering RSVP requests for the finalized invitees.

### Scheduled Submission Flow

When the creator submits in **Scheduled** mode:

* A scheduled activity record is stored for the trip with the selected attendees.
* Calendar placement:
  * **Group Calendar** shows the activity with solid styling, category color, and RSVP counts.
  * **My Schedule** shows the activity for the creator and every invitee immediately, annotated with their RSVP state. Declined members can hide the item unless they opt to view declined entries.
* Notifications send RSVP requests (Accept / Decline) to all invitees. Accepted attendees stay on their personal calendar; declining hides it (unless they opt in to view declined items).
* If a max participant cap exists, auto-limit accepts and return "Waitlist full" once capacity is reached.

### Visibility & Sync Rules

| Surface | Proposal | Scheduled |
| --- | --- | --- |
| **Proposals tab** | Lives here until converted or canceled with title, date, proposer, vote counts, and actions (Vote, Convert, Cancel). | Not shown. |
| **Group Calendar** | Light "Proposed" chip on the target date. | Full card with RSVP counts and category color. |
| **Creator’s My Schedule** | Always shows proposals and scheduled activities created by them. | Always shows, matching proposal rule. |
| **Invitee My Schedule** | Default behavior: proposals remain off invitee schedules until they vote “Yes” (teams can choose to never show proposals to invitees). | Always shown with RSVP state; declined items hide unless the member toggles visibility. |

Edits by the creator or a trip admin propagate updates, send notifications, and refresh all calendar chips and list rows. Canceling an activity removes the associated entries and surfaces a confirmation toast.

### Notifications & Badges

* Proposal posted → notify invitees with a voting link.
* Proposal converted → notify invitees with RSVP controls.
* Scheduled activity created → notify invitees to RSVP.
* Edits → send “Activity updated” notifications and refresh UI surfaces.
* Max participants reached → display a "Waitlist full" badge on the activity card/chip.

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

### Surface Cadence & Visibility Rules

The same activity should appear in different parts of the product depending on its mode and the viewer. The following rules keep the experience predictable:

#### Proposed Activities

* **Creation:** As soon as a proposal is created it appears in the **Proposals tab** for every invitee (and trip admins/creator) with 👍/👎 voting. A lightweight "Proposed" chip is also placed on the **Group Calendar** date; clicking it opens the proposal and allows inline voting.
* **Personal calendar:** Proposals stay off **My Schedule** for invitees by default to keep the surface focused on confirmed plans. Teams may opt into showing them only after the member votes “Yes,” but one rule must be applied consistently.
* **Conversion:** When the organizer converts a proposal, it disappears from the proposal list (or receives a "Scheduled" tag in historical views), leaves the calendar chip state, and becomes a scheduled activity that now drives RSVP collection.

#### Scheduled Activities

* **Creation:** Scheduled activities render as full event cards on the **Group Calendar** for invitees, with RSVP state (Invited / Going / Not going) shown inline or on hover. They immediately appear on **My Schedule** for the creator and every invitee with the appropriate RSVP chip. They do not appear in the Proposals tab.
* **Updates:** Changing date, time, or location updates both calendar surfaces instantly and sends notifications to invitees whose schedules are affected. The personal schedule mirrors those changes for every member who sees the event.
* **Cancellation:** Canceling removes the activity from both calendar views (optionally leaving a brief "Canceled" state) without reintroducing it to the Proposals tab.

#### Snapshot Table

| View | Proposed | Scheduled (Invited) | Scheduled (Going) |
| --- | --- | --- | --- |
| **Proposals tab** | ✅ | ❌ | ❌ |
| **Group Calendar** | ✅ (light chip) | ✅ (full card) | ✅ (full card) |
| **My Schedule** | ❌ *(or ✅ after "Yes" vote if that variant is chosen)* | ✅ | ✅ |

#### Edge Case Handling

* **Invitee filtering:** Only invited members (plus trip admins/creator) can see a given activity across all surfaces.
* **Capacity awareness:** Invited members see scheduled activities on My Schedule even when the event is at capacity; if they are waitlisted, their status chip reflects it.
* **Multiple activities per day:** Day cells show up to _N_ items and then collapse into a `+X more` pill that opens a popover listing every proposal and scheduled event with inline vote/RSVP controls.
* **Timezone display:** Use the trip's timezone as the primary display while optionally showing a subtle hint of the viewer's local time.
* **Conversion behavior:** Converting a proposal immediately removes it from proposal listings, surfaces it as a scheduled activity, and triggers RSVP requests per the scheduled activity rules.

#### Plain-Language Scenarios

* **Propose "Dinner" for Friday at 7 PM:** Appears in the Proposals tab (all invitees can vote) and as a "Proposed" chip on the Group Calendar, but not on My Schedule.
* **Publish "Dinner" for Friday at 7 PM:** Leaves the Proposals tab, shows as a scheduled card on the Group Calendar, and appears on My Schedule for each invitee with their current RSVP state.
* **RSVP "Going":** My Schedule retains the event and reflects the "Going" status; the Group Calendar updates aggregate counts.
* **Move dinner to 7:30 PM:** Both calendars update instantly and notifications alert every invitee.

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
