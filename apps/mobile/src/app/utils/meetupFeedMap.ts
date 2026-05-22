import type { Meetup } from '../api/meetupsApi';
import type { FeedItem } from '../data/activitySocial';

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';

function handleFromHost(host: Meetup['host']) {
  if (host.username?.trim()) {
    return host.username.startsWith('@') ? host.username : `@${host.username}`;
  }

  return `@${host.full_name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'traces'}`;
}

function formatMeetupDate(value: string, locale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function mapMeetupToFeedItem(meetup: Meetup): Extract<FeedItem, { kind: 'plan' }> {
  const title = meetup.title || 'Meetup';
  const titleAr = meetup.title_ar || title;
  const note = meetup.note || meetup.vibe || meetup.meeting_place || '';
  const noteAr = meetup.note_ar || note;
  const dateEn = formatMeetupDate(meetup.starts_at, 'en-US');
  const dateAr = formatMeetupDate(meetup.starts_at, 'ar-SA');

  return {
    id: `meetup-${meetup.id}`,
    kind: 'plan',
    meetupId: meetup.id,
    trailId: meetup.trail_id ?? '',
    userId: meetup.host.id,
    viewerStatus: meetup.viewer_status,
    user: meetup.host.full_name || 'Trail host',
    handle: handleFromHost(meetup.host),
    avatar: meetup.host.avatar_url || '',
    cover: meetup.cover_url || FALLBACK_COVER,
    destinationEn: title,
    destinationAr: titleAr,
    dateEn,
    dateAr,
    vibeEn: meetup.vibe || '',
    vibeAr: meetup.vibe_ar || meetup.vibe || '',
    noteEn: note,
    noteAr: noteAr,
    peopleJoined: meetup.people_joined,
    spotsLeft: meetup.spots_left,
    visibility: meetup.visibility,
    invitedNames: [],
  };
}
