# Traces Safety Postman Testing Guide

Use `traces-safety-full-flow.postman_collection.json` to test the Safety system end to end from normal user and admin perspectives.

## Setup

1. Import the collection into Postman.
2. Set `baseUrl`, usually `http://localhost:3000`.
3. Log in as a normal user and an admin.
4. Paste JWTs into collection variables:
   - `userToken`
   - `adminToken`

The collection includes optional `/api/auth/login` requests. Replace their example credentials with real users if you want Postman to save the tokens automatically.

## Recommended Run Order

Run folders in order from A to K.

- **A. Auth Setup / Instructions** proves the API is reachable and helps populate tokens.
- **B. User Safety - Incident Reporting** creates a pending community incident and verifies it appears publicly with trust metadata.
- **C. User Safety - Community Validation** tests `confirm`, `dispute`, and `note` feedback, plus invalid/unauthenticated feedback failures.
- **D. Admin Safety - Incident Moderation** tests admin-only moderation and verifies hidden/rejected incidents disappear from public nearby alerts.
- **D0. User Notifications** tests notification listing, unread filtering, push-token registration/removal, and mark-all-read. Authenticated nearby-alert reads may create `danger_alert` notifications.
- **E. Admin Safety - Dangerous Locations CRUD** tests dangerous location create/update/disable and validation failures.
- **F. Checkpoint Reports** uses the created dangerous location as a checkpoint and tests checkpoint report creation/listing.
- **G. SOS Flow** tests user SOS create/list/get/status and admin SOS listing.
- **H. OCHA** tests admin OCHA logs and manual backup fetch. OCHA also runs automatically from safety cron every `OCHA_FETCH_INTERVAL_HOURS`, default `6`.
- **I. Admin Dashboard Safety Stats** verifies safety dashboard metrics.
- **J. Public Visibility Rules** focuses on pending, verified, hidden, rejected, and disputed visibility behavior.
- **K. Cleanup** hides the test incident and disables the test dangerous location.

## Important Live API Notes

The collection is based on the actual route/controller code, not only the product spec.

- Admin incident moderation body is:

```json
{
  "moderation_status": "verified",
  "moderation_note": "Confirmed by admin after review."
}
```

The live endpoint accepts only `moderation_status` / `moderation_note` in the request body.

- Admin dangerous-location create/update does not currently accept a `source` field in the controller schema. The collection does not send `source`, and it does not include an invalid `source` negative test because that would not test a supported API contract.

- Checkpoint report creation is:

```http
POST /api/safety/checkpoints/:checkpointId/report
```

with body:

```json
{
  "status": "slow",
  "wait_minutes": 25,
  "notes": "Postman test checkpoint report."
}
```

Allowed checkpoint statuses are `open`, `closed`, and `slow`.

- SOS creation is:

```http
POST /api/sos
```

with `latitude`, `longitude`, `message`, and ISO `occurred_at`.

## Defense Talking Points

- User reports are visible immediately as public community reports.
- Admin verification adds trust but is not required for visibility.
- Community feedback updates confirmation/dispute counts and confidence score.
- Disputed reports remain visible with warning-style trust metadata.
- Hidden and rejected reports are excluded from public nearby alerts.
- Nearby safety checks can create user `danger_alert` notifications, and notification endpoints support unread counts plus push-token lifecycle.
- OCHA import is automated by cron, with admin manual fetch retained only as backup/testing.
- Dashboard stats now separate pending, community-confirmed, admin-verified, disputed, hidden, rejected, public incidents, checkpoint reports, SOS totals, dangerous locations, and last OCHA import.

## Cleanup

There is no hard-delete endpoint for safety incidents. Use admin moderation to set test incidents to `hidden`, or clean rows manually in the database if needed. Dangerous locations are soft-disabled through the admin delete endpoint.
