export type TrailBuddyTrail = {
  name: string;
  distance?: number | null;
  elevationGain?: number | null;
  elevationMin?: number | null;
  elevationMax?: number | null;
  features?: string[];
  tags?: string[];
  checkpointNote?: string | null;
  routeCoordinates?: [number, number][];
};

export type TrailBuddyMessage = {
  title: string;
  body: string;
  tone: 'default' | 'navigation' | 'warning' | 'celebration';
};

const GENERAL_FACTS = [
  'Fun fact: steady hiking can use 30% more energy on climbs than on flat ground, so that nice climb is real work.',
  'Fun fact: trail dust often carries tiny mineral clues from the hills around you, like a pocket-sized geology map.',
  'Fun fact: many birds use ridge winds like invisible escalators, saving energy while they patrol the valley.',
  'Fun fact: switchbacks protect the slope by shedding water slowly instead of letting it carve straight downhill.',
];

const FEATURE_FACTS: Array<{ pattern: RegExp; fact: string }> = [
  {
    pattern: /olive|grove/i,
    fact: 'Fun fact: olive trees can regrow from old root crowns, which is why some groves feel like living history.',
  },
  {
    pattern: /terrace|unesco/i,
    fact: 'Fun fact: stone terraces slow rainwater just enough for soil to stay put on steep hillsides.',
  },
  {
    pattern: /canyon|wadi/i,
    fact: 'Fun fact: canyon shade can create tiny cool-weather pockets where plants survive long after rain disappears.',
  },
  {
    pattern: /spring|water|sea/i,
    fact: 'Fun fact: springs often appear where water hits a less porous rock layer and has to surface.',
  },
  {
    pattern: /salt|dead sea/i,
    fact: 'Fun fact: salt flats grow crystal patterns as briny water evaporates, almost like the shore is sketching itself.',
  },
  {
    pattern: /cave|limestone/i,
    fact: 'Fun fact: limestone caves form as slightly acidic rainwater slowly dissolves rock along hidden cracks.',
  },
  {
    pattern: /summit|ridge|panoramic/i,
    fact: 'Fun fact: ridgelines often feel windier because moving air gets squeezed upward by the slope.',
  },
];

