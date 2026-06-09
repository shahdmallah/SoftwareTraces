import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import {
  getRecommendationPreferences,
  updateRecommendationPreferences,
  type RecommendationPreferences,
} from '../api/recommendationsApi';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const emptyPreferences: RecommendationPreferences = {
  preferred_regions: [],
  preferred_difficulties: [],
  preferred_features: [],
  preferred_tags: [],
  min_distance_km: null,
  max_distance_km: null,
};

function joinList(values: string[]) {
  return values.join(', ');
}

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function RecommendationPreferencesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [preferences, setPreferences] = useState<RecommendationPreferences>(emptyPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await getRecommendationPreferences();
      setPreferences(next);
    } catch (error) {
      Alert.alert(
        isArabic ? 'تعذر تحميل التفضيلات' : 'Unable to load preferences',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [isArabic]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const savePreferences = async () => {
    setIsSaving(true);
    try {
      const saved = await updateRecommendationPreferences(preferences);
      setPreferences(saved);
      Alert.alert(
        isArabic ? 'تم الحفظ' : 'Saved',
        isArabic ? 'تم تحديث تفضيلات التوصيات.' : 'Recommendation preferences updated.',
      );
    } catch (error) {
      Alert.alert(
        isArabic ? 'تعذر الحفظ' : 'Unable to save',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(28, insets.bottom + 22) }]}>
        <AnimatedBlock delay={40}>
          <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
            <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
              <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, isArabic ? rtlText : ltrText]}>
                {isArabic ? 'تفضيلات التوصيات' : 'Trail recommendations'}
              </Text>
              <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>
                {isArabic ? 'اضبط المناطق والصعوبة وطول المسار المفضل.' : 'Tune regions, difficulty, and distance for personalized trail picks.'}
              </Text>
            </View>
          </View>
        </AnimatedBlock>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#630E13" />
          </View>
        ) : (
          <AnimatedBlock delay={90} style={styles.card}>
            {([
              ['preferred_regions', isArabic ? 'المناطق المفضلة' : 'Preferred regions', joinList(preferences.preferred_regions)],
              ['preferred_difficulties', isArabic ? 'مستويات الصعوبة' : 'Preferred difficulties', joinList(preferences.preferred_difficulties)],
              ['preferred_features', isArabic ? 'الميزات المفضلة' : 'Preferred features', joinList(preferences.preferred_features)],
              ['preferred_tags', isArabic ? 'الوسوم المفضلة' : 'Preferred tags', joinList(preferences.preferred_tags)],
            ] as const).map(([key, label, value]) => (
              <View key={key} style={styles.field}>
                <Text style={[styles.label, isArabic ? rtlText : ltrText]}>{label}</Text>
                <TextInput
                  defaultValue={value}
                  placeholder={isArabic ? 'افصل بفواصل' : 'Comma-separated'}
                  placeholderTextColor="#A18F7A"
                  style={[styles.input, isArabic ? rtlText : ltrText]}
                  onEndEditing={(event) => {
                    const nextValues = splitList(event.nativeEvent.text);
                    setPreferences((current) => ({ ...current, [key]: nextValues }));
                  }}
                />
              </View>
            ))}

            <View style={styles.distanceRow}>
              <View style={[styles.field, styles.distanceField]}>
                <Text style={[styles.label, isArabic ? rtlText : ltrText]}>{isArabic ? 'أقل مسافة (كم)' : 'Min distance (km)'}</Text>
                <TextInput
                  defaultValue={preferences.min_distance_km?.toString() ?? ''}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#A18F7A"
                  style={[styles.input, isArabic ? rtlText : ltrText]}
                  onEndEditing={(event) => {
                    const parsed = Number(event.nativeEvent.text);
                    setPreferences((current) => ({
                      ...current,
                      min_distance_km: Number.isFinite(parsed) ? parsed : null,
                    }));
                  }}
                />
              </View>
              <View style={[styles.field, styles.distanceField]}>
                <Text style={[styles.label, isArabic ? rtlText : ltrText]}>{isArabic ? 'أقصى مسافة (كم)' : 'Max distance (km)'}</Text>
                <TextInput
                  defaultValue={preferences.max_distance_km?.toString() ?? ''}
                  keyboardType="decimal-pad"
                  placeholder="20"
                  placeholderTextColor="#A18F7A"
                  style={[styles.input, isArabic ? rtlText : ltrText]}
                  onEndEditing={(event) => {
                    const parsed = Number(event.nativeEvent.text);
                    setPreferences((current) => ({
                      ...current,
                      max_distance_km: Number.isFinite(parsed) ? parsed : null,
                    }));
                  }}
                />
              </View>
            </View>

            <Pressable style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={() => void savePreferences()} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{isArabic ? 'حفظ التفضيلات' : 'Save preferences'}</Text>}
            </Pressable>
          </AnimatedBlock>
        )}
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
  subtitle: { marginTop: 4, color: '#7B6D5A', fontSize: 13, lineHeight: 19 },
  loadingCard: { borderRadius: 24, backgroundColor: '#FFFFFF', padding: 28, alignItems: 'center' },
  card: { borderRadius: 24, backgroundColor: '#FFFFFF', padding: 16, gap: 14 },
  field: { gap: 6 },
  label: { color: '#2C2418', fontSize: 13, fontWeight: '800' },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7D8C3',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#2C2418',
    fontSize: 14,
  },
  distanceRow: { flexDirection: 'row', gap: 10 },
  distanceField: { flex: 1 },
  saveButton: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: '#630E13',
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
