import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ltrText, rtlText } from '../utils/direction';
import { getDifficultyTone } from '../utils/trailUtils';
import type { Trail } from '../api/trailsApi';

interface TrailSummaryCardProps {
  trail: Trail;
  isArabic: boolean;
}

function formatNumericValue(value: number | string | undefined | null, digits = 1) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : `0.${'0'.repeat(Math.max(1, digits))}`;
}

function formatIntegerValue(value: number | string | undefined | null) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? String(Math.round(parsed)) : '0';
}

export function TrailSummaryCard({ trail, isArabic }: TrailSummaryCardProps) {
  const displayName = isArabic ? trail.nameAr : trail.name;
  const displayRegion = isArabic ? trail.regionAr : trail.region;
  const ratingText = formatNumericValue(trail.rating, 1);
  const reviewsText = formatIntegerValue(trail.reviews);
  const distanceText = formatNumericValue(trail.distance, 1);
  const durationText = trail.duration || 'N/A';
  const difficultyText = trail.difficulty || 'Easy';

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryCopy}>
        <Text numberOfLines={2} style={[styles.summaryTitle, isArabic ? rtlText : ltrText]}>
          {displayName}
        </Text>
        <View style={styles.summaryHighlightsRow}>
          <View style={styles.summaryMetaItem}>
            <Ionicons name="star" size={14} color="#1F211A" />
            <Text style={styles.summaryMetaText}>{ratingText}</Text>
          </View>
          <View style={styles.difficultyPill}>
            <View style={[styles.difficultyDot, { backgroundColor: getDifficultyTone(difficultyText as Trail['difficulty']) }]} />
            <Text style={styles.difficultyLabel}>{difficultyText}</Text>
          </View>
          <Text style={[styles.summaryRegion, isArabic ? rtlText : ltrText]} numberOfLines={1} ellipsizeMode="tail">
            {displayRegion}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statsItem}>
          <Text style={styles.statsValue}>{distanceText}</Text>
          <Text style={styles.statsLabel}>Length</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={styles.statsValue}>{trail.elevationGain}</Text>
          <Text style={styles.statsLabel}>Elev. gain</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={styles.statsValue}>{durationText}</Text>
          <Text style={styles.statsLabel}>Est. time</Text>
        </View>
        <View style={styles.statsItem}>
          <Ionicons name="arrow-forward-outline" size={18} color="#1F211A" />
          <Text style={styles.statsLabel}>Point to point</Text>
        </View>
      </View>

      <Text style={[styles.description, isArabic ? rtlText : ltrText]}>
        {isArabic ? trail.descriptionAr : trail.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 15,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    color: '#1F211A',
    letterSpacing: -0.8,
  },
  summaryRegion: {
    marginTop: 8,
    fontSize: 14,
    color: '#4A4131',
  },
  summaryHighlightsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryMetaText: {
    fontSize: 14,
    color: '#1F211A',
    fontWeight: '700',
  },
  difficultyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFF6DA',
  },
  difficultyLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7D5B23',
  },
  difficultyDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  statsRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  statsItem: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
    gap: 6,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1F211A',
  },
  statsLabel: {
    fontSize: 12,
    color: '#7D856D',
    fontWeight: '700',
    
  },
  description: {
    marginTop: 18,
    fontSize: 15,
    lineHeight: 23,
    color: '#4A4131',
  },
});