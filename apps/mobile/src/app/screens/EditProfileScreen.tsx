import React, { useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { ApiError } from '../api/client';
import { updateMyProfile, uploadMyAvatar } from '../api/profilesApi';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';

type EditProfileNavigationProp = StackNavigationProp<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen() {
  const navigation = useNavigation<EditProfileNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { session, user, setSession, signOut } = useAuth();
  const isArabic = language === 'ar';

  const [name, setName] = useState(user?.full_name ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [selectedAvatar, setSelectedAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(user?.full_name ?? '');
    setLocation(user?.location ?? '');
    setBio(user?.bio ?? '');
    setAvatarUrl(user?.avatar_url ?? '');
    setSelectedAvatar(null);
  }, [user]);

  const handlePickPhoto = async () => {
    try {
      setIsPickingImage(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission required', 'Media library access is required to choose a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: Platform.OS !== 'android',
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedAvatar(result.assets[0]);
        setAvatarUrl(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Could not pick photo', error instanceof Error ? error.message : 'Something went wrong while opening your photos.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(isArabic ? 'الاسم مطلوب' : 'Name required', isArabic ? 'يرجى إدخال اسمك.' : 'Please enter your full name.');
      return;
    }

    try {
      setIsSaving(true);
      let nextProfile = selectedAvatar
        ? await uploadMyAvatar(selectedAvatar.uri, selectedAvatar.mimeType, selectedAvatar.fileName)
        : null;

      nextProfile = await updateMyProfile({
        full_name: name.trim(),
        location: location.trim() || null,
        bio: bio.trim() || null,
        avatar_url: nextProfile?.avatar_url ?? (avatarUrl || null),
      });

      if (session) {
        setSession({
          ...session,
          user: {
            ...session.user,
            full_name: nextProfile.full_name,
            avatar_url: nextProfile.avatar_url,
            bio: nextProfile.bio,
            location: nextProfile.location,
          },
        });
      }

      Alert.alert(isArabic ? 'تم الحفظ' : 'Saved', isArabic ? 'تم تحديث ملفك الشخصي.' : 'Your profile changes were saved.', [
        { text: isArabic ? 'حسنا' : 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        signOut();
        Alert.alert(
          isArabic ? 'انتهت الجلسة' : 'Session expired',
          isArabic ? 'يرجى تسجيل الدخول مرة أخرى لحفظ ملفك الشخصي.' : 'Please sign in again to save your profile changes.',
          [{ text: isArabic ? 'حسنا' : 'OK', onPress: () => navigation.navigate('Auth', { mode: 'signin' }) }],
        );
        return;
      }

      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Something went wrong while saving your profile.');
    } finally {
      setIsSaving(false);
    }
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
          <View style={styles.avatarPreview}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={42} color="#A18F7A" />
            )}
          </View>
          <Pressable style={[styles.photoPickerButton, isPickingImage && styles.disabledButton]} onPress={handlePickPhoto} disabled={isPickingImage || isSaving}>
            <Ionicons name="camera" size={24} color="#FFFFFF" />
            <Text style={styles.photoPickerText}>{isPickingImage ? (isArabic ? 'جار الفتح...' : 'Opening...') : isArabic ? 'تغيير الصورة' : 'Change photo'}</Text>
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
            placeholder={isArabic ? 'اكتب شيئا عن نفسك...' : 'Tell others about yourself...'}
            placeholderTextColor="#A18F7A"
            style={[styles.bioInput, isArabic ? styles.rtlText : styles.ltrText]}
          />

          <Pressable style={[styles.saveButton, isSaving && styles.disabledButton]} onPress={handleSave} disabled={isSaving || isPickingImage}>
            <Text style={styles.saveButtonText}>{isSaving ? (isArabic ? 'جار الحفظ...' : 'Saving...') : isArabic ? 'حفظ التغييرات' : 'Save changes'}</Text>
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
  photoSection: { marginBottom: 16, alignItems: 'center', gap: 12 },
  avatarPreview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF8F1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarImage: { width: '100%', height: '100%' },
  photoPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 18,
    backgroundColor: '#630E13',
    paddingHorizontal: 20,
    paddingVertical: 14,
    minWidth: 180,
  },
  photoPickerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#6B5D4E', marginBottom: 8, marginTop: 16 },
  input: { borderRadius: 16, backgroundColor: '#FFF8F1', paddingHorizontal: 14, minHeight: 50, fontSize: 14, color: '#2C2418' },
  bioInput: { minHeight: 100, borderRadius: 16, backgroundColor: '#FFF8F1', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#2C2418', textAlignVertical: 'top' },
  saveButton: { marginTop: 24, borderRadius: 18, backgroundColor: '#630E13', paddingVertical: 16, alignItems: 'center' },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  disabledButton: { opacity: 0.65 },
  ltrText: { textAlign: 'left' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});
