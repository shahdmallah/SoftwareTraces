import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';

const pastHikes = [
  {
    id: 'h1',
    trailId: '1',
    nameAr: 'مسار وادي القلط',
    name: 'Wadi Qelt Trail',
    dateAr: 'السبت، ٥ أبريل ٢٠٢٦',
    distance: 14.2,
    duration: '5h 24m',
    elevationGain: 610,
    image: 'https://images.unsplash.com/photo-1679940640486-967ee217bf8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    rating: 5,
  },
  {
    id: 'h2',
    trailId: '3',
    nameAr: 'مدرجات بتير',
    name: 'Battir Terraces',
    dateAr: 'السبت، ٢٨ مارس ٢٠٢٦',
    distance: 9.8,
    duration: '3h 52m',
    elevationGain: 318,
    image: 'https://images.unsplash.com/photo-1722228097356-bd0202d99367?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    rating: 5,
  },
  {
    id: 'h3',
    trailId: '6',
    nameAr: 'نجف رام الله',
    name: 'Ramallah Ridge',
    dateAr: 'السبت، ٢١ مارس ٢٠٢٦',
    distance: 6.5,
    duration: '2h 18m',
    elevationGain: 185,
    image: 'https://images.unsplash.com/photo-1726091983472-a7da2540c492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    rating: 4,
  },
  {
    id: 'h4',
    trailId: '5',
    nameAr: 'شاطئ البحر الميت',
    name: 'Dead Sea Shore',
    dateAr: 'السبت، ١٤ مارس ٢٠٢٦',
    distance: 5.5,
    duration: '1h 58m',
    elevationGain: 10,
    image: 'https://images.unsplash.com/photo-1715273504630-7c42124bc0ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    rating: 5,
  },
];

const calendarDays = [
  { d: 1, hasHike: false }, { d: 2, hasHike: false }, { d: 3, hasHike: false },
  { d: 4, hasHike: false }, { d: 5, hasHike: true }, { d: 6, hasHike: false },
  { d: 7, hasHike: false }, { d: 8, hasHike: false }, { d: 9, hasHike: false },
  { d: 10, hasHike: false }, { d: 11, hasHike: false }, { d: 12, hasHike: false },
  { d: 13, hasHike: false }, { d: 14, hasHike: false }, { d: 15, hasHike: false },
  { d: 16, hasHike: false }, { d: 17, hasHike: false }, { d: 18, hasHike: false },
  { d: 19, hasHike: false }, { d: 20, hasHike: false }, { d: 21, hasHike: false },
  { d: 22, hasHike: false }, { d: 23, hasHike: false }, { d: 24, hasHike: false },
  { d: 25, hasHike: false }, { d: 26, hasHike: false }, { d: 27, hasHike: false },
  { d: 28, hasHike: true }, { d: 29, hasHike: false }, { d: 30, hasHike: false },
];

const dayNamesAr = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];
const dayNamesEn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type HistoryNavigationProp = StackNavigationProp<RootStackParamList, 'TrailDetail'>;

