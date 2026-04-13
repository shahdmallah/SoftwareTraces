import { StyleSheet } from 'react-native';

import { commonShadows, theme } from '../theme';

export const exploreTrailCardStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    ...commonShadows.medium,
  },
  cardImageWrapper: {
    height: theme.sizes.layout.cardImageHeight,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardBadge: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    paddingHorizontal: theme.spacing.smd,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radii.md,
  },
  cardBadgeText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  cardRating: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.overlayStrong,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radii.md,
  },
  cardRatingText: {
    color: theme.colors.textInverse,
    marginLeft: theme.spacing.xxs,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  cardNameOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.overlayCard,
  },
  cardName: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.fontSize.title,
    fontWeight: theme.typography.fontWeight.extraBold,
  },
  cardInfo: {
    paddingHorizontal: theme.spacing.mdPlus,
    paddingVertical: theme.spacing.md,
  },
  cardLocationRow: {
    alignItems: 'center',
    marginBottom: theme.spacing.smd,
  },
  cardLocationIcon: {
    marginRight: theme.spacing.xs,
  },
  cardLocationText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.fontSize.sm,
  },
  cardLocationDot: {
    color: theme.colors.borderMuted,
    marginHorizontal: theme.spacing.xs,
    fontSize: theme.typography.fontSize.sm,
  },
  cardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.smd,
  },
  cardStatItem: {
    alignItems: 'center',
  },
  cardStatValue: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  cardStatLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
  },
  cardChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardChip: {
    backgroundColor: theme.colors.chipBackground,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxxs,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  cardChipText: {
    color: theme.colors.chipText,
    fontSize: theme.typography.fontSize.sm,
  },
});
