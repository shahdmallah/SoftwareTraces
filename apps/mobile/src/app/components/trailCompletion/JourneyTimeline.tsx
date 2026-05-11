import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { completionRadii, completionShadow } from '../../features/trailCompletion/theme';
import { formatCompletionDuration } from '../../features/trailCompletion/formatters';
import { ltrRow, ltrText, rtlRow, rtlText } from '../../utils/direction';

type Milestone = { key: string; label: string; sub: string; done: boolean };

type Props = {
  routePointCount: number;
  durationMs: number;
  isArabic: boolean;
  delay?: number;
};

function buildMilestones(routePointCount: number, durationMs: number, isArabic: boolean): Milestone[] {
  const dur = formatCompletionDuration(durationMs, isArabic);
  const n = Math.max(1, routePointCount);
  const mid = Math.max(1, Math.floor(n / 2));

  return [
    {
      key: 'start',
      label: isArabic ? 'البداية' : 'Start',
      sub: isArabic ? 'انطلقت من المسار' : 'You began recording',
      done: true,
    },
    {
      key: 'mid',
      label: isArabic ? 'منتصف الرحلة' : 'Along the route',
      sub: isArabic ? `${mid} نقطة تتبع` : `${mid} GPS checkpoints`,
      done: n >= 3,
    },
    {
      key: 'end',
      label: isArabic ? 'النهاية' : 'Finish',
      sub: dur,
      done: true,
    },
  ];
}

export function JourneyTimeline({ routePointCount, durationMs, isArabic, delay = 220 }: Props) {
  const milestones = useMemo(() => buildMilestones(routePointCount, durationMs, isArabic), [routePointCount, durationMs, isArabic]);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 440, delay }}
      style={[styles.card, completionShadow.card]}
    >
      <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
        <Ionicons name="git-commit-outline" size={20} color="#630E13" />
        <View style={styles.headerText}>
          <Text style={[styles.title, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'مسار التقدم' : 'Journey progression'}
          </Text>
          <Text style={[styles.sub, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'من أول خطوة حتى خط النهاية' : 'From first step to the finish line'}
          </Text>
        </View>
      </View>

      <View style={styles.track}>
        {milestones.map((m, i) => (
          <View key={m.key} style={[styles.row, isArabic ? rtlRow : ltrRow]}>
            <View style={styles.colLeft}>
              <View style={[styles.dot, m.done ? styles.dotOn : styles.dotOff]}>
                {m.done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
              </View>
              {i < milestones.length - 1 ? <View style={styles.vline} /> : null}
            </View>
            <View style={styles.colRight}>
              <Text style={[styles.mTitle, isArabic ? rtlText : ltrText]}>{m.label}</Text>
              <Text style={[styles.mSub, isArabic ? rtlText : ltrText]}>{m.sub}</Text>
            </View>
          </View>
        ))}
      </View>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: completionRadii.card,
    backgroundColor: '#FFFCF8',
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,36,24,0.07)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2C2418',
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B5D4E',
    fontWeight: '600',
  },
  track: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 56,
  },
  colLeft: {
    width: 28,
    alignItems: 'center',
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dotOn: {
    backgroundColor: '#630E13',
  },
  dotOff: {
    backgroundColor: '#E7D8C3',
    borderWidth: 2,
    borderColor: '#D4C6A4',
  },
  vline: {
    width: 2,
    flex: 1,
    marginVertical: 2,
    backgroundColor: 'rgba(99,14,19,0.2)',
    borderRadius: 1,
  },
  colRight: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  mTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2C2418',
  },
  mSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B5D4E',
    fontWeight: '600',
    lineHeight: 17,
  },
});
