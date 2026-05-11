import React, { useMemo } from 'react';
import { Dimensions, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { completionRadii, completionShadow } from '../../features/trailCompletion/theme';
import { formatCompletionDuration } from '../../features/trailCompletion/formatters';
import { ltrText, rtlText } from '../../utils/direction';

const W = Dimensions.get('window').width - 32;

type Props = {
  trailName: string;
  heroUri: string;
  rating: number;
  reviewExcerpt: string;
  durationMs: number;
  isArabic: boolean;
  delay?: number;
};

export function SharePreviewCard({ trailName, heroUri, rating, reviewExcerpt, durationMs, isArabic, delay = 340 }: Props) {
  const excerpt = useMemo(() => {
    const t = reviewExcerpt.trim();
    if (!t) return isArabic ? 'رحلة مكتملة على Traces' : 'A finished hike on Traces';
    return t.length > 120 ? `${t.slice(0, 120)}…` : t;
  }, [reviewExcerpt, isArabic]);
  const dur = formatCompletionDuration(durationMs, isArabic);

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 16, delay }}
      style={[styles.wrap, completionShadow.lifted]}
    >
      <Text style={[styles.eyebrow, isArabic ? rtlText : ltrText]}>
        {isArabic ? 'معاينة المشاركة' : 'Share preview'}
      </Text>
      <Text style={[styles.eyebrowSub, isArabic ? rtlText : ltrText]}>
        {isArabic ? 'كما قد تظهر على بطاقة اجتماعية أنيقة' : 'How your recap could appear as a social card'}
      </Text>

      <View style={styles.card}>
        {heroUri ? (
          <ImageBackground source={{ uri: heroUri }} style={styles.image} resizeMode="cover">
            <LinearGradient colors={['transparent', 'rgba(8,5,4,0.2)', 'rgba(8,5,4,0.92)']} style={StyleSheet.absoluteFill} />
            <View style={styles.cardInner}>
              <Text style={styles.tracesWordmark}>Traces</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {trailName}
              </Text>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>
                  {rating}★ · {dur}
                </Text>
              </View>
              <Text style={styles.excerpt} numberOfLines={3}>
                {excerpt}
              </Text>
            </View>
          </ImageBackground>
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <LinearGradient colors={['#5C4F42', '#2C2418']} style={StyleSheet.absoluteFill} />
            <View style={styles.cardInner}>
              <Text style={styles.tracesWordmark}>Traces</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {trailName}
              </Text>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>
                  {rating}★ · {dur}
                </Text>
              </View>
              <Text style={styles.excerpt} numberOfLines={3}>
                {excerpt}
              </Text>
            </View>
          </View>
        )}
      </View>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#630E13',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  eyebrowSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B5D4E',
    fontWeight: '600',
    marginBottom: 12,
  },
  card: {
    width: W,
    height: W * 1.05,
    borderRadius: completionRadii.card,
    overflow: 'hidden',
    backgroundColor: '#3A3228',
  },
  image: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  imageFallback: {
    backgroundColor: '#3A3228',
  },
  cardInner: {
    padding: 20,
  },
  tracesWordmark: {
    color: 'rgba(255,254,249,0.55)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  cardTitle: {
    color: '#FFFEF9',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  cardMeta: {
    marginTop: 10,
  },
  metaText: {
    color: 'rgba(255,254,249,0.85)',
    fontSize: 13,
    fontWeight: '700',
  },
  excerpt: {
    marginTop: 12,
    color: 'rgba(255,254,249,0.9)',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
});