function getDistanceMeters(from: [number, number], to: [number, number]) {
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(to[1] - from[1]);
  const lngDelta = toRadians(to[0] - from[0]);
  const lat1 = toRadians(from[1]);
  const lat2 = toRadians(to[1]);

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBearingDegrees(from: [number, number], to: [number, number]) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const toDegrees = (value: number) => (value * 180) / Math.PI;
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;
  const fromLatRad = toRadians(fromLat);
  const toLatRad = toRadians(toLat);
  const deltaLng = toRadians(toLng - fromLng);
  const y = Math.sin(deltaLng) * Math.cos(toLatRad);
  const x =
    Math.cos(fromLatRad) * Math.sin(toLatRad) -
    Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(deltaLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function toCompassDirection(degrees: number) {
  const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  return directions[Math.round(degrees / 45) % 8];
}

function getProgressPercent(
  progressPercent: number | null | undefined,
  recordedPointCount: number,
  routePointCount: number,
) {
  if (typeof progressPercent === 'number' && Number.isFinite(progressPercent)) {
    return Math.max(0, Math.min(100, progressPercent));
  }

  if (routePointCount > 1 && recordedPointCount > 0) {
    return Math.max(0, Math.min(96, (recordedPointCount / routePointCount) * 100));
  }

  return 0;
}

function getWaypointName(trail: TrailBuddyTrail | null | undefined, progressPercent: number, offRoute: boolean) {
  if (offRoute) {
    return `${trail?.name ?? 'trail'} route line`;
  }

  if (progressPercent >= 88) {
    return trail?.features?.some((feature) => /summit/i.test(feature)) ? 'summit waypoint' : 'finish waypoint';
  }

  if (progressPercent >= 45 && progressPercent <= 55) {
    return 'halfway waypoint';
  }

  if (progressPercent <= 8) {
    return 'trailhead waypoint';
  }

  return `${trail?.name ?? 'trail'} waypoint`;
}

function getRouteCue({
  trail,
  currentLocation,
  routeCoordinates,
  nearestDistance,
  progressPercent,
  navigationOffTrack,
  navigationDeviationMeters,
}: {
  trail: TrailBuddyTrail | null | undefined;
  currentLocation?: [number, number] | null;
  routeCoordinates: [number, number][];
  nearestDistance?: number | null;
  progressPercent: number;
  navigationOffTrack?: boolean | null;
  navigationDeviationMeters?: number | null;
}) {
  if (!currentLocation || routeCoordinates.length < 2) {
    return null;
  }

  let nearestIndex = 0;
  let nearestPointDistance = Number.POSITIVE_INFINITY;

  routeCoordinates.forEach((point, index) => {
    const distance = getDistanceMeters(currentLocation, point);
    if (distance < nearestPointDistance) {
      nearestPointDistance = distance;
      nearestIndex = index;
    }
  });

  const offRoute = navigationOffTrack === true || (nearestDistance != null && nearestDistance > 50);
  const targetIndex = offRoute ? nearestIndex : Math.min(nearestIndex + 4, routeCoordinates.length - 1);
  const targetPoint = routeCoordinates[targetIndex];
  const targetDistance = Math.max(20, Math.round(getDistanceMeters(currentLocation, targetPoint)));
  const heading = toCompassDirection(getBearingDegrees(currentLocation, targetPoint));
  const waypoint = getWaypointName(trail, progressPercent, offRoute);

  if (offRoute) {
    const deviation = Math.round(navigationDeviationMeters ?? nearestDistance ?? nearestPointDistance);
    return `Heads up, you look to be about ${deviation} meters off the main trail. Head ${heading} for about ${targetDistance} meters toward ${waypoint}.`;
  }

  if (targetDistance <= 200) {
    return `Easy turn coming up in about ${targetDistance} meters. Keep heading ${heading} toward ${waypoint}.`;
  }

  return `Smooth stretch ahead. Continue ${heading} toward ${waypoint}.`;
}

function getFeatureFact(trail: TrailBuddyTrail | null | undefined, seed: number) {
  const labels = [...(trail?.features ?? []), ...(trail?.tags ?? []), trail?.name ?? ''].filter(Boolean);
  const labelText = labels.join(' ');
  const matched = FEATURE_FACTS.filter((item) => item.pattern.test(labelText));

  if (matched.length) {
    return matched[Math.abs(seed) % matched.length].fact;
  }

  return GENERAL_FACTS[Math.abs(seed) % GENERAL_FACTS.length];
}

function getTriggeredFact({
  trail,
  progressPercent,
  elapsedMs,
  factRequestCount,
}: {
  trail: TrailBuddyTrail | null | undefined;
  progressPercent: number;
  elapsedMs: number;
  factRequestCount: number;
}) {
  if (factRequestCount > 0) {
    return getFeatureFact(trail, factRequestCount - 1);
  }

  const estimatedGain = Math.max(0, ((trail?.elevationGain ?? 0) * progressPercent) / 100);
  const gainMilestone = Math.floor(estimatedGain / 100) * 100;

  if (gainMilestone >= 100) {
    return `Nice climb: you have gained roughly ${gainMilestone} meters. ${getFeatureFact(trail, gainMilestone / 100)}`;
  }

  if (progressPercent >= 49 && progressPercent <= 55) {
    return `You have hit the halfway mark, great pace. ${getFeatureFact(trail, 6)}`;
  }

  if (progressPercent >= 88) {
    return `You are close to the high point now. ${getFeatureFact(trail, 7)}`;
  }

  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  if ([30, 60, 120].includes(elapsedMinutes)) {
    return `You have been moving for ${elapsedMinutes === 60 ? '1 hour' : `${elapsedMinutes} minutes`}. ${getFeatureFact(trail, elapsedMinutes)}`;
  }

  return getFeatureFact(trail, 0);
}

export function buildTrailBuddyMessage({
  trail,
  currentLocation,
  routeCoordinates,
  nearestDistance,
  elapsedMs,
  recordedPointCount,
  progressPercent,
  navigationOffTrack,
  navigationDeviationMeters,
  factRequestCount,
}: {
  trail: TrailBuddyTrail | null | undefined;
  currentLocation?: [number, number] | null;
  routeCoordinates?: [number, number][];
  nearestDistance?: number | null;
  elapsedMs: number;
  recordedPointCount: number;
  progressPercent?: number | null;
  navigationOffTrack?: boolean | null;
  navigationDeviationMeters?: number | null;
  factRequestCount: number;
}): TrailBuddyMessage {
  if (!trail) {
    return {
      title: 'Trail Buddy is getting your route ready',
      body: 'Once the trail loads, I will share calm directions, tiny trail facts, and a nudge when the path bends.',
      tone: 'default',
    };
  }

  const route = routeCoordinates?.length ? routeCoordinates : trail.routeCoordinates ?? [];
  const progress = getProgressPercent(progressPercent, recordedPointCount, route.length);
  const navigationCue = getRouteCue({
    trail,
    currentLocation,
    routeCoordinates: route,
    nearestDistance,
    progressPercent: progress,
    navigationOffTrack,
    navigationDeviationMeters,
  });
  const fact = getTriggeredFact({ trail, progressPercent: progress, elapsedMs, factRequestCount });
  const offRoute = navigationOffTrack === true || (nearestDistance != null && nearestDistance > 50);
  const isMilestone = progress >= 49 || factRequestCount > 0;

  if (navigationCue) {
    return {
      title: offRoute ? 'Trail Buddy: route check' : 'Trail Buddy: trail cue',
      body: `${navigationCue} ${fact}`,
      tone: offRoute ? 'warning' : 'navigation',
    };
  }

  return {
    title: isMilestone ? 'Trail Buddy: nice moment' : 'Trail Buddy: field note',
    body: fact,
    tone: isMilestone ? 'celebration' : 'default',
  };
}

export function buildTrailBuddyReviewMessage({
  trail,
  elapsedMs,
  stepCount,
  photoCount,
}: {
  trail: TrailBuddyTrail | null | undefined;
  elapsedMs: number;
  stepCount: number;
  photoCount: number;
}): TrailBuddyMessage {
  const minutes = Math.max(1, Math.round(elapsedMs / 60000));
  const fact = getFeatureFact(trail, minutes + photoCount);

  return {
    title: 'Trail Buddy: hike wrapped',
    body: `Nice finish on ${trail?.name ?? 'this trail'}. You logged ${minutes} minutes, ${stepCount} steps, and ${photoCount} photo${photoCount === 1 ? '' : 's'}. ${fact}`,
    tone: 'celebration',
  };
}
