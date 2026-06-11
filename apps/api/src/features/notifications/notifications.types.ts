export type NotificationType =
  | "follow"
  | "review_like"
  | "review_comment"
  | "activity_like"
  | "activity_comment"
  | "meetup_invite"
  | "meetup_join"
  | "meetup_update"
  | "danger_alert"
  | "sos_alert"
  | "emergency_contact_alert"
  | "challenge_created"
  | "challenge_invite"
  | "challenge_completed"
  | "badge_earned"
  | "system";

export interface NotificationActor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface NotificationEntity {
  type: string | null;
  id: string | null;
  data: Record<string, unknown> | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  actor: NotificationActor | null;
  entity: NotificationEntity;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  actor_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  data?: Record<string, unknown> | null;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: "ios" | "android" | "web";
  provider?: "expo" | "fcm" | "apns" | "webpush";
  device_id: string | null;
  app_version?: string | null;
  last_seen_at?: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string | null;
}