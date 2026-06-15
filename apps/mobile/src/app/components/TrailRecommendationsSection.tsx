import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { getTrailRecommendations, type TrailRecommendation } from '../api/recommendationsApi';
import { theme } from '../theme';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type TrailRecommendationsSectionProps = {
  isAuthenticated: boolean;
  isArabic: boolean;
  onOpenTrail: (trailId: string) => void;
};

function formatDifficulty(value?: string | null) {
  if (!value) return 'Trail';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRiskLevel(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : '';
}

function RecommendationSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonLineLarge} />
      <View style={styles.skeletonLineSmall} />
      <View style={styles.skeletonMetaRow}>
        <View style={styles.skeletonPill} />
        <View style={styles.skeletonPill} />
      </View>
    </View>
  );
}

function RecommendationCard({
  recommendation,
  isArabic,
  onOpenTrail,
}: {
  recommendation: TrailRecommendation;
  isArabic: boolean;
  onOpenTrail: (trailId: string) => void;
}) {
  const displayName = isArabic && recommendation.name_ar ? recommendation.name_ar : recommendation.name;
  const riskLevel = formatRiskLevel(recommendation.risk_level);
  const safetyScore = recommendation.safety_score ?? null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onOpenTrail(recommendation.trail_id)}
    >
      <View style={styles.imageWrap}>
        {recommendation.image ? (
          <Image source={{ uri: recommendation.image }} style={styles.image} />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="map-outline" size={28} color={theme.colors.textMuted} />
          </View>
        )}
        <View style={[styles.matchBadge, isArabic ? styles.matchBadgeRtl : styles.matchBadgeLtr]}>
          <Text style={styles.matchBadgeText}>{recommendation.score}%</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, isArabic ? rtlText : ltrText]} numberOfLines={2}>
          {displayName}
        </Text>
        <Text style={[styles.regionText, isArabic ? rtlText : ltrText]} numberOfLines={1}>
          {recommendation.region || (isArabic ? 'منطقة غير محددة' : 'Unspecified region')}
        </Text>

        <View style={[styles.metaRow, isArabic ? rtlRow : ltrRow]}>
          <View style={[styles.metaItem, isArabic ? rtlRow : ltrRow]}>
            <Ionicons name="map-outline" size={14} color={theme.colors.textMuted} />
            <Text style={styles.metaText}>{Number(recommendation.length_km || 0).toFixed(1)} km</Text>
          </View>
          <View style={[styles.metaItem, isArabic ? rtlRow : ltrRow]}>
            <Ionicons name="star" size={14} color={theme.colors.iconAccent} />
            <Text style={styles.metaText}>{Number(recommendation.rating || 0).toFixed(1)}</Text>
          </View>
          {safetyScore !== null ? (
            <View style={[styles.metaItem, isArabic ? rtlRow : ltrRow]}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#1E7A46" />
              <Text style={styles.metaText}>{safetyScore}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.tagRow, isArabic ? rtlRow : ltrRow]}>
          <View style={styles.neutralTag}>
            <Text style={styles.neutralTagText}>{formatDifficulty(recommendation.difficulty)}</Text>
          </View>
          {riskLevel ? (
            <View style={styles.safetyTag}>
              <Text style={styles.safetyTagText}>{riskLevel}</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.reasonText, isArabic ? rtlText : ltrText]}>
          {recommendation.reason || 'Recommended for your hiking profile.'}
        </Text>

        {recommendation.match_tags.length ? (
          <View style={[styles.matchTags, isArabic ? rtlRow : ltrRow]}>
            {recommendation.match_tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.matchTag}>
                <Text style={styles.matchTagText} numberOfLines={1}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function TrailRecommendationsSection({
  isAuthenticated,
  isArabic,
  onOpenTrail,
}: TrailRecommendationsSectionProps) {
  const [recommendations, setRecommendations] = React.useState<TrailRecommendation[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (!isAuthenticated) {
        setRecommendations([]);
        setIsLoading(false);
        setFailed(false);
        return undefined;
      }

      let cancelled = false;

      const loadRecommendations = async () => {
        setIsLoading(true);
        setFailed(false);

        try {
          const nextRecommendations = await getTrailRecommendations();
          if (!cancelled) {
            setRecommendations(nextRecommendations);
          }
        } catch {
          if (!cancelled) {
            setRecommendations([]);
            setFailed(true);
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      };

      void loadRecommendations();

      return () => {
        cancelled = true;
      };
    }, [isAuthenticated]),
  );

  const visibleRecommendations = React.useMemo(() => recommendations.slice(0, 8), [recommendations]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, isArabic ? rtlRow : ltrRow]}>
        <View style={styles.headingTextBlock}>
          <Text style={[styles.title, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'موصى به لك' : 'Recommended for You'}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.carouselContent, isArabic && styles.carouselContentRtl]}
        >
          {[0, 1, 2].map((item) => (
            <RecommendationSkeleton key={item} />
          ))}
        </ScrollView>
      ) : failed ? (
        <View style={[styles.messageBox, isArabic ? rtlRow : ltrRow]}>
          <Ionicons name="alert-circle-outline" size={18} color={theme.colors.buttonPrimary} />
          <Text style={[styles.messageText, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'تعذر تحميل التوصيات الآن.' : "Couldn't load recommendations right now."}
          </Text>
        </View>
      ) : visibleRecommendations.length === 0 ? (
        <View style={styles.messageBox}>
          <Text style={[styles.messageText, isArabic ? rtlText : ltrText]}>
            {isArabic
              ? 'ابدأ بحفظ أو إكمال المسارات للحصول على توصيات أفضل.'
              : 'Start saving or completing trails to get better recommendations.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.carouselContent, isArabic && styles.carouselContentRtl]}
        >
          {visibleRecommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.trail_id}
              recommendation={recommendation}
              isArabic={isArabic}
              onOpenTrail={onOpenTrail}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headingTextBlock: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  carouselContent: {
    gap: 12,
    paddingRight: 8,
  },
  carouselContentRtl: {
    flexDirection: 'row-reverse',
    paddingRight: 0,
    paddingLeft: 8,
  },
  card: {
    width: 272,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(196,184,150,0.5)',
  },
  cardPressed: {
    opacity: 0.82,
  },
  imageWrap: {
    height: 118,
    backgroundColor: '#ECE3D1',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECE3D1',
  },
  matchBadge: {
    position: 'absolute',
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(99,14,19,0.92)',
  },
  matchBadgeLtr: {
    left: 10,
  },
  matchBadgeRtl: {
    right: 10,
  },
  matchBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardBody: {
    padding: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  regionText: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  neutralTag: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#F1EFE9',
  },
  neutralTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  safetyTag: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#E7F5EA',
  },
  safetyTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E7A46',
  },
  reasonText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  matchTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  matchTag: {
    maxWidth: 110,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(99,14,19,0.1)',
  },
  matchTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.buttonPrimary,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#F1EFE9',
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  skeletonCard: {
    width: 248,
    borderRadius: 20,
    padding: 12,
    backgroundColor: theme.colors.surface,
  },
  skeletonImage: {
    height: 96,
    borderRadius: 14,
    backgroundColor: '#E3DFD7',
  },
  skeletonLineLarge: {
    height: 16,
    width: '78%',
    borderRadius: 8,
    marginTop: 12,
    backgroundColor: '#E3DFD7',
  },
  skeletonLineSmall: {
    height: 12,
    width: '52%',
    borderRadius: 6,
    marginTop: 8,
    backgroundColor: '#E3DFD7',
  },
  skeletonMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  skeletonPill: {
    height: 28,
    width: 78,
    borderRadius: 14,
    backgroundColor: '#E3DFD7',
  },
});
