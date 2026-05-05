import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';
import { addTrailReview, type ReactNativeFile, type TrailReview } from '../api/trailsApi';
import { ReviewPhotoStrip } from './ReviewPhotoStrip';

type ReviewSort = 'recent' | 'helpful' | 'highest';
type ReviewDraftPhoto = ReactNativeFile & { id: string };

const reviewLabelOptions = [
  { id: 'great-views', label: 'Great views', icon: 'sunny-outline' as const },
  { id: 'family-friendly', label: 'Family friendly', icon: 'people-outline' as const },
  { id: 'muddy', label: 'Muddy', icon: 'water-outline' as const },
  { id: 'steep', label: 'Steep', icon: 'trending-up-outline' as const },
  { id: 'well-marked', label: 'Well marked', icon: 'trail-sign-outline' as const },
  { id: 'quiet', label: 'Quiet', icon: 'leaf-outline' as const },
];

interface ReviewsSectionProps {
  reviews: TrailReview[];
  trailId: string;
  isArabic: boolean;
  onReviewAdded?: (review: TrailReview) => void;
  onViewAllReviews?: () => void;
  onRequireAuth?: () => void;
  isAuthenticated?: boolean;
}

const sortOptions: Array<{ id: ReviewSort; en: string; ar: string }> = [
  { id: 'recent', en: 'Recent', ar: 'الأحدث' },
  { id: 'helpful', en: 'Helpful', ar: 'الأكثر فائدة' },
  { id: 'highest', en: 'Highest', ar: 'الأعلى تقييماً' },
];

function formatRating(value: number | string | undefined | null) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : '0.0';
}

function getReviewDate(value: string | undefined) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getHelpfulSeed(review: TrailReview) {
  const base = review.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (base % 9) + Math.max(0, Math.round(Number(review.rating) || 0) - 3);
}

function buildReviewPhoto(asset: ImagePicker.ImagePickerAsset): ReviewDraftPhoto {
  const extension = asset.uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const mimeExtension = extension === 'jpg' ? 'jpeg' : extension;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    uri: asset.uri,
    name: asset.fileName ?? `review-photo-${Date.now()}.${extension}`,
    type: asset.mimeType ?? `image/${mimeExtension}`,
  };
}

function addLabelsToContent(content: string, labels: string[]) {
  if (!labels.length) {
    return content;
  }

  return `${content}\n\nLabels: ${labels.join(', ')}`;
}

