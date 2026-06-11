import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import {
  getRecommendationPreferences,
  updateRecommendationPreferences,
  type RecommendationPreferences,
} from '../api/recommendationsApi';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type NavigationProp = StackNavigationProp<RootStackParamList, 'RecommendationPreferences'>;
type RecommendationPreferencesRouteProp = RouteProp<RootStackParamList, 'RecommendationPreferences'>;
type PreferenceKey =
  | 'preferred_regions'
  | 'preferred_difficulties'
  | 'preferred_features'
  | 'preferred_tags';

type PickerConfig = {
  key: PreferenceKey;
  titleEn: string;
  titleAr: string;
  placeholderEn: string;
  placeholderAr: string;
  helperEn: string;
  helperAr: string;
  options: string[];
};

const emptyPreferences: RecommendationPreferences = {
  preferred_regions: [],
  preferred_difficulties: [],
  preferred_features: [],
  preferred_tags: [],
  min_distance_km: null,
  max_distance_km: null,
};

const regionOptions = [
  'Jericho',
  'Hebron',
  'Bethlehem',
  'Nablus',
  'Ramallah',
  'Jerusalem',
  'Jenin',
  'Tubas',
  'Tulkarm',
  'Qalqilya',
  'Salfit',
];

const difficultyOptions = ['Easy', 'Moderate', 'Hard', 'Expert'];

const featureOptions = [
  'Canyon',
  'Monastery',
  'Spring',
  'Desert',
  'Caves',
  'Historical',
  'Archaeological',
  'Terraces',
  'Olive Trees',
  'UNESCO',
  'Village',
  'Summit',
  'Sacred Site',
  'Panoramic View',
  'Dead Sea',
  'Salt Flats',
  'Unique Geology',
  'Olive Groves',
  'Urban Edge',
  'City Views',
];

const tagOptions = [
  'desert',
  'canyon',
  'historical',
  'caves',
  'heritage',
  'terraces',
  'olive',
  'summit',
  'spiritual',
  'water',
  'unique',
  'urban',
  'easy',
  'moderate',
  'hard',
];

const pickerConfigs: PickerConfig[] = [
  {
    key: 'preferred_regions',
    titleEn: 'Preferred regions',
    titleAr: 'المناطق المفضلة',
    placeholderEn: 'Choose one or more regions',
    placeholderAr: 'اختر منطقة واحدة أو أكثر',
    helperEn: 'We will favor trails near the places you want to explore most.',
    helperAr: 'سنرشح لك مسارات من المناطق التي تريد استكشافها أكثر.',
    options: regionOptions,
  },
  {
    key: 'preferred_difficulties',
    titleEn: 'Preferred difficulties',
    titleAr: 'مستويات الصعوبة',
    placeholderEn: 'Choose one or more difficulty levels',
    placeholderAr: 'اختر مستوى صعوبة واحدًا أو أكثر',
    helperEn: 'Pick the effort levels that feel right for your hikes.',
    helperAr: 'اختر مستويات الجهد المناسبة لمشيك.',
    options: difficultyOptions,
  },
  {
    key: 'preferred_features',
    titleEn: 'Preferred features',
    titleAr: 'الميزات المفضلة',
    placeholderEn: 'Choose the trail features you like',
    placeholderAr: 'اختر ميزات المسار التي تفضلها',
    helperEn: 'Select scenery, landmarks, or terrain you want to see more often.',
    helperAr: 'اختر المناظر أو المعالم أو أنواع التضاريس التي تريد رؤيتها أكثر.',
    options: featureOptions,
  },
  {
    key: 'preferred_tags',
    titleEn: 'Preferred tags',
    titleAr: 'الوسوم المفضلة',
    placeholderEn: 'Choose one or more tags',
    placeholderAr: 'اختر وسمًا واحدًا أو أكثر',
    helperEn: 'Tags help us mix in vibe-based recommendations too.',
    helperAr: 'تساعدنا الوسوم على اقتراح مسارات تناسب الأجواء التي تحبها.',
    options: tagOptions,
  },
];

