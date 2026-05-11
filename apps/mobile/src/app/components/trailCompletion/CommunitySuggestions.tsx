import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { getNearbyTrails, getTrailReviews, type Trail, type TrailReview } from '../../api/trailsApi';
import { completionRadii } from '../../features/trailCompletion/theme';
import type { TrailCompletionDraft } from '../../features/trailCompletion/types';
import type { RootStackParamList } from '../../navigation/types';
import { SimilarTrailsCarousel } from './SimilarTrailsCarousel';
import { ltrRow, ltrText, rtlRow, rtlText } from '../../utils/direction';

type Nav = StackNavigationProp<RootStackParamList>;

type Props = {
  draft: TrailCompletionDraft;
  isArabic: boolean;
  navigation: Nav;
};

export function CommunitySuggestions({ draft, isArabic, navigation }: Props) {
  const [reviews, setReviews] = useState<TrailReview[]>([]);
  const [similar, setSimilar] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const [rev, nearby] = await Promise.all([
          getTrailReviews(draft.trailId).catch(() => [] as TrailReview[]),
          draft.trailCoordinates
            ? getNearbyTrails({
                lat: draft.trailCoordinates[0],
                lng: draft.trailCoordinates[1],
                radius: 25000,
              }).catch(() => [] as Trail[])
            : Promise.resolve([] as Trail[]),
        ]);
        if (cancelled) return;
        const others = rev.filter((r) => r.content?.trim()).slice(0, 4);
        setReviews(others);
        const filteredNearby = nearby.filter((t) => t.id !== draft.trailId).slice(0, 8);
        setSimilar(filteredNearby);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [draft.trailId, draft.trailCoordinates]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#630E13" />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.headline, isArabic ? rtlText : ltrText]}>
        {isArabic ? 'المجتمع على هذا المسار' : 'Community on this trail'}
      </Text>
      <Text style={[styles.subhead, isArabic ? rtlText : ltrText]}>
        {isArabic
          ? 'آراء أخرى، مسارات مجاورة، وإلهام للرحلات القادمة — من بيانات Traces الفعلية.'
          : 'Other voices, nearby routes, and ideas for what’s next — powered by real Traces data.'}
      </Text>

      {reviews.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'آخر الانطباعات' : 'Recent trail impressions'}
          </Text>
          {reviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={[styles.reviewTop, isArabic ? rtlRow : ltrRow]}>
                <View style={styles.avatar}>
                  <Ionicons name="person-outline" size={16} color="#630E13" />
                </View>
                <View style={styles.reviewHead}>
                  <Text style={[styles.reviewRating, isArabic ? rtlText : ltrText]}>
                    {isArabic ? `تقييم ${r.rating}/5` : `${r.rating}/5 rating`}
                  </Text>
                  <Text style={[styles.reviewDate, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                    {new Date(r.created_at).toLocaleDateString(isArabic ? 'ar-PS' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
              <Text style={[styles.reviewBody, isArabic ? rtlText : ltrText]} numberOfLines={4}>
                {r.content}
              </Text>
            </View>
          ))}
          <Pressable style={styles.seeAll} onPress={() => navigation.navigate('AllReviews', { trailId: draft.trailId, trailName: draft.trailName })}>
            <Text style={styles.seeAllText}>{isArabic ? 'كل المراجعات' : 'See all reviews'}</Text>
            <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={16} color="#630E13" />
          </Pressable>
        </View>
      ) : null}

      {similar.length > 0 ? (
        <View style={styles.block}>
          <SimilarTrailsCarousel trails={similar} isArabic={isArabic} navigation={navigation} />
        </View>
      ) : null}

      <View style={styles.futureHint}>
        <Ionicons name="calendar-outline" size={18} color="#7A9A3A" />
        <Text style={[styles.futureText, isArabic ? rtlText : ltrText]}>
          {isArabic
            ? 'خطط المجموعات القادمة ستظهر هنا عندما تتوفر في تطبيقك.'
            : 'Future group hikes for this region will surface here as your community features grow.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 28,
    marginBottom: 8,
  },
  loading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  headline: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2C2418',
  },
  subhead: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: '#6B5D4E',
    fontWeight: '600',
  },
  block: {
    marginTop: 20,
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#2C2418',
    marginBottom: 12,
  },
  reviewCard: {
    padding: 14,
    borderRadius: completionRadii.card,
    backgroundColor: '#FFFCF8',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,36,24,0.07)',
    marginBottom: 10,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(99,14,19,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewHead: {
    flex: 1,
  },
  reviewRating: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2C2418',
  },
  reviewDate: {
    marginTop: 2,
    fontSize: 11,
    color: '#8A7A6A',
    fontWeight: '600',
  },
  reviewBody: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: '#4A4131',
    fontWeight: '600',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#630E13',
  },
  futureHint: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: completionRadii.card,
    backgroundColor: 'rgba(122,154,58,0.1)',
  },
  futureText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#3D4F24',
    fontWeight: '600',
  },
});
