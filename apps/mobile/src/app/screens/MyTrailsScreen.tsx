import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { deleteTrail, getTrailById, type Trail } from '../api/trailsApi';
import { getMyCreatedTrails } from '../api/ownedTrailsApi';
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
  const trackedTrails = useOwnedTrails('published');
  const trackedTrailIds = trackedTrails.map((record) => record.trailId).join('|');
  const [trails, setTrails] = useState<Trail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyTrailId, setBusyTrailId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadTrails = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const response = await getMyCreatedTrails({ limit: 100 });
        const serverTrailIds = new Set(response.items.map((trail) => trail.id));
        const localOnlyTrails = await Promise.all(
          trackedTrails
            .filter((record) => !serverTrailIds.has(record.trailId))
            .map((record) => getTrailById(record.trailId).catch(() => null)),
        );
        const nextTrails = [...response.items, ...localOnlyTrails.filter((trail): trail is Trail => Boolean(trail))];
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

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 16, 32) }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{isArabic ? 'مساراتي' : 'My Trails'}</Text>
            <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>
              {isArabic ? 'المسارات المنشورة التي أنشأتها.' : 'Published trails created by your account.'}
            </Text>
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
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>Live</Text>
                    </View>
                  </View>
                  <View style={[styles.actionRow, isArabic ? rtlRow : ltrRow]}>
                    <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('TrailDetail', { trailId: trail.id })}>
                      <Ionicons name="eye-outline" size={15} color="#630E13" />
                      <Text style={styles.secondaryButtonText}>View</Text>
                    </Pressable>
                    <Pressable style={styles.dangerButton} onPress={() => handleDelete(trail)} disabled={busyTrailId === trail.id}>
                      {busyTrailId === trail.id ? <ActivityIndicator color="#BB2823" /> : <Ionicons name="trash-outline" size={15} color="#BB2823" />}
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
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
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
