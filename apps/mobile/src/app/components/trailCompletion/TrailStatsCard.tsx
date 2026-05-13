import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { AnimatedEntrance } from '../AnimatedUI';
import { completionRadii, completionShadow, glass } from '../../features/trailCompletion/theme';
import { ltrText, rtlText } from '../../utils/direction';

type Stat = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string };

type Props = {
  stats: Stat[];
  achievementHints?: string[];
  isArabic: boolean;
  isOwner?: boolean;
  ownerName?: string;
  delay?: number;
};

export function TrailStatsCard({ stats, achievementHints, isArabic, isOwner = true, ownerName, delay = 160 }: Props) {
  const displayName = ownerName?.trim() || 'Trail friend';
  const title = isOwner
    ? (isArabic ? 'ملخص رحلتك' : 'Your hike at a glance')
    : (isArabic ? `ملخص رحلة ${displayName}` : `${displayName}'s hike at a glance`);
  const subtitle = isOwner
    ? (isArabic ? 'أرقام من هذه الجولة' : 'Real stats from this outing')
    : (isArabic ? 'أرقام من الجولة المنشورة' : 'Stats from their published outing');

  return (
    <AnimatedEntrance
      fromY={20}
      duration={480}
      delay={delay}
      style={[styles.card, completionShadow.card]}
    >
      <View style={styles.glassHeader}>
        <BlurView intensity={28} tint="default" style={StyleSheet.absoluteFill} />
        <Text style={[styles.cardTitle, isArabic ? rtlText : ltrText]}>
          {title}
        </Text>
        <Text style={[styles.cardSubtitle, isArabic ? rtlText : ltrText]}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.grid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCell}>
            <View style={styles.statIcon}>
              <Ionicons name={s.icon} size={18} color="#630E13" />
            </View>
            <Text style={styles.statValue} numberOfLines={1}>
              {s.value}
            </Text>
            <Text style={[styles.statLabel, isArabic ? rtlText : ltrText]} numberOfLines={2}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      {achievementHints && achievementHints.length > 0 ? (
        <View style={styles.badgeRow}>
          {achievementHints.slice(0, 3).map((hint) => (
            <View key={hint} style={styles.badgeChip}>
              <Ionicons name="ribbon-outline" size={14} color="#7A9A3A" />
              <Text style={[styles.badgeText, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                {hint}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </AnimatedEntrance>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: -18,
    borderRadius: completionRadii.card,
    backgroundColor: glass.light,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.lightBorder,
    overflow: 'hidden',
  },
  glassHeader: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(44,36,24,0.06)',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2C2418',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B5D4E',
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 10,
  },
  statCell: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: completionRadii.pill,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,36,24,0.06)',
  },
  statIcon: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2C2418',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#6B5D4E',
    fontWeight: '700',
    lineHeight: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(122,154,58,0.12)',
    maxWidth: '100%',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3D4F24',
    flexShrink: 1,
  },
});
