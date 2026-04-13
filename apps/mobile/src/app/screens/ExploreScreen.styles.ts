import { StyleSheet } from 'react-native';

import { commonShadows, theme } from '../theme';

export const exploreScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  heroBanner: {
    minHeight: theme.sizes.layout.heroMinHeight,
    borderRadius: theme.radii.hero,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAccent,
  },
  heroBannerImage: {
    borderRadius: theme.radii.hero,
  },
  heroBannerOverlay: {
    flex: 1,
    padding: theme.spacing.lgPlus,
    backgroundColor: theme.colors.overlayHero,
    justifyContent: 'space-between',
  },
  headerTopRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: theme.typography.letterSpacing.wide,
    textTransform: 'uppercase',
    color: theme.colors.textInverseMuted,
    marginBottom: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.heading,
    fontWeight: theme.typography.fontWeight.extraBold,
    color: theme.colors.textInverse,
  },
  headerSubtitle: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textInverseSoft,
    marginTop: theme.spacing.xxs,
    lineHeight: theme.typography.lineHeight.body,
  },
  searchBox: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.smd,
    ...commonShadows.soft,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.body,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.overlayGlass,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.smd,
  },
  filterToggleText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  filterTogglePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  filtersCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.mdPlus,
    borderRadius: theme.radii.xxxl,
    backgroundColor: theme.colors.surfaceMuted,
  },
  filterSection: {
    marginBottom: theme.spacing.md,
  },
  filterSectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.extraBold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.smd,
  },
  filterButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.smd,
    borderRadius: theme.radii.xxl,
    backgroundColor: theme.colors.surface,
    marginRight: theme.spacing.smd,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.buttonPrimary,
  },
  filterButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  filterLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
  },
  filterLabelActive: {
    color: theme.colors.textInverse,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  listWrapper: {
    flex: 1,
  },
});
