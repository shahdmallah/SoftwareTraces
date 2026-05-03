import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type ComposerRouteProp = RouteProp<RootStackParamList, 'ActivityShareComposer'>;
type ComposerNavigationProp = StackNavigationProp<RootStackParamList, 'ActivityShareComposer'>;

export function ActivityShareComposerScreen() {
  const route = useRoute<ComposerRouteProp>();
  const navigation = useNavigation<ComposerNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const isPlan = route.params.type === 'plan';
  const [trail, setTrail] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(28, insets.bottom + 22) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AnimatedBlock delay={40}>
          <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
            <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
              <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, isArabic ? rtlText : ltrText]}>
                {isPlan ? (isArabic ? 'خطة جديدة' : 'New meetup plan') : isArabic ? 'منشور رحلة' : 'Trail recap'}
              </Text>
              <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>
                {isPlan
                  ? isArabic
                    ? 'ادع الأصدقاء إلى المسار القادم.'
                    : 'Invite friends to your next trail.'
                  : isArabic
                  ? 'شارك صورة أو ملاحظة من رحلتك.'
                  : 'Share a photo note from your hike.'}
              </Text>
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={90} style={styles.card}>
          <View style={styles.mediaPlaceholder}>
            <Ionicons name={isPlan ? 'calendar-outline' : 'images-outline'} size={32} color="#630E13" />
            <Text style={styles.mediaPlaceholderText}>
              {isPlan ? (isArabic ? 'غلاف الخطة' : 'Plan cover') : isArabic ? 'أضف صوراً' : 'Add photos'}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, isArabic ? rtlText : ltrText]}>{isArabic ? 'المسار' : 'Trail'}</Text>
            <TextInput
              value={trail}
              onChangeText={setTrail}
              placeholder={isArabic ? 'اختر أو اكتب اسم المسار' : 'Choose or type a trail name'}
              placeholderTextColor="#A18F7A"
              style={[styles.input, isArabic ? rtlText : ltrText]}
            />
          </View>

          {isPlan ? (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, isArabic ? rtlText : ltrText]}>{isArabic ? 'الوقت' : 'Time'}</Text>
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder={isArabic ? 'الجمعة 7:00 صباحاً' : 'Friday at 7:00 AM'}
                placeholderTextColor="#A18F7A"
                style={[styles.input, isArabic ? rtlText : ltrText]}
              />
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, isArabic ? rtlText : ltrText]}>{isArabic ? 'النص' : 'Caption'}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={isPlan ? (isArabic ? 'صف أجواء الرحلة وعدد المقاعد...' : 'Describe the pace, vibe, and open spots...') : isArabic ? 'اكتب لحظة من الرحلة...' : 'Write a moment from the trail...'}
              placeholderTextColor="#A18F7A"
              style={[styles.textArea, isArabic ? rtlText : ltrText]}
            />
          </View>

          <Pressable style={styles.submitButton} onPress={() => navigation.navigate('AppTabs', { screen: 'Activity' })}>
            <Text style={styles.submitText}>{isArabic ? 'نشر' : 'Post'}</Text>
          </Pressable>
        </AnimatedBlock>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED' },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: '#2C2418', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 4, color: '#7B6D5A', fontSize: 13 },
  card: { borderRadius: 24, padding: 16, backgroundColor: '#FFFFFF' },
  mediaPlaceholder: {
    height: 170,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F0E0',
    borderWidth: 1,
    borderColor: '#E7D8C3',
    borderStyle: 'dashed',
  },
  mediaPlaceholderText: { marginTop: 8, color: '#630E13', fontSize: 13, fontWeight: '900' },
  inputGroup: { marginTop: 16 },
  label: { marginBottom: 7, color: '#6B5D4E', fontSize: 12, fontWeight: '800' },
  input: { minHeight: 50, borderRadius: 16, paddingHorizontal: 14, backgroundColor: '#FFF8F1', color: '#2C2418', fontSize: 14 },
  textArea: {
    minHeight: 132,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFF8F1',
    color: '#2C2418',
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  submitButton: { marginTop: 18, borderRadius: 18, paddingVertical: 16, alignItems: 'center', backgroundColor: '#630E13' },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
