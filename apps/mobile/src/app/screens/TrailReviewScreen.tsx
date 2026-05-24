import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shareActivityPost } from '../api/activitiesApi';
import {
  addTrailCondition,
  addTrailReview,
  saveBookmark,
  type ConditionSeverity,
  type ConditionType,
  type ReactNativeFile,
} from '../api/trailsApi';
import { useTrailTracking } from '../contexts/TrailTrackingContext';
import { saveJournalEntry } from '../data/localSocial';
import type { TrailCompletionDraft } from '../features/trailCompletion/types';
import type { RootStackParamList } from '../navigation/types';
import { buildTrailBuddyReviewMessage } from '../utils/trailBuddy';

type TrailReviewNavigationProp = StackNavigationProp<RootStackParamList>;
type PhotoTarget = 'review' | 'post';
type FinishStep = 'post' | 'review';
type PostVisibility = 'public' | 'friends' | 'private';

const CONDITION_OPTIONS: Array<{ type: ConditionType; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { type: 'good', icon: 'checkmark-circle-outline', label: 'Good' },
  { type: 'fair', icon: 'partly-sunny-outline', label: 'Fair' },
  { type: 'mud', icon: 'water-outline', label: 'Mud' },
  { type: 'flood', icon: 'rainy-outline', label: 'Flood' },
  { type: 'fallen_trees', icon: 'leaf-outline', label: 'Fallen trees' },
  { type: 'closure', icon: 'close-circle-outline', label: 'Closure' },
  { type: 'snow', icon: 'snow-outline', label: 'Snow' },
  { type: 'ice', icon: 'diamond-outline', label: 'Ice' },
  { type: 'wildfire', icon: 'flame-outline', label: 'Wildfire' },
];

const SEVERITY_OPTIONS: Array<{ value: ConditionSeverity; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'extreme', label: 'Extreme' },
];

function toReactNativeFile(uri: string): ReactNativeFile {
  const filename = uri.split('/').pop()?.split('?')[0] || `hike-photo-${Date.now()}.jpg`;
  const extension = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeExtension = extension === 'jpg' ? 'jpeg' : extension;

  return {
    uri,
    name: filename,
    type: `image/${mimeExtension}`,
  };
}

function mergeUniquePhotos(current: string[], incoming: string[]) {
  return Array.from(new Set([...current, ...incoming])).slice(0, 6);
}

