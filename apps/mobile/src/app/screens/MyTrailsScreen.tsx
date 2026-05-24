import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { deleteTrail, getTrailById, updateTrail, uploadTrailPhoto, type Trail } from '../api/trailsApi';
import { getMyCreatedTrails } from '../api/ownedTrailsApi';
import { getMyTrailDrafts } from '../api/trailDraftsApi';
import { useLanguage } from '../contexts/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';
import { untrackOwnedTrail, useOwnedTrails } from '../state/ownedTrails';

type MyTrailsNavigationProp = StackNavigationProp<RootStackParamList, 'MyTrails'>;

export function MyTrailsScreen() {
  const navigation = useNavigation<MyTrailsNavigationProp>();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const isArabic = language === 'ar';
  const trackedTrails = useOwnedTrails();
  const trackedTrailIds = trackedTrails.map((record) => `${record.trailId}:${record.status}`).join('|');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyTrailId, setBusyTrailId] = useState<string | null>(null);
  const [editingTrailId, setEditingTrailId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadTrails = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const [response, draftResponse] = await Promise.all([
          getMyCreatedTrails({ limit: 100 }).catch(() => ({ items: [] as Trail[] })),
          getMyTrailDrafts({ limit: 100 }).catch(() => ({ items: [] as Trail[] })),
        ]);
        const draftIds = new Set(draftResponse.items.map((trail) => trail.id));
        const ownerTrails = response.items.filter((trail) => trail.status?.toLowerCase() !== 'draft' && !draftIds.has(trail.id));
        const serverTrailIds = new Set(ownerTrails.map((trail) => trail.id));
        const localOnlyTrails = await Promise.all(
          trackedTrails
            .filter((record) => record.status !== 'draft')
            .filter((record) => !serverTrailIds.has(record.trailId))
            .map((record) => getTrailById(record.trailId).catch(() => null)),
        );
        const nextTrails = [...ownerTrails, ...localOnlyTrails.filter((trail): trail is Trail => Boolean(trail))];
        if (!cancelled) {
          setTrails(nextTrails);
        }
      } catch (error) {
        if (!cancelled) {
          setTrails([]);
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load your created trails.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTrails();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, trackedTrailIds]);

  const totals = useMemo(() => {
    return {
      distance: trails.reduce((sum, trail) => sum + trail.distance, 0),
      reviews: trails.reduce((sum, trail) => sum + trail.reviews, 0),
    };
  }, [trails]);

  const handleDelete = (trail: Trail) => {
    Alert.alert('Delete trail?', `${trail.name} will be removed from Traces.`, [
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
            setTrails((current) => current.filter((item) => item.id !== trail.id));
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Unable to delete trail.');
          } finally {
            setBusyTrailId(null);
          }
        },
      },
    ]);
  };

  const beginEdit = (trail: Trail) => {
    setEditingTrailId(trail.id);
    setEditName(trail.name);
    setEditDescription(trail.description);
    setEditRegion(trail.region);
    setEditPhotoUri(null);
    setErrorMessage('');
  };

  const cancelEdit = () => {
    setEditingTrailId(null);
    setEditName('');
    setEditDescription('');
    setEditRegion('');
    setEditPhotoUri(null);
  };

  const handlePickEditPhoto = async () => {
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
        setEditPhotoUri(result.assets[0].uri);
        setErrorMessage('');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to choose photo.');
    }
  };

  const handleSaveEdit = async (trail: Trail) => {
    const name = editName.trim();
    const description = editDescription.trim();
    const region = editRegion.trim();

    if (!name) {
      setErrorMessage('Trail name is required.');
      return;
    }

    setBusyTrailId(trail.id);
    setErrorMessage('');
    try {
      await updateTrail(trail.id, { name, description, region });
      let nextImage = trail.image;
      if (editPhotoUri) {
        const uploadResponse = await uploadTrailPhoto(trail.id, editPhotoUri);
        nextImage = uploadResponse.data.url || nextImage;
      }
      setTrails((current) =>
        current.map((item) =>
          item.id === trail.id
            ? { ...item, name, description, region, image: nextImage }
            : item,
        ),
      );
      cancelEdit();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update trail.');
    } finally {
      setBusyTrailId(null);
    }
  };

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 16, 32) }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{isArabic ? 'مساراتي' : 'My Trails'}</Text>
          </View>
          <Pressable style={styles.iconButton} onPress={() => setRefreshKey((value) => value + 1)}>
            <Ionicons name="refresh" size={18} color="#630E13" />
          </Pressable>
        </View>

        <View style={[styles.summaryRow, isArabic ? rtlRow : ltrRow]}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{trails.length}</Text>
            <Text style={styles.summaryLabel}>Created</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totals.distance.toFixed(1)} km</Text>
            <Text style={styles.summaryLabel}>Distance</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totals.reviews}</Text>
            <Text style={styles.summaryLabel}>Reviews</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color="#630E13" />
            <Text style={styles.stateText}>Loading your trails...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateWrap}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable style={styles.primaryButton} onPress={() => setRefreshKey((value) => value + 1)}>
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : trails.length === 0 ? (
          <View style={styles.stateWrap}>
            <Ionicons name="trail-sign-outline" size={42} color="#A18F7A" />
            <Text style={styles.stateText}>No created trails yet.</Text>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('CreateTrail')}>
              <Text style={styles.primaryButtonText}>Create trail</Text>
            </Pressable>
          </View>
        ) : (
          trails.map((trail, index) => (
            <AnimatedBlock key={trail.id} delay={80 + index * 35}>
              <View style={styles.card}>
                <Pressable onPress={() => navigation.navigate('TrailDetail', { trailId: trail.id })}>
                  <Image source={{ uri: trail.image }} style={styles.image} />
                </Pressable>
                <View style={styles.cardBody}>
                  <View style={[styles.cardHeader, isArabic ? rtlRow : ltrRow]}>
                    <View style={styles.cardTitleWrap}>
                      <Text style={[styles.trailName, isArabic ? rtlText : ltrText]}>{isArabic ? trail.nameAr || trail.name : trail.name}</Text>
                      <Text style={[styles.trailMeta, isArabic ? rtlText : ltrText]}>
                        {trail.distance.toFixed(1)} km | {trail.duration} | {trail.difficulty}
                      </Text>
                      <Text style={[styles.trailSubMeta, isArabic ? rtlText : ltrText]}>Created by your account</Text>
                    </View>
                    <View style={[styles.statusPill, (trail.status?.toLowerCase() === 'private' || trail.isPublic === false) && styles.privateStatusPill]}>
                      <Text style={[styles.statusText, (trail.status?.toLowerCase() === 'private' || trail.isPublic === false) && styles.privateStatusText]}>
                        {trail.status?.toLowerCase() === 'private' || trail.isPublic === false ? 'Private' : 'Public'}
                      </Text>
                    </View>
                  </View>
                  {editingTrailId === trail.id ? (
                    <View style={styles.editPanel}>
                      <TextInput value={editName} onChangeText={setEditName} placeholder="Trail name" placeholderTextColor="#A18F7A" style={styles.input} />
                      <TextInput value={editRegion} onChangeText={setEditRegion} placeholder="Region" placeholderTextColor="#A18F7A" style={styles.input} />
                      <TextInput
                        value={editDescription}
                        onChangeText={setEditDescription}
                        placeholder="Description"
                        placeholderTextColor="#A18F7A"
                        style={[styles.input, styles.textArea]}
                        multiline
                      />
                      <View style={styles.photoEditRow}>
                        <Image source={{ uri: editPhotoUri ?? trail.image }} style={styles.photoEditPreview} />
                        <View style={styles.photoEditActions}>
                          <Pressable style={styles.secondaryButton} onPress={handlePickEditPhoto} disabled={busyTrailId === trail.id}>
                            <Ionicons name="image-outline" size={15} color="#630E13" />
                            <Text style={styles.secondaryButtonText}>{editPhotoUri ? 'Change photo' : 'Edit photo'}</Text>
                          </Pressable>
                          {editPhotoUri ? (
                            <Pressable style={styles.secondaryButton} onPress={() => setEditPhotoUri(null)} disabled={busyTrailId === trail.id}>
                              <Text style={styles.secondaryButtonText}>Remove change</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  ) : null}
                  <View style={[styles.actionRow, isArabic ? rtlRow : ltrRow]}>
                    {editingTrailId === trail.id ? (
                      <>
                        <Pressable style={styles.primaryButtonSmall} onPress={() => handleSaveEdit(trail)} disabled={busyTrailId === trail.id}>
                          {busyTrailId === trail.id ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={15} color="#fff" />}
                          <Text style={styles.primaryButtonText}>Save</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryButton} onPress={cancelEdit} disabled={busyTrailId === trail.id}>
                          <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('TrailDetail', { trailId: trail.id })}>
                          <Ionicons name="eye-outline" size={15} color="#630E13" />
                          <Text style={styles.secondaryButtonText}>View</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryButton} onPress={() => beginEdit(trail)}>
                          <Ionicons name="pencil-outline" size={15} color="#630E13" />
                          <Text style={styles.secondaryButtonText}>Edit</Text>
                        </Pressable>
                      </>
                    )}
                    <Pressable style={styles.dangerButton} onPress={() => handleDelete(trail)} disabled={busyTrailId === trail.id}>
                      {busyTrailId === trail.id && editingTrailId !== trail.id ? <ActivityIndicator color="#BB2823" /> : <Ionicons name="trash-outline" size={15} color="#BB2823" />}
                      <Text style={styles.dangerButtonText}>Delete</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF8F1', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: '#2C2418', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 4, color: '#6B5D4E', fontSize: 13, lineHeight: 18 },
  hiddenSubtitle: { display: 'none' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 18, padding: 14, backgroundColor: '#fff' },
  summaryValue: { color: '#2C2418', fontSize: 17, fontWeight: '900' },
  summaryLabel: { marginTop: 4, color: '#8A7A6A', fontSize: 11, fontWeight: '700' },
  card: { overflow: 'hidden', borderRadius: 22, backgroundColor: '#fff', marginBottom: 16 },
  image: { width: '100%', height: 150, backgroundColor: '#D8CCB8' },
  cardBody: { padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitleWrap: { flex: 1 },
  trailName: { color: '#2C2418', fontSize: 17, fontWeight: '900' },
  trailMeta: { marginTop: 5, color: '#6B5D4E', fontSize: 12, fontWeight: '700' },
  trailSubMeta: { marginTop: 4, color: '#8A7A6A', fontSize: 11 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#E7F3E9' },
  statusText: { color: '#1E7A46', fontSize: 11, fontWeight: '900' },
  privateStatusPill: { backgroundColor: '#F1E7F3' },
  privateStatusText: { color: '#6F367A' },
  editPanel: { gap: 10, marginTop: 12 },
  input: { minHeight: 44, borderRadius: 14, paddingHorizontal: 12, backgroundColor: '#F6F0E0', color: '#2C2418', fontSize: 13, fontWeight: '700' },
  textArea: { minHeight: 86, paddingTop: 12, textAlignVertical: 'top', fontWeight: '500' },
  photoEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photoEditPreview: { width: 86, height: 70, borderRadius: 14, backgroundColor: '#D8CCB8' },
  photoEditActions: { flex: 1, gap: 8 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primaryButtonSmall: { flex: 1, minHeight: 42, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#630E13' },
  secondaryButton: { flex: 1, minHeight: 42, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#F7EBE8' },
  secondaryButtonText: { color: '#630E13', fontSize: 13, fontWeight: '900' },
  dangerButton: { flex: 1, minHeight: 42, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#FFF1F0' },
  dangerButtonText: { color: '#BB2823', fontSize: 13, fontWeight: '900' },
  primaryButton: { minWidth: 180, minHeight: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#630E13', alignSelf: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  stateWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 42, gap: 14 },
  stateText: { color: '#6B5D4E', fontSize: 14, textAlign: 'center' },
  errorText: { color: '#8B1E1E', fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