function formatSelectedValues(values: string[], placeholder: string) {
  return values.length > 0 ? values.join(', ') : placeholder;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

type PickerSheetProps = {
  config: PickerConfig | null;
  isArabic: boolean;
  selectedValues: string[];
  onClose: () => void;
  onToggleValue: (value: string) => void;
  onClear: () => void;
};

function PickerSheet({ config, isArabic, selectedValues, onClose, onToggleValue, onClear }: PickerSheetProps) {
  return (
    <Modal visible={Boolean(config)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalSheet}>
          {config ? (
            <>
              <View style={[styles.modalHeader, isArabic ? rtlRow : ltrRow]}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={[styles.modalTitle, isArabic ? rtlText : ltrText]}>
                    {isArabic ? config.titleAr : config.titleEn}
                  </Text>
                  <Text style={[styles.modalSubtitle, isArabic ? rtlText : ltrText]}>
                    {isArabic ? 'يمكنك اختيار أكثر من عنصر.' : 'You can choose more than one.'}
                  </Text>
                </View>
                <Pressable style={styles.modalCloseButton} onPress={onClose}>
                  <Ionicons name="close" size={18} color="#2C2418" />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.optionList}>
                {config.options.map((option) => {
                  const isSelected = selectedValues.includes(option);

                  return (
                    <Pressable
                      key={option}
                      style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                      onPress={() => onToggleValue(option)}
                    >
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected, isArabic ? rtlText : ltrText]}>
                        {option}
                      </Text>
                      <View style={[styles.optionCheck, isSelected && styles.optionCheckSelected]}>
                        {isSelected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.modalActions}>
                <Pressable style={styles.modalGhostButton} onPress={onClear}>
                  <Text style={styles.modalGhostButtonText}>{isArabic ? 'مسح الكل' : 'Clear all'}</Text>
                </Pressable>
                <Pressable style={styles.modalPrimaryButton} onPress={onClose}>
                  <Text style={styles.modalPrimaryButtonText}>{isArabic ? 'تم' : 'Done'}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export function RecommendationPreferencesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RecommendationPreferencesRouteProp>();
  const insets = useSafeAreaInsets();
  const { completeFirstLoginSetup } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const isOnboarding = route.params?.onboarding === true;
  const onboardingNotice = route.params?.notice?.trim() ?? '';
  const [preferences, setPreferences] = useState<RecommendationPreferences>(emptyPreferences);
  const [activePickerKey, setActivePickerKey] = useState<PreferenceKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const activePickerConfig = useMemo(
    () => pickerConfigs.find((config) => config.key === activePickerKey) ?? null,
    [activePickerKey],
  );

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

  const updateListPreference = useCallback((key: PreferenceKey, value: string) => {
    setPreferences((current) => ({
      ...current,
      [key]: toggleValue(current[key], value),
    }));
  }, []);

  const clearListPreference = useCallback((key: PreferenceKey) => {
    setPreferences((current) => ({
      ...current,
      [key]: [],
    }));
  }, []);

  const completeOnboardingFlow = useCallback(async () => {
    await completeFirstLoginSetup();
    navigation.reset({
      index: 0,
      routes: [{ name: 'AppTabs' }],
    });
  }, [completeFirstLoginSetup, navigation]);

  const savePreferences = useCallback(async (finalizeOnboarding: boolean) => {
    setIsSaving(true);
    try {
      const saved = await updateRecommendationPreferences(preferences);
      setPreferences(saved);

      if (finalizeOnboarding) {
        await completeOnboardingFlow();
        return;
      }

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
  }, [completeOnboardingFlow, isArabic, preferences]);

  const handleSkipOnboarding = useCallback(() => {
    const message = isArabic
      ? 'يمكنك تعديل تفضيلات التوصيات لاحقًا من الملف الشخصي > الإعدادات.'
      : 'You can edit your trail preferences later from Profile > Settings.';

    Alert.alert(isArabic ? 'تخطي الآن' : 'Skip for now', message, [
      { text: isArabic ? 'متابعة التعديل' : 'Keep editing', style: 'cancel' },
      {
        text: isArabic ? 'إنهاء' : 'Finish',
        onPress: () => {
          void completeOnboardingFlow();
        },
      },
    ]);
  }, [completeOnboardingFlow, isArabic]);

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(12, insets.top + 8),
            paddingBottom: Math.max(28, insets.bottom + 22),
          },
        ]}
      >
        <AnimatedBlock delay={40}>
          <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
            {isOnboarding ? (
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>2 of 2</Text>
              </View>
            ) : (
              <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
                <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
              </Pressable>
            )}
            <View style={styles.headerCopy}>
              <Text style={[styles.title, isArabic ? rtlText : ltrText]}>
                {isArabic ? 'تفضيلات التوصيات' : 'Trail recommendations'}
              </Text>
              <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>
                {isOnboarding
                  ? (isArabic
                      ? 'اختر ما تحبه لنقترح لك مسارات أفضل من أول مرة.'
                      : 'Pick what you like so we can tailor trail suggestions from day one.')
                  : (isArabic
                      ? 'اضبط المناطق والصعوبة والمسافة للمسارات المقترحة.'
                      : 'Tune regions, difficulty, and distance for personalized trail picks.')}
              </Text>
            </View>
          </View>
        </AnimatedBlock>

        {isOnboarding ? (
          <AnimatedBlock delay={60} style={styles.onboardingBanner}>
            <Ionicons name="sparkles-outline" size={20} color="#630E13" />
            <View style={styles.onboardingBannerCopy}>
              <Text style={styles.onboardingBannerTitle}>
                {isArabic ? 'خصص الاقتراحات من البداية' : 'Personalize suggestions from the start'}
              </Text>
              <Text style={styles.onboardingBannerText}>
                {isArabic
                  ? 'يمكنك اختيار أكثر من منطقة أو صعوبة أو وسم، أو تخطي هذه الخطوة وتعديلها لاحقًا.'
                  : 'Choose more than one region, difficulty, or tag if you want, or skip and change this later.'}
              </Text>
            </View>
          </AnimatedBlock>
        ) : null}

        {onboardingNotice ? (
          <AnimatedBlock delay={75} style={styles.noticeBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#7A4D00" />
            <Text style={[styles.noticeText, isArabic ? rtlText : ltrText]}>{onboardingNotice}</Text>
          </AnimatedBlock>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#630E13" />
          </View>
        ) : (
          <AnimatedBlock delay={90} style={styles.card}>
            {pickerConfigs.map((config) => {
              const selectedValues = preferences[config.key];
              const label = isArabic ? config.titleAr : config.titleEn;
              const helper = isArabic ? config.helperAr : config.helperEn;
              const placeholder = isArabic ? config.placeholderAr : config.placeholderEn;

              return (
                <View key={config.key} style={styles.field}>
                  <View style={[styles.fieldHeader, isArabic ? rtlRow : ltrRow]}>
                    <Text style={[styles.label, isArabic ? rtlText : ltrText]}>{label}</Text>
                    {selectedValues.length > 0 ? (
                      <Pressable onPress={() => clearListPreference(config.key)}>
                        <Text style={styles.clearText}>{isArabic ? 'مسح' : 'Clear'}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={[styles.helperText, isArabic ? rtlText : ltrText]}>{helper}</Text>
                  <Pressable style={styles.selectButton} onPress={() => setActivePickerKey(config.key)}>
                    <Text
                      style={[
                        styles.selectButtonText,
                        selectedValues.length === 0 && styles.selectButtonPlaceholder,
                        isArabic ? rtlText : ltrText,
                      ]}
                    >
                      {formatSelectedValues(selectedValues, placeholder)}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#7B6D5A" />
                  </Pressable>
                  {selectedValues.length > 0 ? (
                    <View style={styles.selectionChips}>
                      {selectedValues.map((value) => (
                        <View key={value} style={styles.selectionChip}>
                          <Text style={styles.selectionChipText}>{value}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}

            <View style={styles.distanceRow}>
              <View style={[styles.field, styles.distanceField]}>
                <Text style={[styles.label, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'أقل مسافة (كم)' : 'Min distance (km)'}
                </Text>
                <TextInput
                  value={preferences.min_distance_km?.toString() ?? ''}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#A18F7A"
                  style={[styles.input, isArabic ? rtlText : ltrText]}
                  onChangeText={(value) => {
                    const parsed = Number(value);
                    setPreferences((current) => ({
                      ...current,
                      min_distance_km: value.trim() === '' ? null : Number.isFinite(parsed) ? parsed : current.min_distance_km,
                    }));
                  }}
                />
              </View>
              <View style={[styles.field, styles.distanceField]}>
                <Text style={[styles.label, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'أقصى مسافة (كم)' : 'Max distance (km)'}
                </Text>
                <TextInput
                  value={preferences.max_distance_km?.toString() ?? ''}
                  keyboardType="decimal-pad"
                  placeholder="20"
                  placeholderTextColor="#A18F7A"
                  style={[styles.input, isArabic ? rtlText : ltrText]}
                  onChangeText={(value) => {
                    const parsed = Number(value);
                    setPreferences((current) => ({
                      ...current,
                      max_distance_km: value.trim() === '' ? null : Number.isFinite(parsed) ? parsed : current.max_distance_km,
                    }));
                  }}
                />
              </View>
            </View>

            {isOnboarding ? (
              <View style={styles.onboardingActions}>
                <Pressable style={styles.secondaryButton} onPress={handleSkipOnboarding} disabled={isSaving}>
                  <Text style={styles.secondaryButtonText}>{isArabic ? 'تخطي الآن' : 'Skip for now'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
                  onPress={() => {
                    void savePreferences(true);
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{isArabic ? 'حفظ وإنهاء' : 'Save and finish'}</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
                onPress={() => {
                  void savePreferences(false);
                }}
                disabled={isSaving}
              >
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{isArabic ? 'حفظ التفضيلات' : 'Save preferences'}</Text>}
              </Pressable>
            )}
          </AnimatedBlock>
        )}
      </ScrollView>

      <PickerSheet
        config={activePickerConfig}
        isArabic={isArabic}
        selectedValues={activePickerConfig ? preferences[activePickerConfig.key] : []}
        onClose={() => setActivePickerKey(null)}
        onToggleValue={(value) => {
          if (!activePickerConfig) {
            return;
          }

          updateListPreference(activePickerConfig.key, value);
        }}
        onClear={() => {
          if (!activePickerConfig) {
            return;
          }

          clearListPreference(activePickerConfig.key);
        }}
      />
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED' },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  stepBadge: {
    minWidth: 54,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  stepBadgeText: { color: '#630E13', fontSize: 12, fontWeight: '900' },
  headerCopy: { flex: 1 },
  title: { color: '#2C2418', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 4, color: '#7B6D5A', fontSize: 13, lineHeight: 19 },
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 20,
    backgroundColor: '#FFF6E8',
    borderWidth: 1,
    borderColor: '#F0DBC1',
    padding: 14,
    marginBottom: 12,
  },
  onboardingBannerCopy: { flex: 1 },
  onboardingBannerTitle: { color: '#2C2418', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  onboardingBannerText: { marginTop: 4, color: '#7B6D5A', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#FFF8EA',
    padding: 12,
    marginBottom: 12,
  },
  noticeText: { flex: 1, color: '#7A4D00', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  loadingCard: { borderRadius: 24, backgroundColor: '#FFFFFF', padding: 28, alignItems: 'center' },
  card: { borderRadius: 24, backgroundColor: '#FFFFFF', padding: 16, gap: 14 },
  field: { gap: 6 },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: '#2C2418', fontSize: 13, fontWeight: '800' },
  helperText: { color: '#8A7A6A', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  clearText: { color: '#630E13', fontSize: 11, fontWeight: '900' },
  selectButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7D8C3',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectButtonText: { flex: 1, color: '#2C2418', fontSize: 14 },
  selectButtonPlaceholder: { color: '#A18F7A' },
  selectionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  selectionChip: {
    borderRadius: 999,
    backgroundColor: '#F7EBE8',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectionChipText: { color: '#630E13', fontSize: 11, fontWeight: '800' },
  distanceRow: { flexDirection: 'row', gap: 10 },
  distanceField: { flex: 1 },
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
  onboardingActions: { gap: 10, marginTop: 4 },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9C9B3',
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#6B5D4E', fontSize: 14, fontWeight: '800' },
  primaryButton: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: '#630E13',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(44,36,24,0.34)' },
  modalSheet: {
    maxHeight: '78%',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 24,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  modalHeaderCopy: { flex: 1 },
  modalTitle: { color: '#2C2418', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  modalSubtitle: { marginTop: 3, color: '#7B6D5A', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  modalCloseButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EBE1' },
  optionList: { gap: 8, paddingBottom: 4 },
  optionRow: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8DDCD',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionRowSelected: { borderColor: '#630E13', backgroundColor: '#F9F1EE' },
  optionText: { flex: 1, color: '#2C2418', fontSize: 14, fontWeight: '700' },
  optionTextSelected: { color: '#630E13' },
  optionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#D8C9B3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckSelected: { borderColor: '#630E13', backgroundColor: '#630E13' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalGhostButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D9C9B3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalGhostButtonText: { color: '#6B5D4E', fontSize: 13, fontWeight: '800' },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: '#630E13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
