import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type ShareNavigationProp = StackNavigationProp<RootStackParamList>;
type ShareRouteProp = RouteProp<RootStackParamList, 'ActivityShare'>;

const shareOptions = [
  {
    id: 'photo',
    icon: 'images-outline' as const,
    titleEn: 'Share a trail photo',
    titleAr: 'شارك صورة من المسار',
    descriptionEn: 'Post photos from a completed visit, add a caption, and tag the trail.',
    descriptionAr: 'انشر صوراً من زيارة مكتملة، وأضف تعليقاً وحدد المسار.',
    accent: ['#7A9A3A', '#D4A843'] as const,
  },
  {
    id: 'plan',
    icon: 'calendar-outline' as const,
    titleEn: 'Share a future plan',
    titleAr: 'شارك خطة قادمة',
    descriptionEn: 'Invite friends to join the next hike and share the time, vibe, and open spots.',
    descriptionAr: 'ادعُ الأصدقاء للرحلة القادمة وشارك الوقت والأجواء والأماكن المتاحة.',
    accent: ['#630E13', '#B34A2E'] as const,
  },
];

const previewCards = [
  {
    id: 'p1',
    image: 'https://images.unsplash.com/photo-1726091983472-a7da2540c492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=900',
    titleEn: 'Photo recap preview',
    titleAr: 'معاينة منشور صورة',
  },
  {
    id: 'p2',
    image: 'https://images.unsplash.com/photo-1722228097356-bd0202d99367?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=900',
    titleEn: 'Plan card preview',
    titleAr: 'معاينة بطاقة الخطة',
  },
];

export function ActivityShareScreen() {
  const navigation = useNavigation<ShareNavigationProp>();
  const route = useRoute<ShareRouteProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const draft = route.params?.draft;

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(28, insets.bottom + 22) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedBlock delay={40}>
          <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
            <View style={[styles.headerSide, isArabic ? rtlRow : ltrRow]}>
              <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
                <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
              </Pressable>
              <View>
                <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{isArabic ? 'مشاركة' : 'Share'}</Text>
                <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'انشر صورة أو أضف خطة جديدة للأصدقاء' : 'Post a photo or add a new plan for friends'}
                </Text>
              </View>
            </View>
          </View>
        </AnimatedBlock>

        {shareOptions.map((option, index) => (
          <AnimatedBlock key={option.id} delay={80 + index * 40}>
            <Pressable
              style={styles.optionCard}
              onPress={() => navigation.navigate('ActivityShareComposer', { type: option.id as 'photo' | 'plan' })}
            >
              <LinearGradient colors={[...option.accent]} style={styles.optionIcon}>
                <Ionicons name={option.icon} size={22} color="#fff" />
              </LinearGradient>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, isArabic ? rtlText : ltrText]}>
                  {isArabic ? option.titleAr : option.titleEn}
                </Text>
                <Text style={[styles.optionDescription, isArabic ? rtlText : ltrText]}>
                  {isArabic ? option.descriptionAr : option.descriptionEn}
                </Text>
              </View>
              <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={18} color="#8A7A6A" />
            </Pressable>
          </AnimatedBlock>
        ))}

        {draft ? (
          <AnimatedBlock delay={150}>
            <View style={styles.draftCard}>
              <View style={styles.draftHeader}>
                <Ionicons name="checkmark-circle" size={18} color="#1E7A46" />
                <Text style={[styles.draftTitle, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'تم تجهيز ملخص رحلتك' : 'Your trail recap is ready'}
                </Text>
              </View>
              <Text style={[styles.draftSubtitle, isArabic ? rtlText : ltrText]}>
                {isArabic ? `${draft.trailName} - تقييم ${draft.rating}/5` : `${draft.trailName} - ${draft.rating}/5 rating`}
              </Text>
              {draft.review ? (
                <Text style={[styles.draftReview, isArabic ? rtlText : ltrText]}>{draft.review}</Text>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.draftPhotos}>
                {draft.photoUris.map((uri, index) => (
                  <Image key={`${uri}-${index}`} source={{ uri }} style={styles.draftPhoto} />
                ))}
              </ScrollView>
            </View>
          </AnimatedBlock>
        ) : null}

        <AnimatedBlock delay={170}>
          <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'كيف ستظهر المشاركة' : 'How your share will look'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.previewRow, isArabic && styles.previewRowRtl]}>
            {previewCards.map((card) => (
              <View key={card.id} style={styles.previewCard}>
                <Image source={{ uri: card.image }} style={styles.previewImage} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.previewOverlay}>
                  <Text style={styles.previewTitle}>{isArabic ? card.titleAr : card.titleEn}</Text>
                </LinearGradient>
              </View>
            ))}
          </ScrollView>
        </AnimatedBlock>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F1ED',
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 25,
    fontWeight: '900',
    color: '#2C2418',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#7B6D5A',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
  },
  draftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  draftTitle: {
    color: '#2C2418',
    fontSize: 16,
    fontWeight: '800',
  },
  draftSubtitle: {
    marginTop: 10,
    color: '#6B5D4E',
    fontSize: 13,
    fontWeight: '700',
  },
  draftReview: {
    marginTop: 8,
    color: '#43382C',
    fontSize: 14,
    lineHeight: 20,
  },
  draftPhotos: {
    gap: 10,
    paddingTop: 14,
  },
  draftPhoto: {
    width: 110,
    height: 110,
    borderRadius: 18,
    backgroundColor: '#E7D8C3',
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2C2418',
  },
  optionDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B5D4E',
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '800',
    color: '#2C2418',
  },
  previewRow: {
    gap: 12,
  },
  previewRowRtl: {
    flexDirection: 'row-reverse',
  },
  previewCard: {
    width: 220,
    height: 260,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#D4C6A4',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 16,
  },
  previewTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
});