export function TrailReviewScreen() {
  const navigation = useNavigation<TrailReviewNavigationProp>();
  const insets = useSafeAreaInsets();
  const { finishedSession, clearFinishedSession } = useTrailTracking();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [postCaption, setPostCaption] = useState('');
  const [reviewPhotoUris, setReviewPhotoUris] = useState<string[]>([]);
  const [postPhotoUris, setPostPhotoUris] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [shouldReportCondition, setShouldReportCondition] = useState(false);
  const [conditionType, setConditionType] = useState<ConditionType>('good');
  const [conditionSeverity, setConditionSeverity] = useState<ConditionSeverity>('low');
  const [conditionDescription, setConditionDescription] = useState('');
  const [step, setStep] = useState<FinishStep>('post');
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const trailName = finishedSession?.trail?.name ?? 'This trail';
  const capturedPhotoUris = useMemo(
    () => finishedSession?.sessionPhotos.map((photo) => photo.uri) ?? [],
    [finishedSession?.sessionPhotos],
  );

  useEffect(() => {
    setReviewPhotoUris(capturedPhotoUris.slice(0, 6));
    setPostPhotoUris(capturedPhotoUris.slice(0, 6));
  }, [capturedPhotoUris]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const summary = useMemo(() => {
    if (!finishedSession) {
      return 'No completed hike was found.';
    }

    const minutes = Math.max(1, Math.round(finishedSession.elapsedMs / 60000));
    return `${minutes} min, ${finishedSession.stepCount} steps, ${finishedSession.sessionPhotos.length} photos`;
  }, [finishedSession]);
  const trailBuddyMessage = useMemo(() => {
    if (!finishedSession) {
      return null;
    }

    return buildTrailBuddyReviewMessage({
      trail: finishedSession.trail,
      elapsedMs: finishedSession.elapsedMs,
      stepCount: finishedSession.stepCount,
      photoCount: finishedSession.sessionPhotos.length,
    });
  }, [finishedSession]);

  const handlePickPhoto = async (target: PhotoTarget) => {
    const selectedCount = target === 'review' ? reviewPhotoUris.length : postPhotoUris.length;
    const remainingSlots = Math.max(0, 6 - selectedCount);

    if (!remainingSlots) {
      Alert.alert('Photo limit reached', 'You can attach up to 6 photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.85,
    });

    if (result.canceled) {
      return;
    }

    const nextUris = result.assets.map((asset) => asset.uri).filter(Boolean);
    if (target === 'review') {
      setReviewPhotoUris((current) => mergeUniquePhotos(current, nextUris));
    } else {
      setPostPhotoUris((current) => mergeUniquePhotos(current, nextUris));
    }
  };

  const handleRemovePhoto = (target: PhotoTarget, uri: string) => {
    if (target === 'review') {
      setReviewPhotoUris((current) => current.filter((item) => item !== uri));
    } else {
      setPostPhotoUris((current) => current.filter((item) => item !== uri));
    }
  };

  const handleBack = () => {
    if (step === 'review') {
      setStep('post');
      return;
    }

    navigation.goBack();
  };

  const handleSubmit = async () => {
    if (!finishedSession?.trailId) {
      navigation.navigate('AppTabs', { screen: 'Explore' });
      return;
    }

    setIsSaving(true);

    try {
      await saveBookmark({ trailId: finishedSession.trailId, type: 'completed' });

      if (rating > 0) {
        await addTrailReview(finishedSession.trailId, {
          rating,
          content: review.trim() || 'Completed this trail and shared a quick review from the hike.',
          photos: reviewPhotoUris.map(toReactNativeFile),
        });
      }

      if (shouldReportCondition) {
        await addTrailCondition(finishedSession.trailId, {
          condition_type: conditionType,
          severity: conditionSeverity,
          description: conditionDescription.trim() || undefined,
        });
      }

      const trimmedReview = review.trim();
      const trimmedPostCaption = postCaption.trim();
      const draft: TrailCompletionDraft = {
        activityId: finishedSession.activityId,
        trailId: finishedSession.trailId,
        trailName,
        trailNameAr: finishedSession.trail?.nameAr,
        trailImage: finishedSession.trail?.image,
        region: finishedSession.trail?.region,
        regionAr: finishedSession.trail?.regionAr,
        rating,
        review: trimmedReview,
        reviewPhotoUris,
        postCaption: trimmedPostCaption,
        postPhotoUris,
        activityPhotoTags: finishedSession.sessionPhotos.map((photo) => ({
          uri: photo.uri,
          coordinate: photo.coordinate,
          capturedAt: photo.capturedAt,
        })),
        postVisibility: visibility,
        photoUris: postPhotoUris,
        completedAtIso: new Date().toISOString(),
        durationMs: finishedSession.elapsedMs,
        stepCount: finishedSession.stepCount,
        routePointCount: finishedSession.recordedPath.length,
        trailDistanceKm: finishedSession.trail?.distance,
        trailElevationGainM: finishedSession.trail?.elevationGain,
        trailCoordinates: finishedSession.trail?.coordinates,
      };

      if (visibility !== 'private') {
        clearFinishedSession();
        navigation.replace('ActivityShare', { draft });
      } else {
        if (draft.activityId) {
          await shareActivityPost(draft.activityId, {
            visibility: 'private',
            caption: trimmedPostCaption || trimmedReview || 'Private hike post',
          });
        } else {
          saveJournalEntry({
            type: 'journal',
            trail: trailName,
            note: trimmedPostCaption || trimmedReview || 'Private hike post',
            date: draft.completedAtIso,
            photoUris: postPhotoUris,
          });
        }
        clearFinishedSession();
        Alert.alert('Saved privately', 'Your private post was saved to your journal.', [
          {
            text: 'Open journal',
            onPress: () => {
              navigation.reset({
                index: 1,
                routes: [
                  { name: 'AppTabs', params: { screen: 'Explore' } },
                  { name: 'Journal' },
                ],
              });
            },
          },
        ]);
      }
    } catch (error) {
      Alert.alert('Unable to save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!finishedSession) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No finished hike yet</Text>
        <Pressable style={styles.emptyButton} onPress={() => navigation.navigate('AppTabs', { screen: 'Explore' })}>
          <Text style={styles.emptyButtonText}>Back to trails</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top + 10, 18),
          paddingBottom: Math.max(insets.bottom + 24, 28),
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={20} color="#2C2418" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{step === 'post' ? 'Share your hike' : 'Review the trail'}</Text>
          </View>
        </View>

        <View style={styles.stepRow}>
          <View style={[styles.stepPill, styles.stepPillActive]}>
            <Text style={styles.stepPillTextActive}>1 Post</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={[styles.stepPill, step === 'review' && styles.stepPillActive]}>
            <Text style={step === 'review' ? styles.stepPillTextActive : styles.stepPillText}>2 Review</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#1E7A46" />
            <Text style={styles.summaryBadgeText}>Trail completed</Text>
          </View>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>

        {trailBuddyMessage ? (
          <View style={styles.trailBuddyCard}>
            <View style={styles.trailBuddyAvatar}>
              <View style={styles.trailBuddyHat}>
                <Ionicons name="leaf" size={13} color="#1E7A46" />
              </View>
              <View style={styles.trailBuddyEyesRow}>
                <View style={styles.trailBuddyEye} />
                <View style={styles.trailBuddyEye} />
              </View>
              <View style={styles.trailBuddySmile} />
            </View>
            <View style={styles.trailBuddyCopy}>
              <Text style={styles.trailBuddyTitle}>{trailBuddyMessage.title}</Text>
              <Text style={styles.trailBuddyText}>{trailBuddyMessage.body}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Photos from the way</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {finishedSession.sessionPhotos.length ? (
            finishedSession.sessionPhotos.map((photo) => <Image key={photo.id} source={{ uri: photo.uri }} style={styles.photo} />)
          ) : (
            <View style={styles.emptyPhotosCard}>
              <Ionicons name="images-outline" size={22} color="#8A7A6A" />
              <Text style={styles.emptyPhotosText}>No photos were captured on this hike.</Text>
            </View>
          )}
        </ScrollView>

        {step === 'post' ? (
          <>
            <Text style={styles.sectionTitle}>Activity post</Text>
            <TextInput
              value={postCaption}
              onChangeText={setPostCaption}
              multiline
              placeholder="Write a caption for your public post."
              placeholderTextColor="#9B8B78"
              style={styles.reviewInput}
            />

            <PhotoPicker
              title="Post pictures"
              hint="These photos appear on the Activity post."
              photos={postPhotoUris}
              target="post"
              onAdd={handlePickPhoto}
              onRemove={handleRemovePhoto}
            />

            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.visibilityRow}>
              <VisibilityOption
                visibility="public"
                activeVisibility={visibility}
                icon="megaphone-outline"
                title="Public"
                description="Share this hike with everyone in Activity."
                onPress={setVisibility}
              />
              <VisibilityOption
                visibility="friends"
                activeVisibility={visibility}
                icon="people-outline"
                title="Friends only"
                description="Share this hike only with people who follow you."
                onPress={setVisibility}
              />
              <VisibilityOption
                visibility="private"
                activeVisibility={visibility}
                icon="lock-closed-outline"
                title="Keep private"
                description="Save the post to your journal instead of Activity."
                onPress={setVisibility}
              />
            </View>

            <Pressable style={styles.submitButton} onPress={() => setStep('review')}>
              <Text style={styles.submitButtonText}>Continue to review</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Your review</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable key={value} onPress={() => setRating(value)} style={styles.starButton}>
                  <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={28} color="#D4A843" />
                </Pressable>
              ))}
            </View>

            <TextInput
              value={review}
              onChangeText={setReview}
              multiline
              placeholder="How was the trail, the route, and the overall experience?"
              placeholderTextColor="#9B8B78"
              style={styles.reviewInput}
            />

            <PhotoPicker
              title="Review pictures"
              hint="These photos attach to your trail review."
              photos={reviewPhotoUris}
              target="review"
              onAdd={handlePickPhoto}
              onRemove={handleRemovePhoto}
            />

            <ConditionReporter
              enabled={shouldReportCondition}
              onToggle={() => setShouldReportCondition((value) => !value)}
              conditionType={conditionType}
              onConditionTypeChange={setConditionType}
              severity={conditionSeverity}
              onSeverityChange={setConditionSeverity}
              description={conditionDescription}
              onDescriptionChange={setConditionDescription}
            />

            <Pressable style={[styles.submitButton, isSaving && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Save hike</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function VisibilityOption({
  visibility,
  activeVisibility,
  icon,
  title,
  description,
  onPress,
}: {
  visibility: PostVisibility;
  activeVisibility: PostVisibility;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: (visibility: PostVisibility) => void;
}) {
  const active = activeVisibility === visibility;

  return (
    <Pressable style={[styles.visibilityCard, active && styles.visibilityCardActive]} onPress={() => onPress(visibility)}>
      <Ionicons name={icon} size={18} color={active ? '#fff' : '#630E13'} />
      <View style={styles.visibilityCopy}>
        <Text style={[styles.visibilityTitle, active && styles.visibilityTitleActive]}>{title}</Text>
        <Text style={[styles.visibilityText, active && styles.visibilityTextActive]}>{description}</Text>
      </View>
    </Pressable>
  );
}

function PhotoPicker({
  title,
  hint,
  photos,
  target,
  onAdd,
  onRemove,
}: {
  title: string;
  hint: string;
  photos: string[];
  target: PhotoTarget;
  onAdd: (target: PhotoTarget) => void;
  onRemove: (target: PhotoTarget, uri: string) => void;
}) {
  return (
    <View style={styles.pickerBlock}>
      <View style={styles.pickerHeader}>
        <View style={styles.pickerCopy}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <Text style={styles.pickerHint}>{hint}</Text>
        </View>
        <Pressable style={styles.addPhotoButton} onPress={() => onAdd(target)}>
          <Ionicons name="add" size={18} color="#630E13" />
          <Text style={styles.addPhotoText}>Add</Text>
        </Pressable>
      </View>

      {photos.length ? (
        <View style={styles.pickerGrid}>
          {photos.map((uri) => (
            <View key={uri} style={styles.pickerPhotoWrap}>
              <Image source={{ uri }} style={styles.pickerPhoto} />
              <Pressable style={styles.removePhotoButton} onPress={() => onRemove(target, uri)}>
                <Ionicons name="close-circle" size={22} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Pressable style={styles.emptyPicker} onPress={() => onAdd(target)}>
          <Ionicons name="images-outline" size={22} color="#8A7A6A" />
          <Text style={styles.emptyPhotosText}>Add pictures from this hike or your library.</Text>
        </Pressable>
      )}
    </View>
  );
}

function ConditionReporter({
  enabled,
  onToggle,
  conditionType,
  onConditionTypeChange,
  severity,
  onSeverityChange,
  description,
  onDescriptionChange,
}: {
  enabled: boolean;
  onToggle: () => void;
  conditionType: ConditionType;
  onConditionTypeChange: (value: ConditionType) => void;
  severity: ConditionSeverity;
  onSeverityChange: (value: ConditionSeverity) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
}) {
  return (
    <View style={styles.conditionBlock}>
      <Pressable style={styles.conditionToggleRow} onPress={onToggle}>
        <View style={[styles.conditionToggleIcon, enabled && styles.conditionToggleIconActive]}>
          <Ionicons name={enabled ? 'checkmark' : 'trail-sign-outline'} size={17} color={enabled ? '#fff' : '#630E13'} />
        </View>
        <View style={styles.conditionToggleCopy}>
          <Text style={styles.conditionTitle}>Trail condition report</Text>
          <Text style={styles.conditionHint}>Share what the route was actually like when you finished.</Text>
        </View>
        <Ionicons name={enabled ? 'chevron-up' : 'chevron-down'} size={18} color="#8A7A6A" />
      </Pressable>

      {enabled ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.conditionChipRow}>
            {CONDITION_OPTIONS.map((option) => {
              const active = conditionType === option.type;
              return (
                <Pressable
                  key={option.type}
                  style={[styles.conditionChip, active && styles.conditionChipActive]}
                  onPress={() => onConditionTypeChange(option.type)}
                >
                  <Ionicons name={option.icon} size={15} color={active ? '#fff' : '#630E13'} />
                  <Text style={[styles.conditionChipText, active && styles.conditionChipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.severityRow}>
            {SEVERITY_OPTIONS.map((option) => {
              const active = severity === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.severityChip, active && styles.severityChipActive]}
                  onPress={() => onSeverityChange(option.value)}
                >
                  <Text style={[styles.severityChipText, active && styles.severityChipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={description}
            onChangeText={onDescriptionChange}
            multiline
            placeholder="Optional: mud near the ridge, blocked gate, clear route..."
            placeholderTextColor="#9B8B78"
            style={styles.conditionInput}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F1ED',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  iconButton: {
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
    fontSize: 26,
    fontWeight: '900',
    color: '#2C2418',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#7B6D5A',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepPill: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  stepPillActive: {
    backgroundColor: '#630E13',
    borderColor: '#630E13',
  },
  stepPillText: {
    color: '#7B6D5A',
    fontSize: 12,
    fontWeight: '900',
  },
  stepPillTextActive: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  stepLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E7D8C3',
    marginHorizontal: 8,
  },
  summaryCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryBadgeText: {
    color: '#1E7A46',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryText: {
    marginTop: 10,
    color: '#4A4131',
    fontSize: 14,
    fontWeight: '700',
  },
  trailBuddyCard: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 12,
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#EEF7EF',
    borderWidth: 1,
    borderColor: '#CFE4C8',
  },
  trailBuddyAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F1',
    borderWidth: 2,
    borderColor: '#1E7A46',
  },
  trailBuddyHat: {
    position: 'absolute',
    top: -8,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDECCB',
    borderWidth: 1,
    borderColor: '#BFD9A7',
  },
  trailBuddyEyesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  trailBuddyEye: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#2C2418',
  },
  trailBuddySmile: {
    width: 16,
    height: 8,
    marginTop: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#1E7A46',
    borderRadius: 8,
  },
  trailBuddyCopy: {
    flex: 1,
    minWidth: 0,
  },
  trailBuddyTitle: {
    color: '#2C2418',
    fontSize: 13,
    fontWeight: '900',
  },
  trailBuddyText: {
    marginTop: 4,
    color: '#5E4E40',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 12,
    color: '#2C2418',
    fontSize: 16,
    fontWeight: '800',
  },
  photoRow: {
    gap: 12,
  },
  photo: {
    width: 150,
    height: 150,
    borderRadius: 18,
    backgroundColor: '#EADFD1',
  },
  emptyPhotosCard: {
    width: 250,
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyPhotosText: {
    flex: 1,
    color: '#6B5D4E',
    fontSize: 13,
    lineHeight: 18,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    paddingVertical: 4,
  },
  reviewInput: {
    minHeight: 140,
    marginTop: 12,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    color: '#2C2418',
    fontSize: 15,
    lineHeight: 22,
  },
  pickerBlock: {
    marginTop: 14,
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickerCopy: {
    flex: 1,
  },
  pickerTitle: {
    color: '#2C2418',
    fontSize: 14,
    fontWeight: '900',
  },
  pickerHint: {
    marginTop: 3,
    color: '#7B6D5A',
    fontSize: 12,
    lineHeight: 17,
  },
  addPhotoButton: {
    minHeight: 40,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F6E9DE',
  },
  addPhotoText: {
    color: '#630E13',
    fontSize: 13,
    fontWeight: '900',
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  pickerPhotoWrap: {
    width: '30.5%',
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EADFD1',
  },
  pickerPhoto: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  emptyPicker: {
    minHeight: 84,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E7D8C3',
    borderStyle: 'dashed',
    backgroundColor: '#FFF8F1',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 6,
  },
  conditionBlock: {
    marginTop: 16,
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  conditionToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  conditionToggleIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  conditionToggleIconActive: {
    backgroundColor: '#630E13',
  },
  conditionToggleCopy: {
    flex: 1,
  },
  conditionTitle: {
    color: '#2C2418',
    fontSize: 14,
    fontWeight: '900',
  },
  conditionHint: {
    marginTop: 3,
    color: '#7B6D5A',
    fontSize: 12,
    lineHeight: 17,
  },
  conditionChipRow: {
    gap: 8,
    paddingRight: 2,
    marginTop: 14,
  },
  conditionChip: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F7EBE8',
  },
  conditionChipActive: {
    backgroundColor: '#630E13',
  },
  conditionChipText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  conditionChipTextActive: {
    color: '#fff',
  },
  severityRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  severityChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#F0E2D2',
  },
  severityChipActive: {
    backgroundColor: '#2C2418',
    borderColor: '#2C2418',
  },
  severityChipText: {
    color: '#6B5D4E',
    fontSize: 11,
    fontWeight: '900',
  },
  severityChipTextActive: {
    color: '#fff',
  },
  conditionInput: {
    minHeight: 92,
    marginTop: 10,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFF8F1',
    textAlignVertical: 'top',
    color: '#2C2418',
    fontSize: 14,
    lineHeight: 20,
  },
  visibilityRow: {
    gap: 12,
  },
  visibilityCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  visibilityCardActive: {
    backgroundColor: '#630E13',
    borderColor: '#630E13',
  },
  visibilityCopy: {
    flex: 1,
  },
  visibilityTitle: {
    color: '#2C2418',
    fontSize: 15,
    fontWeight: '800',
  },
  visibilityTitleActive: {
    color: '#FFFFFF',
  },
  visibilityText: {
    marginTop: 4,
    color: '#6B5D4E',
    fontSize: 13,
    lineHeight: 18,
  },
  visibilityTextActive: {
    color: 'rgba(255,255,255,0.78)',
  },
  submitButton: {
    marginTop: 24,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
  submitButtonDisabled: {
    opacity: 0.72,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F3F1ED',
  },
  emptyTitle: {
    color: '#2C2418',
    fontSize: 20,
    fontWeight: '800',
  },
  emptyButton: {
    marginTop: 16,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#630E13',
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
