# Safety API Request Examples

These examples cover the implemented safety flows without requiring external push credentials.

## SOS Creation

If an active emergency contact has `notify_on_sos: true` and resolves to a registered app user,
`POST /api/sos` also creates a direct conversation message for that contact.

```http
POST /api/sos
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "latitude": 31.9038,
  "longitude": 35.2044,
  "message": "Need assistance near the trailhead",
  "occurred_at": "2026-06-05T10:00:00.000Z"
}
```

The saved message content is:

```text
Emergency SOS triggered. I may need help. Last known location: 31.9038, 35.2044. Time: 2026-06-05T10:00:00.000Z.
```

The message metadata is:

```json
{
  "type": "sos",
  "sos_event_id": "<sos-id>",
  "latitude": 31.9038,
  "longitude": 35.2044,
  "occurred_at": "2026-06-05T10:00:00.000Z"
}
```

## Emergency Contacts

```http
POST /api/sos/contacts
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "name": "Emergency Contact",
  "contact_user_id": "<registered-contact-user-id>",
  "phone": "+970599000000",
  "email": "contact@example.com",
  "relationship": "family",
  "priority": 1,
  "notify_by_sms": true,
  "notify_by_email": true,
  "notify_by_push": true,
  "notify_on_sos": true
}
```

`contact_user_id` is preferred for in-app SOS delivery. If it is omitted, the backend can resolve
a registered contact by exact email match. Contacts that do not map to a registered user are not
messaged through the in-app messaging system.

```http
GET /api/sos/contacts
Authorization: Bearer <access-token>
```

```http
PATCH /api/sos/contacts/<contact-id>
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "priority": 2,
  "is_active": true
}
```

## SOS Status

```http
GET /api/sos/my
Authorization: Bearer <access-token>
```

```http
PATCH /api/sos/<sos-id>/status
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "status": "acknowledged",
  "note": "User confirmed they are receiving help"
}
```

## Checkpoint Report

```http
POST /api/safety/checkpoints/<checkpoint-id>/report
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "status": "slow",
  "wait_minutes": 25,
  "expires_in_minutes": 180,
  "notes": "Long wait, but cars are moving"
}
```

## Nearby Alerts

```http
GET /api/safety/nearby-alerts?lat=31.9038&lng=35.2044&radius=5000&user_id=<user-id>&trail_id=<trail-id>
```

If `user_id` is supplied, the backend creates `danger_alert` notifications with cooldown-based duplicate prevention.

## Route Safety Score

```http
GET /api/safety/trails/<trail-id>/safety
```

## Incident Moderation

```http
PATCH /api/safety/incidents/<incident-id>/moderation
Authorization: Bearer <admin-access-token>
Content-Type: application/json

{
  "status": "active",
  "note": "Verified from trusted local source"
}
```

Admin access is granted by `SAFETY_ADMIN_USER_IDS` / `ADMIN_USER_IDS` or admin-like fields on the user's profile.
