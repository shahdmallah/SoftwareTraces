import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

const journalEntries = [
  { id: 'j1', title: 'Sunset Trail Notes', date: 'Apr 5, 2026', snippet: 'Captured the soft golden light over Wadi Qelt, and noted the quiet flow of the spring...' },
  { id: 'j2', title: 'Hike Reflection', date: 'Mar 28, 2026', snippet: 'The terraces at Battir felt like stepping into history. I want to return at olive harvest time.' },
];

const communityUpdates = [
  { id: 'c1', user: 'Leila', message: 'Just finished the Ramallah Ridge trail - stunning views and peaceful paths!', time: '2h ago' },
  { id: 'c2', user: 'Sami', message: 'Does anyone have tips for packing water for a Dead Sea Shore walk?', time: '5h ago' },
];

const pastHikes = [
  {
    id: 'h1',
    trailId: '1',
    name: 'Wadi Qelt Trail',
    date: 'Apr 5, 2026',
    distance: 14.2,
    duration: '5h 24m',
    elevationGain: 610,
    image: 'https://images.unsplash.com/photo-1679940640486-967ee217bf8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
  },
  {
    id: 'h2',
    trailId: '3',
    name: 'Battir Terraces',
    date: 'Mar 28, 2026',
    distance: 9.8,
    duration: '3h 52m',
    elevationGain: 318,
    image: 'https://images.unsplash.com/photo-1722228097356-bd0202d99367?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
  },
  {
    id: 'h3',
    trailId: '6',
    name: 'Ramallah Ridge',
    date: 'Mar 25, 2026',
    distance: 6.5,
    duration: '2h 18m',
    elevationGain: 185,
    image: 'https://images.unsplash.com/photo-1726091983472-a7da2540c492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
  },
];

type ActivityTab = 'history' | 'journal' | 'community';
type ActivityNavigationProp = StackNavigationProp<RootStackParamList, 'TrailDetail'>;

export function ActivityScreen() {
  const navigation = useNavigation<ActivityNavigationProp>();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const [activeTab, setActiveTab] = useState<ActivityTab>('history');

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(24, insets.bottom + 16) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedBlock delay={40}>
          <Text style={[styles.pageTitle, isArabic ? rtlText : ltrText]}>{t('tabActivity')}</Text>
          <Text style={[styles.pageSubtitle, isArabic ? rtlText : ltrText]}>{t('activitySubtitle')}</Text>
        </AnimatedBlock>

        <AnimatedBlock delay={80}>
          <View style={[styles.tabRow, isArabic ? rtlRow : ltrRow]}>
            {[
              { id: 'history' as const, label: t('activityHistory'), icon: 'time-outline' },
              { id: 'journal' as const, label: t('activityJournal'), icon: 'book-outline' },
              { id: 'community' as const, label: t('activityCommunity'), icon: 'people-outline' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Ionicons name={tab.icon as any} size={15} color={active ? '#fff' : '#6B5D4E'} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </AnimatedBlock>

        {activeTab === 'history' ? (
          <>
            <AnimatedBlock delay={120}>
              <View style={[styles.summaryRow, isArabic ? rtlRow : ltrRow]}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>30.5 km</Text>
                  <Text style={[styles.summaryLabel, isArabic ? rtlText : ltrText]}>{t('historyTotalDistance')}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>3</Text>
                  <Text style={[styles.summaryLabel, isArabic ? rtlText : ltrText]}>{t('historyTripsCount')}</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>11h 34m</Text>
                  <Text style={[styles.summaryLabel, isArabic ? rtlText : ltrText]}>{t('historyTotalTime')}</Text>
                </View>
              </View>
            </AnimatedBlock>

            {pastHikes.map((hike, index) => (
              <AnimatedBlock key={hike.id} delay={160 + index * 40}>
                <Pressable
                  style={[styles.historyCard, isArabic ? rtlRow : ltrRow]}
                  onPress={() => navigation.navigate('TrailDetail', { trailId: hike.trailId })}
                >
                  <Image source={{ uri: hike.image }} style={styles.historyImage} />
                  <View style={styles.historyContent}>
                    <Text style={[styles.historyDate, isArabic ? rtlText : ltrText]}>{hike.date}</Text>
                    <Text style={[styles.historyTitle, isArabic ? rtlText : ltrText]}>{hike.name}</Text>
                    <Text style={[styles.historyMeta, isArabic ? rtlText : ltrText]}>
                      {hike.distance} km | {hike.duration} | +{hike.elevationGain} m
                    </Text>
                  </View>
                  <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={18} color="#8A7A6A" />
                </Pressable>
              </AnimatedBlock>
            ))}
          </>
        ) : null}

        {activeTab === 'journal' ? (
          <>
            {journalEntries.map((entry, index) => (
              <AnimatedBlock key={entry.id} delay={120 + index * 40}>
                <Pressable style={styles.card}>
                  <View style={[styles.cardHeader, isArabic ? rtlRow : ltrRow]}>
                    <Ionicons name="book-outline" size={18} color="#630E13" />
                    <Text style={[styles.cardTitle, isArabic ? rtlText : ltrText]}>{entry.title}</Text>
                  </View>
                  <Text style={[styles.cardDate, isArabic ? rtlText : ltrText]}>{entry.date}</Text>
                  <Text style={[styles.cardSnippet, isArabic ? rtlText : ltrText]}>{entry.snippet}</Text>
                </Pressable>
              </AnimatedBlock>
            ))}

            <AnimatedBlock delay={220}>
              <Pressable style={styles.ctaButton}>
                <Text style={styles.ctaText}>{t('activityWriteEntry')}</Text>
              </Pressable>
            </AnimatedBlock>
          </>
        ) : null}

        {activeTab === 'community' ? (
          <>
            {communityUpdates.map((update, index) => (
              <AnimatedBlock key={update.id} delay={120 + index * 40}>
                <View style={styles.communityCard}>
                  <View style={[styles.communityHeader, isArabic ? rtlRow : ltrRow]}>
                    <Text style={[styles.communityUser, isArabic ? rtlText : ltrText]}>{update.user}</Text>
                    <Text style={styles.communityTime}>{update.time}</Text>
                  </View>
                  <Text style={[styles.communityText, isArabic ? rtlText : ltrText]}>{update.message}</Text>
                </View>
              </AnimatedBlock>
            ))}
          </>
        ) : null}
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAE2CC',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2C2418',
  },
  pageSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#7B6D5A',
    lineHeight: 20,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  tabButtonActive: {
    backgroundColor: '#630E13',
  },
  tabText: {
    color: '#6B5D4E',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#fff',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2C2418',
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#8A7A6A',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  historyImage: {
    width: 82,
    height: 82,
    borderRadius: 14,
  },
  historyContent: {
    flex: 1,
    paddingHorizontal: 12,
  },
  historyDate: {
    fontSize: 11,
    color: '#8A7A6A',
  },
  historyTitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '800',
    color: '#2C2418',
  },
  historyMeta: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B5D4E',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '800',
    color: '#2C2418',
  },
  cardDate: {
    fontSize: 12,
    color: '#8A7A6A',
    marginBottom: 8,
  },
  cardSnippet: {
    fontSize: 14,
    color: '#4A4131',
    lineHeight: 20,
  },
  communityCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  communityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  communityUser: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C2418',
  },
  communityTime: {
    fontSize: 11,
    color: '#8A7A6A',
  },
  communityText: {
    fontSize: 14,
    color: '#4A4131',
    lineHeight: 20,
  },
  ctaButton: {
    marginTop: 10,
    backgroundColor: '#630E13',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
});
