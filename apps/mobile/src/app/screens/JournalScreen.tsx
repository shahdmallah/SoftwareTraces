import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { CompletionHero, PhotoGalleryStrip, ReviewSummary, TrailStatsCard } from '../components/trailCompletion';
import { useLanguage } from '../contexts/LanguageContext';
import { getMyActivityJournal, shareActivityPost, type ActivityJournalEntry } from '../api/activitiesApi';
import { addLocalFeedItem, getJournalEntries, type JournalEntry as LocalJournalEntry } from '../data/localSocial';
import { RootStackParamList } from '../navigation/types';
import { formatCompletionDuration, formatDistanceKm, formatElevation } from '../features/trailCompletion/formatters';
import { ltrText, rtlText } from '../utils/direction';

type JournalNavigationProp = StackNavigationProp<RootStackParamList, 'Journal'>;
type JournalDisplayEntry = {
  id: string;
  activityId?: string;
  trailId?: string | null;
  createdAt: string;
  trail: string;
  note: string;
  date?: string | null;
  photoUris: string[];
  distanceKm?: number | null;
  elapsedTimeSeconds?: number | null;
  elevationGainM?: number | null;
  trailImage?: string | null;
};

function fromActivityJournalEntry(entry: ActivityJournalEntry): JournalDisplayEntry {
  return {
    id: entry.id,
    activityId: entry.activityId,
    trailId: entry.trailId,
    createdAt: entry.createdAt,
    trail: entry.trailName,
    note: entry.note,
    date: entry.completedAt,
    photoUris: entry.photoUris,
    distanceKm: entry.distanceKm,
    elapsedTimeSeconds: entry.elapsedTimeSeconds,
    elevationGainM: entry.elevationGainM,
  };
}

function fromLocalJournalEntry(entry: LocalJournalEntry): JournalDisplayEntry {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    trail: entry.trail,
    note: entry.note,
    date: entry.date,
    photoUris: entry.photoUris ?? [],
  };
}

