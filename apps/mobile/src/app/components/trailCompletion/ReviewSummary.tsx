import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { completionRadii, completionShadow } from '../../features/trailCompletion/theme';
import { ltrText, rtlText } from '../../utils/direction';

type Props = {
  rating: number;
  reviewText: string;
  isArabic: boolean;
  delay?: number;
};

export function ReviewSummary({ rating, reviewText, isArabic, delay = 260 }: Props) {
  const body =
    reviewText.trim() ||
    (isArabic ? 'أكملت هذا المسار وتركت انطباعاً سريعاً بعد الرحلة.' : 'You wrapped this trail and left a quick note from the hike.');

  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 440, delay }}
      style={[styles.card, completionShadow.card]}
    >
      <Text style={[styles.sectionEyebrow, isArabic ? rtlText : ltrText]}>
        {isArabic ? 'انطباعك' : 'Your words'}
      </Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((v) => (
          <Ionicons key={v} name={v <= rating ? 'star' : 'star-outline'} size={22} color="#D4A843" />
        ))}
        <Text style={[styles.ratingCaption, isArabic ? rtlText : ltrText]}>
          {rating}/5 · {isArabic ? 'تقييمك' : 'Your rating'}
        </Text>
      </View>
      <Text style={[styles.quote, isArabic ? rtlText : ltrText]}>{body}</Text>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: completionRadii.card,
    backgroundColor: '#F6F0E0',
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(99,14,19,0.08)',
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#630E13',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  ratingCaption: {
    marginStart: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#4A4131',
  },
  quote: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 24,
    color: '#2C2418',
    fontWeight: '600',
  },
});