export function ReviewsSection({
  reviews,
  trailId,
  isArabic,
  onReviewAdded,
  onViewAllReviews,
  onRequireAuth,
  isAuthenticated = true,
}: ReviewsSectionProps) {
  const [sortBy, setSortBy] = useState<ReviewSort>('recent');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({});
  const [helpfulReviews, setHelpfulReviews] = useState<Record<string, boolean>>({});
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [draftRating, setDraftRating] = useState(5);
  const [draftReview, setDraftReview] = useState('');
  const [draftPhotos, setDraftPhotos] = useState<ReviewDraftPhoto[]>([]);
  const [draftLabels, setDraftLabels] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const ratingDistribution = useMemo(() => {
    const counts = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: reviews.filter((review) => Math.round(Number(review.rating)) === rating).length,
    }));
    const maxCount = Math.max(1, ...counts.map((item) => item.count));
    return counts.map((item) => ({ ...item, percent: item.count / maxCount }));
  }, [reviews]);

  const sortedReviews = useMemo(() => {
    return [...reviews].sort((left, right) => {
      if (sortBy === 'highest') {
        return Number(right.rating) - Number(left.rating) || getReviewDate(right.created_at) - getReviewDate(left.created_at);
      }
      if (sortBy === 'helpful') {
        const rightHelpful = getHelpfulSeed(right) + (helpfulReviews[right.id] ? 1 : 0);
        const leftHelpful = getHelpfulSeed(left) + (helpfulReviews[left.id] ? 1 : 0);
        return rightHelpful - leftHelpful || getReviewDate(right.created_at) - getReviewDate(left.created_at);
      }
      return getReviewDate(right.created_at) - getReviewDate(left.created_at);
    });
  }, [helpfulReviews, reviews, sortBy]);

  const visibleReviews = sortedReviews.slice(0, 3);
  const selectedSort = sortOptions.find((option) => option.id === sortBy) ?? sortOptions[0];

  const handleOpenWriteReview = () => {
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    setErrorMessage('');
    setIsReviewModalOpen(true);
  };

  const handleCloseReviewModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsReviewModalOpen(false);
    setErrorMessage('');
  };

  const handlePickReviewPhotos = async (source: 'camera' | 'library') => {
    const remainingSlots = Math.max(0, 4 - draftPhotos.length);

    if (!remainingSlots) {
      setErrorMessage(isArabic ? 'يمكنك إضافة 4 صور كحد أقصى.' : 'You can add up to 4 photos.');
      return;
    }

    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setErrorMessage(
          source === 'camera'
            ? isArabic
              ? 'نحتاج إذن الكاميرا لإضافة صورة.'
              : 'Camera permission is needed to add a photo.'
            : isArabic
            ? 'نحتاج إذن مكتبة الصور لإضافة صورة.'
            : 'Photo library permission is needed to add a photo.',
        );
        return;
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.75,
            mediaTypes: ['images'],
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: false,
            allowsMultipleSelection: true,
            selectionLimit: remainingSlots,
            quality: 0.75,
            mediaTypes: ['images'],
          });

      if (result.canceled) {
        return;
      }

      const nextPhotos = result.assets.slice(0, remainingSlots).map(buildReviewPhoto);
      setDraftPhotos((current) => [...current, ...nextPhotos].slice(0, 4));
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : isArabic ? 'تعذر اختيار الصورة الآن.' : 'Unable to choose a photo right now.');
    }
  };

  const handleSubmitReview = async () => {
    const content = draftReview.trim();
    if (!content) {
      setErrorMessage(isArabic ? 'اكتب مراجعة قصيرة قبل الإرسال.' : 'Write a short review before sending.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await addTrailReview(trailId, {
        rating: draftRating,
        content: addLabelsToContent(content, draftLabels),
        photos: draftPhotos,
      });
      const createdAt = new Date().toISOString();

      onReviewAdded?.({
        id: response.data.id,
        trail_id: trailId,
        user_id: 'me',
        rating: draftRating,
        content: addLabelsToContent(content, draftLabels),
        created_at: createdAt,
        photos: response.data.photos?.length
          ? response.data.photos
          : draftPhotos.map((photo) => ({ id: photo.id, url: photo.uri, created_at: createdAt })),
      });
      setDraftRating(5);
      setDraftReview('');
      setDraftPhotos([]);
      setDraftLabels([]);
      setIsReviewModalOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : isArabic ? 'تعذر إرسال المراجعة الآن.' : 'Unable to post review right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.sectionCard}>
      <View style={[styles.sectionHeader, isArabic ? rtlRow : ltrRow]}>
        <View style={styles.sectionTitleGroup}>
          <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'المراجعات' : 'Reviews'}</Text>
          <Text style={[styles.sectionSubtitle, isArabic ? rtlText : ltrText]}>
            {isArabic ? `${reviews.length} مراجعة من المجتمع` : `${reviews.length} community reviews`}
          </Text>
        </View>
        <Pressable style={styles.writeButton} onPress={handleOpenWriteReview}>
          <Ionicons name="create-outline" size={15} color="#fff" />
          <Text style={styles.writeButtonText}>{isArabic ? 'اكتب' : 'Write'}</Text>
        </Pressable>
      </View>

      <View style={styles.distributionPanel} pointerEvents="none">
        {ratingDistribution.map((item) => (
          <View key={item.rating} style={[styles.distributionRow, isArabic ? rtlRow : ltrRow]}>
            <Text style={styles.distributionLabel}>{item.rating}</Text>
            <Ionicons name="star" size={11} color="#D4A843" />
            <View style={styles.distributionTrack}>
              <View style={[styles.distributionFill, { width: `${Math.max(4, item.percent * 100)}%` }]} />
            </View>
            <Text style={styles.distributionCount}>{item.count}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.reviewToolbar, isArabic ? rtlRow : ltrRow]}>
        <Pressable style={[styles.sortButton, isSortOpen && styles.sortButtonActive]} onPress={() => setIsSortOpen((value) => !value)}>
          <Ionicons name="swap-vertical-outline" size={14} color="#630E13" />
          <Text style={styles.sortButtonText}>{isArabic ? selectedSort.ar : selectedSort.en}</Text>
          <Ionicons name={isSortOpen ? 'chevron-up' : 'chevron-down'} size={13} color="#630E13" />
        </Pressable>
        <Pressable style={styles.viewAllButton} onPress={onViewAllReviews}>
          <Text style={styles.viewAllText}>{isArabic ? 'عرض الكل' : 'View all reviews'}</Text>
        </Pressable>
      </View>

      {isSortOpen ? (
        <View style={styles.sortMenu}>
          {sortOptions.map((option) => {
            const active = option.id === sortBy;
            return (
              <Pressable
                key={option.id}
                style={[styles.sortOption, active && styles.sortOptionActive, isArabic ? rtlRow : ltrRow]}
                onPress={() => {
                  setSortBy(option.id);
                  setIsSortOpen(false);
                }}
              >
                <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>{isArabic ? option.ar : option.en}</Text>
                {active ? <Ionicons name="checkmark" size={16} color="#630E13" /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {visibleReviews.length ? (
        visibleReviews.map((review) => {
          const isExpanded = !!expandedReviews[review.id];
          const isLong = review.content.length > 130;
          const isHelpful = !!helpfulReviews[review.id];
          const helpfulCount = getHelpfulSeed(review) + (isHelpful ? 1 : 0);

          return (
            <Pressable
              key={review.id}
              style={styles.reviewCard}
              onPress={() => {
                if (isLong) {
                  setExpandedReviews((current) => ({ ...current, [review.id]: !current[review.id] }));
                }
              }}
            >
              <View style={[styles.reviewHeader, isArabic ? rtlRow : ltrRow]}>
                <View style={[styles.reviewerRow, isArabic ? rtlRow : ltrRow]}>
                  <View style={styles.reviewerAvatar}>
                    <Ionicons name="person" size={15} color="#630E13" />
                  </View>
                  <View>
                    <Text style={[styles.reviewUser, isArabic ? rtlText : ltrText]}>{isArabic ? 'متنزه' : 'Hiker'}</Text>
                    <Text style={[styles.reviewDate, isArabic ? rtlText : ltrText]}>
                      {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                    </Text>
                  </View>
                </View>
                <Text style={styles.reviewRating}>
                  {formatRating(review.rating)} <Ionicons name="star" size={12} color="#D4A843" />
                </Text>
              </View>

              <Text style={[styles.reviewText, isArabic ? rtlText : ltrText]} numberOfLines={isExpanded ? undefined : 3}>
                {review.content}
              </Text>
              <View style={styles.reviewPhotos}>
                <ReviewPhotoStrip photos={review.photos} />
              </View>
              {isLong ? (
                <Text style={[styles.expandHint, isArabic ? rtlText : ltrText]}>
                  {isExpanded ? (isArabic ? 'عرض أقل' : 'Show less') : isArabic ? 'اضغط لقراءة المزيد' : 'Tap to read more'}
                </Text>
              ) : null}

              <Pressable
                style={[styles.helpfulButton, isHelpful && styles.helpfulButtonActive, isArabic ? rtlRow : ltrRow]}
                onPress={() => setHelpfulReviews((current) => ({ ...current, [review.id]: !current[review.id] }))}
              >
                <Ionicons name={isHelpful ? 'thumbs-up' : 'thumbs-up-outline'} size={15} color={isHelpful ? '#fff' : '#630E13'} />
                <Text style={[styles.helpfulText, isHelpful && styles.helpfulTextActive]}>
                  {isArabic ? `مفيد (${helpfulCount})` : `Helpful (${helpfulCount})`}
                </Text>
              </Pressable>
            </Pressable>
          );
        })
      ) : (
        <Text style={[styles.reviewEmpty, isArabic ? rtlText : ltrText]}>
          {isArabic ? 'لا توجد مراجعات بعد لهذا المسار.' : 'No reviews for this trail yet.'}
        </Text>
      )}

      <Modal visible={isReviewModalOpen} transparent animationType="fade" onRequestClose={handleCloseReviewModal}>
        <View style={styles.modalScrim}>
          <View style={styles.reviewModal}>
            <View style={[styles.modalHeader, isArabic ? rtlRow : ltrRow]}>
              <Text style={[styles.modalTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'اكتب مراجعة' : 'Write a Review'}</Text>
              <Pressable style={styles.modalCloseButton} onPress={handleCloseReviewModal}>
                <Ionicons name="close" size={18} color="#2C2418" />
              </Pressable>
            </View>

            <View style={[styles.ratingPicker, isArabic ? rtlRow : ltrRow]}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <Pressable key={rating} onPress={() => setDraftRating(rating)} hitSlop={8}>
                  <Ionicons name={rating <= draftRating ? 'star' : 'star-outline'} size={28} color="#D4A843" />
                </Pressable>
              ))}
            </View>

            <TextInput
              value={draftReview}
              onChangeText={(value) => {
                setDraftReview(value);
                if (errorMessage) setErrorMessage('');
              }}
              multiline
              placeholder={isArabic ? 'شارك نصيحة عن المسار أو أفضل وقت للزيارة...' : 'Share a trail tip, condition note, or best time to go...'}
              placeholderTextColor="#A18F7A"
              style={[styles.reviewInput, isArabic ? rtlText : ltrText]}
            />

            <View style={[styles.photoActionsRow, isArabic ? rtlRow : ltrRow]}>
              <Pressable style={styles.photoActionButton} onPress={() => handlePickReviewPhotos('library')}>
                <Ionicons name="images-outline" size={16} color="#630E13" />
                <Text style={styles.photoActionText}>{isArabic ? 'اختيار صور' : 'Add photos'}</Text>
              </Pressable>
              <Pressable style={styles.photoActionButton} onPress={() => handlePickReviewPhotos('camera')}>
                <Ionicons name="camera-outline" size={16} color="#630E13" />
                <Text style={styles.photoActionText}>{isArabic ? 'الكاميرا' : 'Camera'}</Text>
              </Pressable>
            </View>

            {draftPhotos.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.draftPhotoRow}>
                {draftPhotos.map((photo) => (
                  <View key={photo.id} style={styles.draftPhotoFrame}>
                    <Image source={{ uri: photo.uri }} style={styles.draftPhoto} resizeMode="cover" />
                    <Pressable
                      style={styles.removePhotoButton}
                      onPress={() => setDraftPhotos((current) => current.filter((item) => item.id !== photo.id))}
                    >
                      <Ionicons name="close" size={13} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {errorMessage ? (
              <Text style={[styles.modalError, isArabic ? rtlText : ltrText]}>{errorMessage}</Text>
            ) : null}

            <Pressable style={[styles.submitReviewButton, isSubmitting && styles.submitReviewButtonDisabled]} onPress={handleSubmitReview} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitReviewText}>{isArabic ? 'نشر المراجعة' : 'Post review'}</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitleGroup: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2C2418',
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#8A7A6A',
  },
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#630E13',
  },
  writeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  distributionPanel: {
    marginTop: 14,
    gap: 7,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  distributionLabel: {
    width: 12,
    color: '#6B5D4E',
    fontSize: 11,
    fontWeight: '900',
  },
  distributionTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#EFE5CD',
  },
  distributionFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#D4A843',
  },
  distributionCount: {
    width: 20,
    color: '#8A7A6A',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  reviewToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F7EBE8',
  },
  sortButtonActive: {
    backgroundColor: '#F0DDD8',
  },
  sortButtonText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  viewAllButton: {
    paddingVertical: 8,
  },
  viewAllText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  sortMenu: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8D9C7',
    backgroundColor: '#FFF8F1',
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  sortOptionActive: {
    backgroundColor: '#F6E9DE',
  },
  sortOptionText: {
    color: '#6B5D4E',
    fontSize: 13,
    fontWeight: '800',
  },
  sortOptionTextActive: {
    color: '#630E13',
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
    gap: 10,
    marginBottom: 8,
  },
  reviewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  reviewUser: {
    color: '#2C2418',
    fontSize: 13,
    fontWeight: '800',
  },
  reviewDate: {
    marginTop: 1,
    color: '#A18F7A',
    fontSize: 10,
    fontWeight: '700',
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
  reviewPhotos: {
    marginTop: 10,
  },
  expandHint: {
    marginTop: 7,
    color: '#630E13',
    fontSize: 12,
    fontWeight: '800',
  },
  helpfulButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 11,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: '#FFF8F1',
  },
  helpfulButtonActive: {
    backgroundColor: '#630E13',
  },
  helpfulText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  helpfulTextActive: {
    color: '#fff',
  },
  reviewEmpty: {
    marginTop: 14,
    color: '#6B5D4E',
    fontSize: 13,
    lineHeight: 20,
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(28,20,13,0.42)',
  },
  reviewModal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 28,
    backgroundColor: '#FBF7EE',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    color: '#2C2418',
    fontSize: 18,
    fontWeight: '900',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE5CD',
  },
  ratingPicker: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  reviewInput: {
    minHeight: 128,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.12)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    color: '#2C2418',
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  modalError: {
    marginTop: 10,
    color: '#8B1E1E',
    fontSize: 13,
    fontWeight: '800',
  },
  submitReviewButton: {
    minHeight: 52,
    marginTop: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
  submitReviewButtonDisabled: {
    opacity: 0.75,
  },
  submitReviewText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});
