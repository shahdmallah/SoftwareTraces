import type { FeedItem } from './activitySocial';

export type JournalEntry = {
  id: string;
  createdAt: string;
  type: 'journal' | 'plan';
  trail: string;
  note: string;
  date?: string;
  photoUris?: string[];
};

const localFeedItems: FeedItem[] = [];
const journalEntries: JournalEntry[] = [];

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function addLocalFeedItem(item: FeedItem) {
  localFeedItems.unshift(item);
}

export function getLocalFeedItems() {
  return [...localFeedItems];
}

export function clearLocalFeedItems() {
  localFeedItems.length = 0;
}

export function saveJournalEntry(entry: Omit<JournalEntry, 'id' | 'createdAt'>) {
  const nextEntry: JournalEntry = {
    id: makeId('journal'),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  journalEntries.unshift(nextEntry);
  return nextEntry;
}

export function getJournalEntries() {
  return [...journalEntries];
}
