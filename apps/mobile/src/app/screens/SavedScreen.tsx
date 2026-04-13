import React from 'react';
import { View, Text, Pressable, StyleSheet, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { trails } from '../data/trails';
import { RootStackParamList } from '../navigation/types';
import { useLanguage } from '../contexts/LanguageContext';
import { useSavedTrailIds } from '../state/savedTrails';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type SavedNavigationProp = StackNavigationProp<RootStackParamList, 'TrailDetail'>;

export function SavedScreen() {
  const navigation = useNavigation<SavedNavigationProp>();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const savedTrailIds = useSavedTrailIds();
  const savedTrails = trails.filter((trail) => savedTrailIds.includes(trail.id));

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(24, insets.bottom + 16) }]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedBlock delay={40}>
          <View style={[styles.hero, isArabic ? rtlRow : ltrRow]}>
            <View>
              <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{t('savedTitle')}</Text>
              <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>{t('savedSubtitle')}</Text>
            </View>
            <View style={styles.countPill}>
              <Ionicons name="bookmark" size={14} color="#fff" />
              <Text style={styles.countText}>{savedTrails.length}</Text>
            </View>
          </View>
        </AnimatedBlock>

        {savedTrails.map((trail, index) => (
          <AnimatedBlock key={trail.id} delay={90 + index * 40}>
            <Pressable style={styles.card} onPress={() => navigation.navigate('TrailDetail', { trailId: trail.id })}>
              <Image source={{ uri: trail.image }} style={styles.image} />
              <View style={styles.overlay}>
                <View style={[styles.cardTopRow, isArabic ? rtlRow : ltrRow]}>
                  <View style={styles.badge}>
                    <Ionicons name="bookmark" size={12} color="#fff" />
                    <Text style={styles.badgeText}>{t('tabSaved')}</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <Text style={[styles.name, isArabic ? rtlText : ltrText]}>{isArabic ? trail.nameAr : trail.name}</Text>
                  <Text style={[styles.region, isArabic ? rtlText : ltrText]}>{isArabic ? trail.regionAr : trail.region}</Text>
                  <View style={[styles.metaRow, isArabic && styles.metaRowRtl]}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaText}>{trail.distance} km</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaText}>{trail.duration}</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaText}>{trail.difficulty}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          </AnimatedBlock>
        ))}
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
  },
  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2C2418',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#7B6D5A',
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#630E13',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  card: {
    height: 232,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 18,
    backgroundColor: '#cbbfa4',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: 'rgba(14,7,5,0.34)',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  cardBottom: {
    marginTop: 'auto',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(99,14,19,0.92)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  name: {
    color: '#fff',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },
  region: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaRowRtl: {
    flexDirection: 'row-reverse',
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  metaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
