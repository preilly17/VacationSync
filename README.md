# VacationSync API

## CORS Policy

The API allows cross-origin requests from our production and local development frontends. Requests must originate from one of the following origins:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:4173`
- `http://127.0.0.1:4173`
- `https://www.tripsyncbeta.com`
- `https://tripsyncbeta.com`

Any origin within the `*.tripsyncbeta.com` domain is also accepted. CORS responses include:

- `Access-Control-Allow-Origin` echoing the request origin
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`
- `Access-Control-Allow-Headers` including `Content-Type`, `Authorization`, `X-Request-ID`, `X-Filename`, `X-Content-Type`, and `X-Activities-Version`

### Testing with curl

Replace the URL with your environment as needed:

```bash
# Preflight (OPTIONS)
curl -i -X OPTIONS http://localhost:5000/api/trips/10/proposals/hotels \
  -H "Origin: https://www.tripsyncbeta.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization"

# Actual POST
curl -i -X POST http://localhost:5000/api/trips/10/proposals/hotels \
  -H "Origin: https://www.tripsyncbeta.com" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"hotelId":123}'
```

Successful responses include the CORS headers listed above. Use a different origin (e.g. `https://malicious.example.com`) to verify that disallowed origins receive a 500 response during the preflight check.

## Activity lifecycle

VacationSync now uses the v2 activities pipeline by default. All create, RSVP, and conversion flows send a `X-Activities-Version: 2` header and expect the backend to persist the unified activity shape.

- **Scheduled activities** are created via `POST /api/trips/:tripId/activities` with payload fields:
  - `mode`: `"scheduled"`
  - `title`, `date`, `start_time`, `timezone`
  - optional metadata (`description`, `location`, `cost_per_person`, `max_participants`, `category`, `end_time`)
  - `invitee_ids`: array of trip member ids (must include the creator)
- **Proposed activities** are created via `POST /api/trips/:tripId/proposals/activities` with the same payload but `mode: "proposed"` and optional `start_time`.
- **RSVP / voting** requests call `POST /api/activities/:activityId/respond` with a `status` of `accepted`, `declined`, `pending`, or `waitlisted`. For proposals the values map to thumbs up/down votes; for scheduled activities they map to RSVP state.
- **Conversion** from proposal to scheduled uses `POST /api/activities/:activityId/convert`. The conversion automatically:
  - selects every member that voted "yes" (plus the creator) as attendees,
  - creates RSVP rows (`yes` for the creator and prior yes-voters, `pending` otherwise), and
  - broadcasts websocket updates so calendars refresh in real time.

All responses return the legacy `ActivityWithDetails` shape so existing calendar/proposal UIs continue to work:

| Field | Description |
| --- | --- |
| `id` | Stable numeric id derived from the v2 UUID (`legacy_id`) |
| `type` | `"SCHEDULED"` or `"PROPOSE"` |
| `status` | `"active"`, `"pending"`, or `"canceled"` |
| `invites` | RSVP/vote state for each attendee |
| `acceptances` | Convenience list of accepted attendees |

Activities are stored in UTC and rendered in the trip timezone. Calendar chips only show scheduled items, while proposals surface through the proposals tab and optional personal highlights.
