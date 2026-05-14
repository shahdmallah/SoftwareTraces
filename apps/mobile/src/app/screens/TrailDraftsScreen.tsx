import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { deleteTrail, getTrailById, publishTrail, updateTrail, uploadTrailPhoto, type Trail } from '../api/trailsApi';
import { getMyTrailDrafts } from '../api/trailDraftsApi';
import { useLanguage } from '../contexts/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';
import { trackOwnedTrail, untrackOwnedTrail, useOwnedTrails } from '../state/ownedTrails';

type TrailDraftsNavigationProp = StackNavigationProp<RootStackParamList, 'TrailDrafts'>;

export function TrailDraftsScreen() {
  const navigation = useNavigation<TrailDraftsNavigationProp>();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const isArabic = language === 'ar';
  const trackedDrafts = useOwnedTrails('draft');
  const trackedDraftIds = trackedDrafts.map((record) => record.trailId).join('|');
  const [drafts, setDrafts] = useState<Trail[]>([]);
  const [trackTrailId, setTrackTrailId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [busyTrailId, setBusyTrailId] = useState<string | null>(null);
  const [editingTrailId, setEditingTrailId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftPhotoUri, setDraftPhotoUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadDrafts = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const response = await getMyTrailDrafts({ limit: 100 });
        const serverDraftIds = new Set(response.items.map((trail) => trail.id));
        const localOnlyDrafts = await Promise.all(
          trackedDrafts
            .filter((record) => !serverDraftIds.has(record.trailId))
            .map((record) => getTrailById(record.trailId).catch(() => null)),
        );
        const nextDrafts = [...response.items, ...localOnlyDrafts.filter((trail): trail is Trail => Boolean(trail))];
        if (!cancelled) {
          setDrafts(nextDrafts);
        }
      } catch (error) {
        if (!cancelled) {
          setDrafts([]);
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load your draft trails.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadDrafts();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, trackedDraftIds]);

  const totals = useMemo(() => {
    return {
      distance: drafts.reduce((sum, trail) => sum + trail.distance, 0),
      ready: drafts.filter((trail) => trail.name && trail.description).length,
    };
  }, [drafts]);

  const handleTrackDraft = async () => {
    const id = trackTrailId.trim();
    if (!id) {
      setErrorMessage('Enter a draft trail ID.');
      return;
    }

    setBusyTrailId(id);
    setErrorMessage('');
    try {
      const trail = await getTrailById(id);
      trackOwnedTrail(id, 'draft');
      setDrafts((current) => [trail, ...current.filter((item) => item.id !== id)]);
      setTrackTrailId('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to find that trail.');
    } finally {
      setBusyTrailId(null);
    }
  };

  const handlePublish = async (trail: Trail) => {
    setBusyTrailId(trail.id);
    setErrorMessage('');
    try {
      await publishTrail(trail.id);
      untrackOwnedTrail(trail.id);
      trackOwnedTrail(trail.id, 'published');
      setDrafts((current) => current.filter((item) => item.id !== trail.id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to publish trail.');
    } finally {
      setBusyTrailId(null);
    }
  };

  const beginEdit = (trail: Trail) => {
    setEditingTrailId(trail.id);
    setDraftName(trail.name);
    setDraftDescription(trail.description);
    setDraftPhotoUri(null);
    setErrorMessage('');
  };

  const handlePickDraftPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Media library access is required to choose a trail photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets.length) {
        setDraftPhotoUri(result.assets[0].uri);
        setErrorMessage('');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to choose photo.');
    }
  };

  const handleSaveDraft = async (trail: Trail) => {
    const name = draftName.trim();
    const description = draftDescription.trim();

    if (!name) {
      setErrorMessage('Trail name is required.');
      return;
    }

    setBusyTrailId(trail.id);
    setErrorMessage('');
    try {
      await updateTrail(trail.id, { name, description });
      let nextImage = trail.image;
      if (draftPhotoUri) {
        const uploadResponse = await uploadTrailPhoto(trail.id, draftPhotoUri);
        nextImage = uploadResponse.data.url || nextImage;
      }
      setDrafts((current) => current.map((item) => (item.id === trail.id ? { ...item, name, description, image: nextImage } : item)));
      setEditingTrailId(null);
      setDraftPhotoUri(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update draft.');
    } finally {
      setBusyTrailId(null);
    }
  };

  const handleDelete = (trail: Trail) => {
    Alert.alert('Delete draft?', `${trail.name || 'This draft'} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyTrailId(trail.id);
          setErrorMessage('');
          try {
            await deleteTrail(trail.id);
            untrackOwnedTrail(trail.id);
            setDrafts((current) => current.filter((item) => item.id !== trail.id));
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Unable to delete draft.');
          } finally {
            setBusyTrailId(null);
          }
        },
      },
    ]);
  };

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 16, 32) }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{isArabic ? 'مسودات المسارات' : 'Trail Drafts'}</Text>
          </View>
          <Pressable style={styles.iconButton} onPress={() => setRefreshKey((value) => value + 1)}>
            <Ionicons name="refresh" size={18} color="#630E13" />
          </Pressable>
        </View>

        <View style={[styles.summaryRow, isArabic ? rtlRow : ltrRow]}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{drafts.length}</Text>
            <Text style={styles.summaryLabel}>Drafts</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totals.ready}</Text>
            <Text style={styles.summaryLabel}>Ready</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totals.distance.toFixed(1)} km</Text>
            <Text style={styles.summaryLabel}>Mapped</Text>
          </View>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {isLoading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color="#630E13" />
            <Text style={styles.stateText}>Loading drafts...</Text>
          </View>
        ) : drafts.length === 0 ? (
          <View style={styles.stateWrap}>
            <Ionicons name="create-outline" size={42} color="#A18F7A" />
            <Text style={styles.stateText}>No draft trails yet.</Text>
          </View>
        ) : (
          drafts.map((trail, index) => (
            <AnimatedBlock key={trail.id} delay={80 + index * 35}>
              <View style={styles.card}>
                <Image source={{ uri: trail.image }} style={styles.image} />
                <View style={styles.cardBody}>
                  <View style={[styles.cardHeader, isArabic ? rtlRow : ltrRow]}>
                    <View style={styles.cardTitleWrap}>
                      <Text style={[styles.trailName, isArabic ? rtlText : ltrText]}>{isArabic ? trail.nameAr || trail.name : trail.name}</Text>
                      <Text style={[styles.trailMeta, isArabic ? rtlText : ltrText]}>
                        {trail.distance.toFixed(1)} km | {trail.duration} | {trail.difficulty}
                      </Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>Draft</Text>
                    </View>
                  </View>
                  {editingTrailId === trail.id ? (
                    <View style={styles.editPanel}>
                      <TextInput value={draftName} onChangeText={setDraftName} placeholder="Trail name" placeholderTextColor="#A18F7A" style={styles.input} />
                      <TextInput
                        value={draftDescription}
                        onChangeText={setDraftDescription}
                        placeholder="Description"
                        placeholderTextColor="#A18F7A"
                        style={[styles.input, styles.textArea]}
                        multiline
                      />
                      <View style={styles.photoEditRow}>
                        <Image source={{ uri: draftPhotoUri ?? trail.image }} style={styles.photoEditPreview} />
                        <View style={styles.photoEditActions}>
                          <Pressable style={styles.secondaryButton} onPress={handlePickDraftPhoto} disabled={busyTrailId === trail.id}>
                            <Ionicons name="image-outline" size={15} color="#630E13" />
                            <Text style={styles.secondaryButtonText}>{draftPhotoUri ? 'Change photo' : 'Edit photo'}</Text>
                          </Pressable>
                          {draftPhotoUri ? (
                            <Pressable style={styles.secondaryButton} onPress={() => setDraftPhotoUri(null)} disabled={busyTrailId === trail.id}>
                              <Text style={styles.secondaryButtonText}>Remove change</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  ) : (
                    <Text numberOfLines={2} style={[styles.description, isArabic ? rtlText : ltrText]}>
                      {isArabic ? trail.descriptionAr || trail.description : trail.description || 'No description yet.'}
                    </Text>
                  )}
                  <View style={[styles.actionRow, isArabic ? rtlRow : ltrRow]}>
                    {editingTrailId === trail.id ? (
                      <>
                        <Pressable style={styles.primaryButtonSmall} onPress={() => handleSaveDraft(trail)} disabled={busyTrailId === trail.id}>
                          {busyTrailId === trail.id ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={15} color="#fff" />}
                          <Text style={styles.primaryButtonText}>Save</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryButton} onPress={() => setEditingTrailId(null)}>
                          <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Pressable style={styles.primaryButtonSmall} onPress={() => handlePublish(trail)} disabled={busyTrailId === trail.id}>
                          {busyTrailId === trail.id ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload-outline" size={15} color="#fff" />}
                          <Text style={styles.primaryButtonText}>Publish</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryButton} onPress={() => beginEdit(trail)}>
                          <Ionicons name="pencil-outline" size={15} color="#630E13" />
                          <Text style={styles.secondaryButtonText}>Edit</Text>
                        </Pressable>
                      </>
                    )}
                    <Pressable style={styles.dangerButton} onPress={() => handleDelete(trail)} disabled={busyTrailId === trail.id}>
                      <Ionicons name="trash-outline" size={15} color="#BB2823" />
                    </Pressable>
                  </View>
                </View>
              </View>
            </AnimatedBlock>
          ))
        )}
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED' },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 14 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF8F1', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: '#2C2418', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 4, color: '#6B5D4E', fontSize: 13, lineHeight: 18 },
  trackCard: { borderRadius: 20, padding: 14, backgroundColor: '#fff', marginBottom: 14 },
  trackTitle: { color: '#2C2418', fontSize: 14, fontWeight: '900', marginBottom: 10 },
  trackRow: { flexDirection: 'row', gap: 8 },
  trackInput: { flex: 1, minHeight: 44, borderRadius: 14, paddingHorizontal: 12, backgroundColor: '#F6F0E0', color: '#2C2418', fontSize: 13, fontWeight: '700' },
  trackButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#630E13' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 18, padding: 14, backgroundColor: '#fff' },
  summaryValue: { color: '#2C2418', fontSize: 17, fontWeight: '900' },
  summaryLabel: { marginTop: 4, color: '#8A7A6A', fontSize: 11, fontWeight: '700' },
  card: { overflow: 'hidden', borderRadius: 22, backgroundColor: '#fff', marginBottom: 16 },
  image: { width: '100%', height: 136, backgroundColor: '#D8CCB8' },
  cardBody: { padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitleWrap: { flex: 1 },
  trailName: { color: '#2C2418', fontSize: 17, fontWeight: '900' },
  trailMeta: { marginTop: 5, color: '#6B5D4E', fontSize: 12, fontWeight: '700' },
  description: { marginTop: 10, color: '#6B5D4E', fontSize: 13, lineHeight: 19 },
  editPanel: { gap: 10, marginTop: 12 },
  input: { minHeight: 44, borderRadius: 14, paddingHorizontal: 12, backgroundColor: '#F6F0E0', color: '#2C2418', fontSize: 13, fontWeight: '700' },
  textArea: { minHeight: 86, paddingTop: 12, textAlignVertical: 'top', fontWeight: '500' },
  photoEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photoEditPreview: { width: 86, height: 70, borderRadius: 14, backgroundColor: '#D8CCB8' },
  photoEditActions: { flex: 1, gap: 8 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFF3D8' },
  statusText: { color: '#8A5A00', fontSize: 11, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  primaryButtonSmall: { flex: 1.2, minHeight: 42, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#630E13' },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 42, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#F7EBE8' },
  secondaryButtonText: { color: '#630E13', fontSize: 13, fontWeight: '900' },
  dangerButton: { width: 46, minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1F0' },
  stateWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 42, gap: 14 },
  stateText: { color: '#6B5D4E', fontSize: 14, textAlign: 'center' },
  errorText: { color: '#8B1E1E', fontSize: 13, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
});
