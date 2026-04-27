import { StyleSheet } from 'react-native';

import { commonShadows, theme } from '../theme';

export const exploreTrailCardStyles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.xl,
  },
  cardImageWrapper: {
    height: 274,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceMuted,
    position: 'relative',
    ...commonShadows.medium,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  favoriteButton: {
    position: 'absolute',
    top: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 5,
  },
  favoriteButtonPressed: {
    opacity: 0.7,
  },
  favoriteButtonActive: {
    backgroundColor: '#630E13',
  },
  favoriteButtonLtr: {
    right: theme.spacing.lg,
  },
  favoriteButtonRtl: {
    left: theme.spacing.lg,
  },
  mapPreviewCard: {
    position: 'absolute',
    bottom: 18,
    width: 94,
    height: 94,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: theme.colors.textInverse,
    backgroundColor: '#F7F1E4',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 6,
  },
  mapPreviewCardLtr: {
    right: theme.spacing.lg,
  },
  mapPreviewCardRtl: {
    left: theme.spacing.lg,
  },
  mapPreviewCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  paginationDots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
    zIndex: 2,
  },
  paginationDot: {
    width: 9,
    height: 9,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.56)',
  },
  paginationDotActive: {
    backgroundColor: theme.colors.textInverse,
  },
  cardInfo: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  cardCopy: {
    flex: 1,
  },
  cardName: {
    color: '#1F211A',
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  cardMapAction: {
  padding: 6,        
  marginLeft: 8,
  borderRadius: 0,   
  backgroundColor: 'transparent',
},
  cardActionIconPressed: {
    opacity: 0.7,
  },
  cardLocationText: {
    marginTop: 6,
    color: '#7A7265',
    fontSize: 16,
    lineHeight: 21,
  },
  cardMetaRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: theme.spacing.xs,
    columnGap: theme.spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaText: {
    color: '#70756B',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  metaDivider: {
    color: '#A49B8D',
    fontSize: 16,
    lineHeight: 16,
  },
  difficultyMarker: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
});
