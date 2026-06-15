import { useSyncExternalStore } from 'react';

export type OwnedTrailStatus = 'published' | 'draft';

type OwnedTrailRecord = {
  trailId: string;
  status: OwnedTrailStatus;
  trackedAt: string;
};

const ownedTrails = new Map<string, OwnedTrailRecord>();
const listeners = new Set<() => void>();
let snapshot: OwnedTrailRecord[] = [];

function emitChange() {
  snapshot = Array.from(ownedTrails.values()).sort(
    (a, b) => new Date(b.trackedAt).getTime() - new Date(a.trackedAt).getTime(),
  );
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

export function useOwnedTrails(status?: OwnedTrailStatus) {
  const records = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return status ? records.filter((record) => record.status === status) : records;
}

export function trackOwnedTrail(trailId: string, status: OwnedTrailStatus) {
  const id = trailId.trim();
  if (!id) return;

  ownedTrails.set(id, {
    trailId: id,
    status,
    trackedAt: ownedTrails.get(id)?.trackedAt ?? new Date().toISOString(),
  });
  emitChange();
}

export function untrackOwnedTrail(trailId: string) {
  ownedTrails.delete(trailId);
  emitChange();
}
