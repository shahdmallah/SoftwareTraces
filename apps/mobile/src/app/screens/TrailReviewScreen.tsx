import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addTrailReview, saveBookmark } from '../api/trailsApi';
import { useTrailTracking } from '../contexts/TrailTrackingContext';
import type { RootStackParamList } from '../navigation/types';

type TrailReviewNavigationProp = StackNavigationProp<RootStackParamList>;

export function TrailReviewScreen() {
  const navigation = useNavigation<TrailReviewNavigationProp>();
  const insets = useSafeAreaInsets();
  const { finishedSession, clearFinishedSession } = useTrailTracking();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [isSaving, setIsSaving] = useState(false);

  const trailName = finishedSession?.trail?.name ?? 'This trail';
  const summary = useMemo(() => {
    if (!finishedSession) {
      return 'No completed hike was found.';
    }

    const minutes = Math.max(1, Math.round(finishedSession.elapsedMs / 60000));
    return `${minutes} min, ${finishedSession.stepCount} steps, ${finishedSession.sessionPhotos.length} photos`;
  }, [finishedSession]);

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
        });
      }

      const draft = {
        trailName,
        rating,
        review: review.trim(),
        photoUris: finishedSession.sessionPhotos.map((photo) => photo.uri),
      };

      clearFinishedSession();

      if (visibility === 'public') {
        navigation.replace('ActivityShare', { draft });
      } else {
        Alert.alert('Saved privately', 'Your review was saved and the hike was kept private.');
        navigation.reset({
          index: 1,
          routes: [
            { name: 'AppTabs', params: { screen: 'Explore' } },
            { name: 'TrailDetail', params: { trailId: finishedSession.trailId } },
          ],
        });
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
        contentContainerStyle={{
          paddingTop: Math.max(insets.top + 10, 18),
          paddingBottom: Math.max(insets.bottom + 24, 28),
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color="#2C2418" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Finish your hike</Text>
            <Text style={styles.subtitle}>{trailName}</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#1E7A46" />
            <Text style={styles.summaryBadgeText}>Trail completed</Text>
          </View>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>

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

        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.visibilityRow}>
          <Pressable
            style={[styles.visibilityCard, visibility === 'public' && styles.visibilityCardActive]}
            onPress={() => setVisibility('public')}
          >
            <Ionicons name="megaphone-outline" size={18} color={visibility === 'public' ? '#fff' : '#630E13'} />
            <View style={styles.visibilityCopy}>
              <Text style={[styles.visibilityTitle, visibility === 'public' && styles.visibilityTitleActive]}>Make it a post</Text>
              <Text style={[styles.visibilityText, visibility === 'public' && styles.visibilityTextActive]}>
                Send this hike to the share flow with your review and photos.
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.visibilityCard, visibility === 'private' && styles.visibilityCardActive]}
            onPress={() => setVisibility('private')}
          >
            <Ionicons name="lock-closed-outline" size={18} color={visibility === 'private' ? '#fff' : '#630E13'} />
            <View style={styles.visibilityCopy}>
              <Text style={[styles.visibilityTitle, visibility === 'private' && styles.visibilityTitleActive]}>Keep it private</Text>
              <Text style={[styles.visibilityText, visibility === 'private' && styles.visibilityTextActive]}>
                Save the completion and review without creating a public post.
              </Text>
            </View>
          </Pressable>
        </View>

        <Pressable style={[styles.submitButton, isSaving && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Save hike</Text>}
        </Pressable>
      </ScrollView>
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