export function HistoryScreen() {
  const navigation = useNavigation<HistoryNavigationProp>();
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const totalDistance = pastHikes.reduce((sum, hike) => sum + hike.distance, 0);
  const totalDuration = '13h 32m';
  const totalHikes = pastHikes.length;

  return (
    <AnimatedScreen style={styles.container}>
      <AnimatedBlock delay={40} style={[styles.header, { paddingTop: Math.max(12, insets.top + 8) }]}>
        <View>
          <Text style={styles.title}>{t('historyTitle')}</Text>
          <Text style={styles.subtitle}>{t('historySubtitle')}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Ionicons name="navigate-outline" size={18} color="#B8CB8A" />
            <Text style={styles.statValue}>{totalDistance.toFixed(1)}km</Text>
            <Text style={styles.statLabel}>{t('historyTotalDistance')}</Text>
          </View>
          <View style={styles.statTile}>
            <Ionicons name="trophy-outline" size={18} color="#D4A843" />
            <Text style={styles.statValue}>{totalHikes}</Text>
            <Text style={styles.statLabel}>{t('historyTripsCount')}</Text>
          </View>
          <View style={styles.statTile}>
            <Ionicons name="time-outline" size={18} color="#80DEEA" />
            <Text style={styles.statValue}>{totalDuration}</Text>
            <Text style={styles.statLabel}>{t('historyTotalTime')}</Text>
          </View>
        </View>
      </AnimatedBlock>

      <AnimatedBlock delay={120} style={styles.tabBar}>
        <Pressable
          style={[styles.tabButton, activeTab === 'list' && styles.tabButtonActive]}
          onPress={() => setActiveTab('list')}
        >
          <Ionicons name="bar-chart-outline" size={14} color={activeTab === 'list' ? 'white' : '#6B5D4E'} style={styles.tabIcon} />
          <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>{t('historyTabList')}</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'calendar' && styles.tabButtonActive]}
          onPress={() => setActiveTab('calendar')}
        >
          <Ionicons name="calendar-outline" size={14} color={activeTab === 'calendar' ? 'white' : '#6B5D4E'} style={styles.tabIcon} />
          <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>{t('historyTabCalendar')}</Text>
        </Pressable>
      </AnimatedBlock>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'list' ? (
          pastHikes.map((hike, index) => (
            <AnimatedBlock key={hike.id} delay={160 + index * 40}>
            <Pressable
              style={styles.hikeCard}
              onPress={() => navigation.navigate('TrailDetail', { trailId: hike.trailId })}
            >
              <View style={styles.timelineMarker}>
                <View style={styles.timelineDot} />
                {index < pastHikes.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.hikeContent}>
                <Image source={{ uri: hike.image }} style={styles.hikeImage} />
                <View style={styles.hikeInfo}>
                  <Text style={styles.hikeDate}>{hike.dateAr}</Text>
                  <Text style={styles.hikeName}>{hike.nameAr}</Text>
                  <View style={styles.hikeMetaRow}>
                    <Text style={styles.hikeMetaText}>{hike.distance}km</Text>
                    <Text style={styles.hikeMetaText}>• {hike.duration}</Text>
                    <Text style={styles.hikeMetaText}>• ↑{hike.elevationGain}m</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#8A7A6A" />
              </View>
            </Pressable>
            </AnimatedBlock>
          ))
        ) : (
          <AnimatedBlock delay={180}>
          <View style={styles.calendarCard}>
            <Text style={styles.calendarTitle}>
              {isArabic ? `${t('historyMonthTitle')} — ${t('historyMonthTitleEnOnly')}` : t('historyMonthTitle')}
            </Text>
            <View style={styles.weekHeader}>
              {(isArabic ? dayNamesAr : dayNamesEn).map((day) => (
                <Text key={day} style={styles.weekDayText}>{day}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {[...Array(2)].map((_, idx) => (
                <View key={`empty-${idx}`} style={styles.calendarCellEmpty} />
              ))}
              {calendarDays.map((day) => (
                <View
                  key={day.d}
                  style={[
                    styles.calendarCell,
                    day.hasHike && styles.calendarCellActive,
                  ]}
                >
                  <Text style={[styles.calendarCellText, day.hasHike && styles.calendarCellTextActive]}>{day.d}</Text>
                  {day.hasHike && <View style={styles.calendarDot} />}
                </View>
              ))}
            </View>
            <View style={styles.monthSummaryGrid}>
              {[
                { label: t('historyThisMonthHikes'), value: '2', color: '#630E13' },
                { label: t('historyTotalKm'), value: '24km', color: '#D4A843' },
                { label: t('historyHighestElevation'), value: '630m', color: '#7DB3CC' },
                { label: t('historyAvgDuration'), value: '4.7h', color: '#BB2823' },
              ].map((item) => (
                <View key={item.label} style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
          </AnimatedBlock>
        )}
      </ScrollView>
    </AnimatedScreen>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#630E13',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  statsRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 4,
  },
  statValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '800',
    color: 'white',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#F7F7F7',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
  },
  tabIcon: {
    marginRight: 6,
  },
  tabButtonActive: {
    backgroundColor: '#630E13',
  },
  tabText: {
    color: '#6B5D4E',
    fontWeight: '700',
  },
  tabTextActive: {
    color: 'white',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  hikeCard: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineMarker: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#630E13',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(99,14,19,0.2)',
    marginTop: 4,
  },
  hikeContent: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
    marginLeft: 8,
  },
  hikeImage: {
    width: 90,
    height: 90,
  },
  hikeInfo: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  hikeDate: {
    fontSize: 11,
    color: '#8A7A6A',
    marginBottom: 4,
  },
  hikeName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2C2418',
  },
  hikeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  hikeMetaText: {
    fontSize: 11,
    color: '#8A7A6A',
  },
  calendarCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
    width: width - 32,
    alignSelf: 'center',
  },
  calendarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2418',
    marginBottom: 12,
    textAlign: 'center',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekDayText: {
    width: (width - 64) / 7,
    textAlign: 'center',
    fontSize: 10,
    color: '#8A7A6A',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  calendarCellEmpty: {
    width: (width - 64) / 7,
    height: (width - 64) / 7,
  },
  calendarCell: {
    width: (width - 64) / 7,
    height: (width - 64) / 7,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCellActive: {
    backgroundColor: '#630E13',
  },
  calendarCellText: {
    fontSize: 12,
    color: '#2C2418',
  },
  calendarCellTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D4A843',
    marginTop: 4,
  },
  monthSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryCard: {
    backgroundColor: '#EAE2CC',
    borderRadius: 14,
    padding: 12,
    width: (width - 60) / 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  summaryLabel: {
    marginTop: 6,
    fontSize: 11,
    color: '#8A7A6A',
  },
});
