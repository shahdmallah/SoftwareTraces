import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { getTrailReviews, type TrailReview } from '../api/trailsApi';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { ReviewPhotoStrip } from '../components/ReviewPhotoStrip';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type AllReviewsRouteProp = RouteProp<RootStackParamList, 'AllReviews'>;
type AllReviewsNavigationProp = StackNavigationProp<RootStackParamList, 'AllReviews'>;

function formatRating(value: number | string | undefined | null) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : '0.0';
}

export function AllReviewsScreen() {
  const route = useRoute<AllReviewsRouteProp>();
  const navigation = useNavigation<AllReviewsNavigationProp>();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const { trailId, trailName } = route.params;
  const [reviews, setReviews] = useState<TrailReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadReviews = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const nextReviews = await getTrailReviews(trailId);
        if (!cancelled) {
          setReviews(nextReviews);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : isArabic ? 'تعذر تحميل المراجعات.' : 'Unable to load reviews.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadReviews();

    return () => {
      cancelled = true;
    };
  }, [isArabic, trailId]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return '0.0';
    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AnimatedBlock delay={40}>
          <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name={isArabic ? 'arrow-forward' : 'arrow-back'} size={18} color="#2C2418" />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{isArabic ? 'كل المراجعات' : 'All Reviews'}</Text>
              <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                {trailName}
              </Text>
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={90}>
          <View style={[styles.summaryCard, isArabic ? rtlRow : ltrRow]}>
            <View>
              <Text style={styles.averageRating}>{averageRating}</Text>
              <View style={[styles.starRow, isArabic ? rtlRow : ltrRow]}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons key={star} name={star <= Math.round(Number(averageRating)) ? 'star' : 'star-outline'} size={15} color="#D4A843" />
                ))}
              </View>
            </View>
            <Text style={[styles.summaryText, isArabic ? rtlText : ltrText]}>
              {isArabic ? `${reviews.length} مراجعة من المجتمع` : `${reviews.length} community reviews`}
            </Text>
          </View>
        </AnimatedBlock>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color="#630E13" />
          </View>
        ) : errorMessage ? (
          <Text style={[styles.errorText, isArabic ? rtlText : ltrText]}>{errorMessage}</Text>
        ) : reviews.length ? (
          reviews.map((review, index) => (
            <AnimatedBlock key={review.id} delay={120 + index * 35}>
              <View style={styles.reviewCard}>
                <View style={[styles.reviewHeader, isArabic ? rtlRow : ltrRow]}>
                  <View style={[styles.reviewerRow, isArabic ? rtlRow : ltrRow]}>
                    <View style={styles.avatar}>
                      <Ionicons name="person" size={15} color="#630E13" />
                    </View>
                    <View>
                      <Text style={[styles.reviewerName, isArabic ? rtlText : ltrText]}>{isArabic ? 'متنزه' : 'Hiker'}</Text>
                      <Text style={[styles.reviewDate, isArabic ? rtlText : ltrText]}>
                        {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.reviewRating}>
                    {formatRating(review.rating)} <Ionicons name="star" size={12} color="#D4A843" />
                  </Text>
                </View>
                <Text style={[styles.reviewContent, isArabic ? rtlText : ltrText]}>{review.content}</Text>
                <View style={styles.reviewPhotos}>
                  <ReviewPhotoStrip photos={review.photos} />
                </View>
              </View>
            </AnimatedBlock>
          ))
        ) : (
          <Text style={[styles.emptyText, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'لا توجد مراجعات بعد لهذا المسار.' : 'No reviews for this trail yet.'}
          </Text>
        )}
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F1ED',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: '#2C2418',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 3,
    color: '#8A7A6A',
    fontSize: 13,
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    marginBottom: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  averageRating: {
    color: '#2C2418',
    fontSize: 26,
    fontWeight: '900',
  },
  starRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
  },
  summaryText: {
    flex: 1,
    color: '#6B5D4E',
    fontSize: 13,
    fontWeight: '800',
  },
  loadingState: {
    paddingVertical: 32,
  },
  errorText: {
    color: '#8B1E1E',
    fontSize: 13,
    fontWeight: '800',
  },
  reviewCard: {
    marginTop: 12,
    padding: 15,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  reviewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  reviewerName: {
    color: '#2C2418',
    fontSize: 13,
    fontWeight: '900',
  },
  reviewDate: {
    marginTop: 2,
    color: '#A18F7A',
    fontSize: 10,
    fontWeight: '700',
  },
  reviewRating: {
    color: '#8A7A6A',
    fontSize: 11,
    fontWeight: '900',
  },
  reviewContent: {
    color: '#4A4131',
    fontSize: 14,
    lineHeight: 21,
  },
  reviewPhotos: {
    marginTop: 12,
  },
  emptyText: {
    marginTop: 12,
    color: '#6B5D4E',
    fontSize: 13,
  },
});
