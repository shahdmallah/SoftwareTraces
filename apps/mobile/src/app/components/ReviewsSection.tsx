import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ltrText, rtlText } from '../utils/direction';
import type { TrailReview } from '../api/trailsApi';

interface ReviewsSectionProps {
  reviews: TrailReview[];
  isArabic: boolean;
}

function formatRating(value: number | string | undefined | null) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : '0.0';
}

export function ReviewsSection({ reviews, isArabic }: ReviewsSectionProps) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Reviews</Text>
      {reviews.length ? (
        reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewUser}>Hiker</Text>
              <Text style={styles.reviewRating}>
                {formatRating(review.rating)} <Ionicons name="star" size={12} color="#D4A843" />
              </Text>
            </View>
            <Text style={[styles.reviewText, isArabic ? rtlText : ltrText]}>{review.content}</Text>
          </View>
        ))
      ) : (
        <Text style={[styles.reviewEmpty, isArabic ? rtlText : ltrText]}>
          {isArabic ? 'لا توجد مراجعات بعد لهذا المسار.' : 'No reviews for this trail yet.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2C2418',
    marginBottom: 12,
  },
  reviewCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F6F0E0',
    marginTop: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewUser: {
    color: '#2C2418',
    fontSize: 13,
    fontWeight: '800',
  },
  reviewRating: {
    color: '#8A7A6A',
    fontSize: 11,
    fontWeight: '800',
  },
  reviewText: {
    color: '#4A4131',
    fontSize: 14,
    lineHeight: 20,
  },
  reviewEmpty: {
    color: '#6B5D4E',
    fontSize: 13,
    lineHeight: 20,
  },
});