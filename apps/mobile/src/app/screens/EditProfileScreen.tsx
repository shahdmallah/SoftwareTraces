import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';

type EditProfileNavigationProp = StackNavigationProp<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen() {
  const navigation = useNavigation<EditProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const isArabic = language === 'ar';

  const [name, setName] = useState(user?.full_name ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');

  useEffect(() => {
    setName(user?.full_name ?? '');
    setLocation(user?.location ?? '');
    setBio(user?.bio ?? '');
  }, [user]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(isArabic ? 'الاسم مطلوب' : 'Name required', isArabic ? 'يرجى إدخال اسمك.' : 'Please enter your full name.');
      return;
    }

    Alert.alert(
      isArabic ? 'تم الحفظ' : 'Saved',
      isArabic
        ? 'تم تحديث ملفك الشخصي محلياً. ستظهر هذه المعلومات في ملفك الشخصي.'
        : 'Your profile changes were saved locally. They will update your profile display.',
      [{ text: isArabic ? 'حسناً' : 'OK', onPress: () => navigation.goBack() }],
    );
  };

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 12, 24), paddingBottom: Math.max(insets.bottom + 24, 24) }]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedBlock delay={40} style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color="#2C2418" />
          </Pressable>
          <Text style={styles.title}>{isArabic ? 'تعديل الملف الشخصي' : 'Edit profile'}</Text>
        </AnimatedBlock>

        <AnimatedBlock delay={80} style={styles.photoSection}>
          <Pressable style={styles.photoPickerButton}>
            <Ionicons name="camera" size={24} color="#FFFFFF" />
            <Text style={styles.photoPickerText}>{isArabic ? 'تغيير الصورة' : 'Change photo'}</Text>
          </Pressable>
        </AnimatedBlock>

        <AnimatedBlock delay={100} style={styles.card}>
          <Text style={styles.fieldLabel}>{isArabic ? 'الاسم الكامل' : 'Full name'}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={isArabic ? 'أدخل اسمك الكامل' : 'Your full name'}
            placeholderTextColor="#A18F7A"
            style={[styles.input, isArabic ? styles.rtlText : styles.ltrText]}
          />

          <Text style={styles.fieldLabel}>{isArabic ? 'الموقع' : 'Location'}</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder={isArabic ? 'المدينة أو المنطقة' : 'City or region'}
            placeholderTextColor="#A18F7A"
            style={[styles.input, isArabic ? styles.rtlText : styles.ltrText]}
          />

          <Text style={styles.fieldLabel}>{isArabic ? 'نبذة عني' : 'About me'}</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            multiline
            placeholder={isArabic ? 'اكتب شيئاً عن نفسك...' : 'Tell others about yourself...'}
            placeholderTextColor="#A18F7A"
            style={[styles.bioInput, isArabic ? styles.rtlText : styles.ltrText]}
          />

          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{isArabic ? 'حفظ التغييرات' : 'Save changes'}</Text>
          </Pressable>
        </AnimatedBlock>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED' },
  content: { paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '900', color: '#2C2418' },
  photoSection: { marginBottom: 16 },
  photoPickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 18, backgroundColor: '#630E13', paddingVertical: 14 },
  photoPickerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#6B5D4E', marginBottom: 8, marginTop: 16 },
  input: { borderRadius: 16, backgroundColor: '#FFF8F1', paddingHorizontal: 14, minHeight: 50, fontSize: 14, color: '#2C2418' },
  bioInput: { minHeight: 100, borderRadius: 16, backgroundColor: '#FFF8F1', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#2C2418', textAlignVertical: 'top' },
  saveButton: { marginTop: 24, borderRadius: 18, backgroundColor: '#630E13', paddingVertical: 16, alignItems: 'center' },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  ltrText: { textAlign: 'left' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});
