import React from 'react';
import { Dimensions, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { completionRadii } from '../../features/trailCompletion/theme';
import { ltrRow, ltrText, rtlRow, rtlText } from '../../utils/direction';
import { getWeatherVisual } from '../../utils/weatherUtils';

const glassBorder = 'rgba(255,255,255,0.35)';
const { height: SCREEN_H } = Dimensions.get('window');
const HERO_MIN = Math.min(SCREEN_H * 0.48, 360);

type Props = {
  heroUri: string;
  fallbackUri?: string;
  trailName: string;
  region?: string;
  completedDateLabel: string;
  weatherLine?: string | null;
  isArabic: boolean;
  onBack: () => void;
};

export function CompletionHero({
  heroUri,
  fallbackUri,
  trailName,
  region,
  completedDateLabel,
  weatherLine,
  isArabic,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const uri = heroUri || fallbackUri || '';
  const weatherVisual = weatherLine ? getWeatherVisual(weatherLine, true) : null;

  const inner = (
    <>
      <LinearGradient colors={['rgba(12,8,5,0.15)', 'rgba(12,8,5,0.55)', 'rgba(12,8,5,0.88)']} style={StyleSheet.absoluteFill} />

      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 6, 12) }, isArabic ? rtlRow : ltrRow]}>
        <Pressable style={styles.backGlass} onPress={onBack}>
          <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFill} />
          <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={22} color="#2C2418" />
        </Pressable>
      </View>

      <View style={styles.bottom}>
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18, delay: 120 }}
          style={[styles.successPill, isArabic ? rtlRow : ltrRow]}
        >
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.successDot}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
          <Text style={[styles.successText, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'اكتمل المسار' : 'Trail completed'}
          </Text>
        </MotiView>

        <Text style={[styles.trailTitle, isArabic ? rtlText : ltrText]} numberOfLines={2}>
          {trailName}
        </Text>
        {region ? (
          <Text style={[styles.region, isArabic ? rtlText : ltrText]} numberOfLines={1}>
            {region}
          </Text>
        ) : null}

        <View style={[styles.metaRow, isArabic ? rtlRow : ltrRow]}>
          <View style={[styles.metaChip, isArabic ? rtlRow : ltrRow]}>
            <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.9)" />
            <Text style={styles.metaChipText} numberOfLines={1}>
              {completedDateLabel}
            </Text>
          </View>
          {weatherLine && weatherVisual ? (
            <View style={[styles.metaChip, isArabic ? rtlRow : ltrRow]}>
              <Text style={styles.weatherEmoji}>{weatherVisual.emoji}</Text>
              <Text style={styles.metaChipText} numberOfLines={1}>
                {weatherLine}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </>
  );

  return (
    <MotiView from={{ opacity: 0.85 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 520 }} style={styles.wrap}>
      {uri ? (
        <ImageBackground source={{ uri }} style={[styles.bg, { minHeight: HERO_MIN }]} resizeMode="cover">
          {inner}
        </ImageBackground>
      ) : (
        <View style={[styles.bg, styles.bgFallback, { minHeight: HERO_MIN }]}>{inner}</View>
      )}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomLeftRadius: completionRadii.card,
    borderBottomRightRadius: completionRadii.card,
    overflow: 'hidden',
  },
  bg: {
    width: '100%',
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: '#3D3428',
  },
  bgFallback: {
    backgroundColor: '#4A3F32',
  },
  topBar: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  bottom: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  successPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glassBorder,
    marginBottom: 14,
  },
  successDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1E7A46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  trailTitle: {
    color: '#FFFEF9',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  region: {
    marginTop: 6,
    color: 'rgba(255,254,249,0.75)',
    fontSize: 14,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    maxWidth: '100%',
  },
  metaChipText: {
    color: 'rgba(255,254,249,0.92)',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  weatherEmoji: {
    fontSize: 13,
  },
});
