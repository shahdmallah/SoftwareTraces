import { useSyncExternalStore } from 'react';

const savedTrailIds = new Set<string>(['1', '3', '5', '6']);
const listeners = new Set<() => void>();
let snapshot = Array.from(savedTrailIds);

function emitChange() {
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

export function useSavedTrailIds() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useTrailSaved(trailId: string) {
  const savedIds = useSavedTrailIds();
  return savedIds.includes(trailId);
}

export function toggleTrailSaved(trailId: string) {
  if (savedTrailIds.has(trailId)) {
    savedTrailIds.delete(trailId);
  } else {
    savedTrailIds.add(trailId);
  }

  snapshot = Array.from(savedTrailIds);
  emitChange();
}
