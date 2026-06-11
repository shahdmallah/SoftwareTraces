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

function getDistanceMeters(from: [number, number], to: [number, number]) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatNumericValue(value: number | string | undefined | null, digits = 1) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : `0.${'0'.repeat(Math.max(1, digits))}`;
}

function formatIntegerValue(value: number | string | undefined | null) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? String(Math.round(parsed)) : '0';
}

function buildTrailLabels(trail: Trail, isArabic: boolean) {
  const featureLabels = isArabic ? trail.featuresAr : trail.features;
  const labels = (featureLabels?.length ? featureLabels : trail.tags).filter(Boolean).slice(0, 4);

  if (trail.hasCheckpoint) {
    labels.unshift(isArabic ? 'نقطة عبور' : 'Access check');
  }

  return labels.slice(0, 5);
}

function isLoopTrail(trail: Trail) {
  const labels = [...(trail.features ?? []), ...(trail.featuresAr ?? []), ...(trail.tags ?? [])]
    .filter((label): label is string => typeof label === 'string')
    .map((label) => label.trim().toLowerCase());

  if (labels.includes('loop_trail') || labels.includes('loop trail') || labels.includes('loop')) {
    return true;
  }

  if (!Array.isArray(trail.routeCoordinates) || trail.routeCoordinates.length < 2) {
    return false;
  }

  const start = trail.routeCoordinates[0];
  const end = trail.routeCoordinates[trail.routeCoordinates.length - 1];
  return getDistanceMeters(start, end) <= 75;
}

export function TrailSummaryCard({ trail, isArabic }: TrailSummaryCardProps) {
  const displayName = isArabic ? trail.nameAr : trail.name;
  const displayRegion = isArabic ? trail.regionAr : trail.region;
  const ratingText = formatNumericValue(trail.rating, 1);
  const reviewsText = formatIntegerValue(trail.reviews);
  const distanceText = formatNumericValue(trail.distance, 1);
  const durationText = trail.duration || 'N/A';
  const difficultyText = trail.difficulty || 'Easy';
  const trailLabels = buildTrailLabels(trail, isArabic);
  const loopTrail = isLoopTrail(trail);
  const routeTypeLabel = isArabic ? 'حلقة' : 'Loop';
  const pointToPointLabel = isArabic ? 'من نقطة لنقطة' : 'Point to point';

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

      {trailLabels.length ? (
        <View style={styles.labelRow}>
          {trailLabels.map((label) => (
            <View key={label} style={[styles.trailLabel, label === (isArabic ? 'نقطة عبور' : 'Access check') && styles.accessLabel]}>
              <Text style={[styles.trailLabelText, label === (isArabic ? 'نقطة عبور' : 'Access check') && styles.accessLabelText]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

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
          <Ionicons name={loopTrail ? 'sync-outline' : 'arrow-forward-outline'} size={18} color="#1F211A" />
          <Text style={styles.statsLabel}>{loopTrail ? routeTypeLabel : pointToPointLabel}</Text>
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
  labelRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trailLabel: {
    maxWidth: '48%',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: '#F1E7D2',
  },
  accessLabel: {
    backgroundColor: '#F7EBE8',
  },
  trailLabelText: {
    color: '#5F594E',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  accessLabelText: {
    color: '#630E13',
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
