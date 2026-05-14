import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useLanguage } from '../contexts/LanguageContext';
import { getJournalEntries, type JournalEntry } from '../data/localSocial';
import { RootStackParamList } from '../navigation/types';
import { ltrText, rtlText } from '../utils/direction';

type JournalNavigationProp = StackNavigationProp<RootStackParamList, 'Journal'>;

export function JournalScreen() {
  const navigation = useNavigation<JournalNavigationProp>();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    setEntries(getJournalEntries());
  }, []);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries],
  );

  const entryGroups = useMemo(() => {
    return sortedEntries.reduce<Record<string, JournalEntry[]>>((groups, entry) => {
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

        {totalEntries ? (
          <>
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
  openHistoryButton: { marginTop: 24, borderRadius: 18, backgroundColor: '#630E13', paddingVertical: 14, alignItems: 'center' },
  openHistoryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
