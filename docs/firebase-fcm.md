# Firebase Cloud Messaging Setup

## Required files

- `apps/api/firebase-service-account.json`
  - Firebase Admin service account JSON for the same Firebase project used by the mobile app.
  - This file is loaded by the API at runtime and is ignored by git.
- `apps/mobile/google-services.json`
  - Android Firebase app config used by Expo native Android builds.
  - The Android package name must match `com.traces.app` in `apps/mobile/app.json`.

Do not place Firebase credentials in source code or environment variables.

## Environment variables

No Firebase server credential environment variable is required. The API reads only:

- `apps/api/firebase-service-account.json`

The mobile app still needs its normal API URL when testing on a device:

- `EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000/api`

## Backend flow

1. `createNotification` inserts the notification row in Postgres.
2. After the row is fetched, push delivery starts as best effort.
3. FCM delivery loads active tokens from `push_tokens` where `provider = 'fcm'` and `is_active = true`.
4. Firebase Admin sends the notification title, body, and stringified data payload.
5. Invalid or unregistered FCM tokens are marked inactive.
6. Push failures are logged and returned as failed delivery results, but they do not roll back the notification row.

## Mobile flow

1. After an authenticated session exists, the app requests notification permission.
2. Android creates the default notification channel.
3. The app obtains the native device push token with `expo-notifications`.
4. The token is posted to `POST /api/notifications/push-token` with:

```json
{
  "token": "<device-token>",
  "provider": "fcm",
  "platform": "android",
  "device_id": "<stable-local-device-id>",
  "app_version": "1.0.0"
}
```

## SOS behavior

SOS creates the in-app message and notification first. The notification push payload includes:

- `sos_event_id`
- `conversation_id`
- `message_id`
- `latitude`
- `longitude`
- `occurred_at`

## Database

The existing `push_tokens` table is reused. It stores:

- `token`
- `provider`
- `platform`
- `device_id`
- `app_version`
- `last_seen_at`
- `is_active`

The safety migration adds `push_tokens_user_fcm_active_idx` for active FCM token lookup.

## Manual testing

1. Put the service account at `apps/api/firebase-service-account.json`.
2. Put the Android Firebase config at `apps/mobile/google-services.json`.
3. Run migrations:

```bash
npm run db:migrate
```

4. Start the API:

```bash
npm run dev:api
```

5. Build/run the Expo app on a physical Android device or development build with `EXPO_PUBLIC_API_URL` pointing to the API.
6. Log in and accept notification permissions.
7. Confirm the token exists:

```sql
SELECT user_id, provider, platform, is_active, app_version, last_seen_at
FROM push_tokens
WHERE provider = 'fcm'
ORDER BY last_seen_at DESC;
```

8. Trigger any notification-producing action, or create an SOS event with a registered emergency contact.
9. Confirm the notification row exists even if push delivery fails.
10. If Firebase returns an invalid or unregistered token error, confirm `is_active` becomes `false`.

## Limitations

- Expo's native token API returns an FCM token for Android. iOS FCM registration usually requires adding Firebase Messaging/APNs configuration to the native app; otherwise iOS native tokens should be delivered through APNs.
- Push delivery attempts are not currently persisted in a delivery log table.
- Expo Go is not a reliable target for native FCM token testing; use a physical device with a native development or production build.
