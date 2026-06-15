import { StyleSheet } from 'react-native';

export const exploreScreenStyles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },

  headerContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  listContent: {
    paddingBottom: 120,
  },

  cardBlock: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  // ── Search ───────────────────────────────────────────────
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },

  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    backgroundColor: '#F1EFE9',
    borderRadius: 28,
    paddingHorizontal: 16,
    gap: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2418',
  },

  searchInputLtr: {
    marginLeft: 2,
    textAlign: 'left',
  },

  searchInputRtl: {
    marginRight: 2,
    textAlign: 'right',
  },

  // ── Header action button (filter toggle) ─────────────────
  headerActionButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F1EFE9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerActionButtonActive: {
    backgroundColor: '#E7F5EA',
  },

  headerActionPressed: {
    opacity: 0.7,
  },

  // Dot indicator for active filters
  headerActionIndicator: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#630E13',
    top: 10,
  },

  headerActionIndicatorLtr: {
    right: 10,
  },

  headerActionIndicatorRtl: {
    left: 10,
  },

  // ── Quick-filter chips (feature row) ─────────────────────
  quickFiltersBlock: {
    marginBottom: 16,
  },

  quickFiltersContent: {
    gap: 10,
    paddingRight: 4,
  },

  filtersContentRtl: {
    flexDirection: 'row-reverse',
  },

  quickFilterChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F1EFE9',
  },

  quickFilterChipActive: {
    backgroundColor: '#E7F5EA',
  },

  quickFilterChipPressed: {
    opacity: 0.7,
  },

  quickFilterInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  quickFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2418',
  },

  quickFilterLabelActive: {
    color: '#2A6B35',
  },

  // ── Advanced filters card ─────────────────────────────────
  filtersCard: {
    marginBottom: 16,
    backgroundColor: '#F1EFE9',
    borderRadius: 20,
    padding: 14,
    gap: 4,
  },

  filterSection: {
    marginBottom: 12,
  },

  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A7A6A',
    marginBottom: 8,
  },

  compactFiltersContent: {
    gap: 8,
    paddingRight: 4,
  },

  compactFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#E3DFD7',
  },

  compactFilterChipActive: {
    backgroundColor: '#630E13',
  },

  compactFilterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C2418',
  },

  compactFilterLabelActive: {
    color: '#fff',
  },

  // ── Results row ───────────────────────────────────────────
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  resultsTextBlock: {
    flex: 1,
    gap: 1,
  },

  resultsCount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2C2418',
  },

  resultsCaption: {
    fontSize: 13,
    color: '#8A7A6A',
  },

  // ── Sort button & menu ────────────────────────────────────
  sortButton: {
    backgroundColor: '#F1EFE9',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  sortButtonActive: {
    backgroundColor: '#E7F5EA',
  },

  sortButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C2418',
  },

  sortMenu: {
    marginBottom: 12,
  },

  // ── Status / error banner ─────────────────────────────────
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FDF3F3',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
  },

  statusBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#630E13',
    fontWeight: '500',
  },

  statusBannerButton: {
    backgroundColor: '#630E13',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  statusBannerButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // ── Empty / loading state ─────────────────────────────────
  emptyStateCard: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#F1EFE9',
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2418',
  },

  emptyStateText: {
    marginTop: 6,
    fontSize: 14,
    color: '#8A7A6A',
  },

  emptyStateButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#630E13',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },

  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
