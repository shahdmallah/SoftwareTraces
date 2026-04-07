import type { Activity } from "./activity.types";
import type { Profile } from "./user.types";

export interface Follow {
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface Like {
  userId: string;
  activityId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  activityId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface FeedItem {
  activity: Activity;
  profile: Profile;
  likesCount: number;
  commentsCount: number;
  isLikedByViewer: boolean;
}