export function JournalScreen() {
  const navigation = useNavigation<JournalNavigationProp>();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const [entries, setEntries] = useState<JournalDisplayEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalDisplayEntry | null>(null);
  const [editedNote, setEditedNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const apiEntries = await getMyActivityJournal({ limit: 100 });
      setEntries(apiEntries.map(fromActivityJournalEntry));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load journal.');
      setEntries(getJournalEntries().map(fromLocalJournalEntry));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries],
  );

  const entryGroups = useMemo(() => {
    return sortedEntries.reduce<Record<string, JournalDisplayEntry[]>>((groups, entry) => {
      const dateLabel = new Intl.DateTimeFormat(isArabic ? 'ar-SA' : 'en-US', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(entry.createdAt));
      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(entry);
      return groups;
    }, {});
  }, [sortedEntries, isArabic]);

  const groupKeys = useMemo(() => Object.keys(entryGroups), [entryGroups]);
  const totalEntries = entries.length;
  const latestEntry = sortedEntries[0];
  const lastDateLabel = latestEntry
    ? new Intl.DateTimeFormat(isArabic ? 'ar-SA' : 'en-US', { dateStyle: 'medium' }).format(new Date(latestEntry.createdAt))
    : '';

  const openEntry = (entry: JournalDisplayEntry) => {
    setSelectedEntry(entry);
    setEditedNote(entry.note);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (!selectedEntry) return;
    const nextNote = editedNote.trim() || selectedEntry.note;
    const nextEntry = { ...selectedEntry, note: nextNote };
    setSelectedEntry(nextEntry);
    setEntries((current) => current.map((entry) => (entry.id === selectedEntry.id ? nextEntry : entry)));
    setIsEditing(false);
  };

  const handleMakePublic = async () => {
    if (!selectedEntry || isPublishing) return;
    const caption = editedNote.trim() || selectedEntry.note;
    setIsPublishing(true);
    try {
      if (selectedEntry.activityId) {
        await shareActivityPost(selectedEntry.activityId, { visibility: 'public', caption });
      }

      addLocalFeedItem({
        id: `journal-public-${selectedEntry.id}-${Date.now()}`,
        kind: 'recap',
        activityId: selectedEntry.activityId,
        trailId: selectedEntry.trailId || '0',
        user: 'You',
        handle: '@you',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=faces&fit=crop&w=240&h=240',
        image: selectedEntry.photoUris[0] ?? selectedEntry.trailImage ?? '',
        trailNameEn: selectedEntry.trail,
        trailNameAr: selectedEntry.trail,
        regionEn: selectedEntry.activityId ? 'Activity · public' : 'Local journal post',
        regionAr: selectedEntry.activityId ? 'نشاط · public' : 'منشور يوميات محلي',
        captionEn: caption,
        captionAr: caption,
        timeEn: 'Just now',
        timeAr: 'الآن',
        likes: 1,
        comments: 0,
        distance: selectedEntry.distanceKm != null ? `${selectedEntry.distanceKm.toFixed(1)} km` : 'Journal',
      });

      Alert.alert(
        isArabic ? 'تم النشر' : 'Made public',
        selectedEntry.activityId
          ? (isArabic ? 'تم نشر هذا الملخص في النشاط.' : 'This recap is now shared to Activity.')
          : (isArabic ? 'تمت إضافته محلياً للنشاط.' : 'This local entry was added to Activity on this device.'),
        [{ text: isArabic ? 'افتح النشاط' : 'Open Activity', onPress: () => navigation.navigate('AppTabs', { screen: 'Activity' }) }],
      );
    } catch (error) {
      Alert.alert(
        isArabic ? 'تعذر النشر' : 'Unable to publish',
        error instanceof Error ? error.message : isArabic ? 'حاول مرة أخرى.' : 'Please try again.',
      );
    } finally {
      setIsPublishing(false);
    }
  };

  if (selectedEntry) {
    const completedDateLabel = new Intl.DateTimeFormat(isArabic ? 'ar-SA' : 'en-US', { dateStyle: 'medium' }).format(
      new Date(selectedEntry.date ?? selectedEntry.createdAt),
    );
    const stats = [
      {
        icon: 'time-outline' as const,
        label: isArabic ? 'المدة' : 'Duration',
        value: selectedEntry.elapsedTimeSeconds != null
          ? formatCompletionDuration(selectedEntry.elapsedTimeSeconds * 1000, isArabic)
          : isArabic ? 'غير متوفر' : 'Not tracked',
      },
      {
        icon: 'navigate-outline' as const,
        label: isArabic ? 'المسافة' : 'Distance',
        value: formatDistanceKm(selectedEntry.distanceKm ?? 0, isArabic),
      },
      {
        icon: 'trending-up-outline' as const,
        label: isArabic ? 'الصعود' : 'Elevation gain',
        value: formatElevation(selectedEntry.elevationGainM ?? 0, isArabic),
      },
      {
        icon: 'images-outline' as const,
        label: isArabic ? 'الصور' : 'Photos',
        value: String(selectedEntry.photoUris.length),
      },
    ];

    return (
      <AnimatedScreen style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 28, 32) }} showsVerticalScrollIndicator={false}>
          <CompletionHero
            heroUri={selectedEntry.photoUris[0] ?? ''}
            fallbackUri={selectedEntry.trailImage ?? undefined}
            trailName={selectedEntry.trail}
            region={selectedEntry.activityId ? (isArabic ? 'من اليوميات الخاصة' : 'Private journal') : (isArabic ? 'محفوظ محلياً' : 'Saved locally')}
            completedDateLabel={completedDateLabel}
            statusLabel={isArabic ? 'ملخص محفوظ' : 'Saved recap'}
            isArabic={isArabic}
            onBack={() => setSelectedEntry(null)}
          />

          <TrailStatsCard stats={stats} isArabic={isArabic} />

          <ReviewSummary rating={0} reviewText={selectedEntry.note} isArabic={isArabic} />

          <PhotoGalleryStrip photoUris={selectedEntry.photoUris} isArabic={isArabic} />

          <View style={styles.recapActions}>
            <Text style={[styles.recapActionsTitle, isArabic ? rtlText : ltrText]}>
              {isArabic ? 'خيارات الملخص' : 'Recap options'}
            </Text>
            {isEditing ? (
              <>
                <TextInput
                  value={editedNote}
                  onChangeText={setEditedNote}
                  multiline
                  placeholder={isArabic ? 'عدّل النص...' : 'Edit caption...'}
                  placeholderTextColor="#A18F7A"
                  style={[styles.editInput, isArabic ? rtlText : ltrText]}
                />
                <View style={styles.actionRow}>
                  <Pressable style={styles.secondaryActionButton} onPress={() => { setEditedNote(selectedEntry.note); setIsEditing(false); }}>
                    <Text style={styles.secondaryActionText}>{isArabic ? 'إلغاء' : 'Cancel'}</Text>
                  </Pressable>
                  <Pressable style={styles.primaryActionButton} onPress={handleSaveEdit}>
                    <Text style={styles.primaryActionText}>{isArabic ? 'حفظ' : 'Save edit'}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.actionRow}>
                <Pressable style={styles.secondaryActionButton} onPress={() => setIsEditing(true)}>
                  <Ionicons name="create-outline" size={17} color="#630E13" />
                  <Text style={styles.secondaryActionText}>{isArabic ? 'تعديل النص' : 'Edit caption'}</Text>
                </Pressable>
                <Pressable style={[styles.primaryActionButton, isPublishing && styles.actionDisabled]} onPress={handleMakePublic} disabled={isPublishing}>
                  {isPublishing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="globe-outline" size={17} color="#fff" />}
                  <Text style={styles.primaryActionText}>{isArabic ? 'اجعله عاماً' : 'Make public'}</Text>
                </Pressable>
              </View>
            )}
            <Text style={[styles.backendHint, isArabic ? rtlText : ltrText]}>
              {selectedEntry.activityId
                ? (isArabic ? 'يدعم الخادم نشر نسخة عامة من هذا الملخص.' : 'Backend support: publish this recap as a new public Activity post.')
                : (isArabic ? 'هذا المدخل محلي فقط، لذلك سيتم نشره محلياً على هذا الجهاز.' : 'This entry is local-only, so publishing is local on this device.')}
            </Text>
          </View>
        </ScrollView>
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 28, 32) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 16, 32) }]}> 
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={22} color="#2C2418" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{t('activityJournal')}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color="#630E13" />
            <Text style={[styles.loadingText, isArabic ? rtlText : ltrText]}>{isArabic ? 'ط¬ط§ط±ظٹ طھط­ظ…ظٹظ„ ط§ظ„ظٹظˆظ…ظٹط§طھ' : 'Loading journal'}</Text>
          </View>
        ) : totalEntries ? (
          <>
            {errorMessage ? (
              <Pressable style={styles.errorBanner} onPress={loadEntries}>
                <Ionicons name="cloud-offline-outline" size={18} color="#630E13" />
                <Text style={[styles.errorText, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'ظٹطھظ… ط¹ط±ط¶ ط§ظ„ظ…ط¯ط®ظ„ط§طھ ط§ظ„ظ…ط­ظپظˆط¸ط© ظ…ط­ظ„ظٹط§ظ‹. ط§ط¶ط؛ط· ظ„ط¥ط¹ط§ط¯ط© ط§ظ„ظ…ط­ط§ظˆظ„ط©.' : 'Showing saved local entries. Tap to retry API journal.'}
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.journalSummary}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{totalEntries}</Text>
                <Text style={styles.summaryLabel}>{isArabic ? 'مدخلات اليوميات' : 'Journal entries'}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{lastDateLabel}</Text>
                <Text style={styles.summaryLabel}>{isArabic ? 'آخر تحديث' : 'Last updated'}</Text>
              </View>
            </View>

            {groupKeys.map((group) => (
              <View key={group} style={styles.groupSection}>
                <Text style={[styles.groupTitle, isArabic ? rtlText : ltrText]}>{group}</Text>
                {entryGroups[group].map((item) => (
                  <AnimatedBlock key={item.id} delay={40} style={styles.entryCard}>
                    <Pressable onPress={() => openEntry(item)}>
                    {item.photoUris?.[0] ? (
                      <Image source={{ uri: item.photoUris[0] }} style={styles.entryImage} resizeMode="cover" />
                    ) : null}
                    <View style={styles.entryHeader}>
                      <Text style={[styles.entryTrail, isArabic ? rtlText : ltrText]}>{item.trail}</Text>
                      <Text style={[styles.entryDate, isArabic ? rtlText : ltrText]}>{new Date(item.createdAt).toLocaleDateString(isArabic ? 'ar' : 'en-US')}</Text>
                    </View>
                    <Text style={[styles.entryNote, isArabic ? rtlText : ltrText]}>{item.note}</Text>
                    {item.photoUris && item.photoUris.length > 1 ? (
                      <Text style={[styles.entryMeta, isArabic ? rtlText : ltrText]}>
                        {isArabic ? `${item.photoUris.length} صور محفوظة` : `${item.photoUris.length} saved photos`}
                      </Text>
                    ) : null}
                    {item.date ? (
                      <Text style={[styles.entryMeta, isArabic ? rtlText : ltrText]}>{isArabic ? 'تاريخ الرحلة: ' : 'Trail date: '}{item.date}</Text>
                    ) : null}
                    <View style={styles.openRecapRow}>
                      <Text style={styles.openRecapText}>{isArabic ? 'افتح الملخص' : 'Open recap'}</Text>
                      <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={16} color="#630E13" />
                    </View>
                    </Pressable>
                  </AnimatedBlock>
                ))}
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color="#8A7A6A" />
            <Text style={[styles.emptyTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'اليوميات فارغة' : 'No journal entries yet'}</Text>
            <Text style={[styles.emptyText, isArabic ? rtlText : ltrText]}>
              {isArabic
                ? 'اضغط على حفظ في اليوميات بعد الانتهاء من رحلة لحفظ لحظاتك هنا.'
                : 'Save a hike to your journal after completing it to see your notes here.'}
            </Text>
            {errorMessage ? (
              <Pressable style={styles.retryButton} onPress={loadEntries}>
                <Text style={styles.openHistoryText}>{isArabic ? 'ط¥ط¹ط§ط¯ط© ط§ظ„ظ…ط­ط§ظˆظ„ط©' : 'Retry'}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.openHistoryButton} onPress={() => navigation.navigate('History')}>
              <Text style={styles.openHistoryText}>{isArabic ? 'افتح السجل' : 'Open History'}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  header: { paddingHorizontal: 16, marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: '900', color: '#2C2418' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#7B6D5A' },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  loadingState: { alignItems: 'center', justifyContent: 'center', marginTop: 48, gap: 10 },
  loadingText: { color: '#6B5D4E', fontSize: 14, fontWeight: '700' },
  errorBanner: { marginHorizontal: 16, marginBottom: 14, borderRadius: 18, padding: 14, backgroundColor: '#FFF4EF', borderWidth: 1, borderColor: '#F1D4CB', flexDirection: 'row', alignItems: 'center', gap: 10 },
  errorText: { flex: 1, color: '#630E13', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 36, gap: 10 },
  emptyTitle: { marginTop: 14, fontSize: 20, fontWeight: '800', color: '#2C2418' },
  emptyText: { marginTop: 6, fontSize: 14, color: '#6B5D4E', textAlign: 'center', lineHeight: 20 },
  journalSummary: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 20 },
  summaryCard: { flex: 1, borderRadius: 22, backgroundColor: '#FFFFFF', padding: 16, borderWidth: 1, borderColor: '#EEE5DA' },
  summaryValue: { fontSize: 20, fontWeight: '900', color: '#2C2418' },
  summaryLabel: { marginTop: 6, fontSize: 12, color: '#7B6D5A' },
  groupSection: { marginBottom: 18 },
  groupTitle: { marginHorizontal: 16, marginBottom: 10, fontSize: 16, fontWeight: '900', color: '#2C2418' },
  entryCard: { marginBottom: 14, marginHorizontal: 16, borderRadius: 24, padding: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEE5DA' },
  entryImage: { height: 180, borderRadius: 18, marginBottom: 14, backgroundColor: '#E7D8C3' },
  entryHeader: { marginBottom: 10 },
  entryTrail: { fontSize: 16, fontWeight: '900', color: '#2C2418' },
  entryDate: { marginTop: 4, fontSize: 12, color: '#8A7A6A' },
  entryNote: { fontSize: 14, color: '#4A422F', lineHeight: 20 },
  entryMeta: { marginTop: 10, fontSize: 12, color: '#8A7A6A' },
  retryButton: { marginTop: 16, borderRadius: 18, backgroundColor: '#8A3A2A', paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  openHistoryButton: { marginTop: 24, borderRadius: 18, backgroundColor: '#630E13', paddingVertical: 14, alignItems: 'center' },
  openHistoryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  openRecapRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F0E5D8', paddingTop: 12 },
  openRecapText: { color: '#630E13', fontSize: 13, fontWeight: '900' },
  recapActions: { marginHorizontal: 16, marginTop: 24, borderRadius: 24, padding: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEE5DA' },
  recapActionsTitle: { fontSize: 16, fontWeight: '900', color: '#2C2418', marginBottom: 12 },
  editInput: { minHeight: 110, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFF8F1', color: '#2C2418', fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  primaryActionButton: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: '#630E13', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  secondaryActionButton: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: '#F7EBE8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryActionText: { color: '#630E13', fontSize: 13, fontWeight: '900' },
  actionDisabled: { opacity: 0.65 },
  backendHint: { marginTop: 12, color: '#7B6D5A', fontSize: 12, lineHeight: 18, fontWeight: '700' },
});
