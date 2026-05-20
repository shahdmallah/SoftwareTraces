import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useLanguage } from '../contexts/LanguageContext';
import { getMyActivityJournal, type ActivityJournalEntry } from '../api/activitiesApi';
import { getJournalEntries, type JournalEntry as LocalJournalEntry } from '../data/localSocial';
import { RootStackParamList } from '../navigation/types';
import { ltrText, rtlText } from '../utils/direction';

type JournalNavigationProp = StackNavigationProp<RootStackParamList, 'Journal'>;
type JournalDisplayEntry = {
  id: string;
  createdAt: string;
  trail: string;
  note: string;
  date?: string | null;
  photoUris: string[];
};

function fromActivityJournalEntry(entry: ActivityJournalEntry): JournalDisplayEntry {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    trail: entry.trailName,
    note: entry.note,
    date: entry.completedAt,
    photoUris: entry.photoUris,
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
            <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'سجل ملاحظاتك عن الرحلات' : 'Your saved trail journal entries'}</Text>
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
});
