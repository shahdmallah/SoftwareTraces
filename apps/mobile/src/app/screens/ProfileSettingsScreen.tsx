import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import {
  getPushNotificationActivationStatus,
  registerDeviceForPushNotifications,
  type PushNotificationActivationStatus,
} from '../services/pushNotifications';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type SettingsRouteProp = RouteProp<RootStackParamList, 'ProfileSettings'>;
type SettingsNavigationProp = StackNavigationProp<RootStackParamList, 'ProfileSettings'>;

const settingMeta: Record<string, { icon: keyof typeof Ionicons.glyphMap; titleEn: string; titleAr: string; subtitleEn: string; subtitleAr: string }> = {
  s1: { icon: 'globe-outline', titleEn: 'Language', titleAr: 'اللغة', subtitleEn: 'Choose the app language.', subtitleAr: 'اختر لغة التطبيق.' },
  s2: { icon: 'heart-outline', titleEn: 'Favorites', titleAr: 'المفضلة', subtitleEn: 'Manage saved trails and lists.', subtitleAr: 'إدارة المسارات المحفوظة.' },
  s3: { icon: 'notifications-outline', titleEn: 'Notifications', titleAr: 'الإشعارات', subtitleEn: 'Control hike and community alerts.', subtitleAr: 'تحكم بتنبيهات الرحلات والمجتمع.' },
  s4: { icon: 'shield-checkmark-outline', titleEn: 'Privacy', titleAr: 'الخصوصية', subtitleEn: 'Choose what others can see.', subtitleAr: 'اختر ما يمكن للآخرين رؤيته.' },
  s5: { icon: 'settings-outline', titleEn: 'General Settings', titleAr: 'الإعدادات العامة', subtitleEn: 'App preferences and display.', subtitleAr: 'تفضيلات التطبيق والعرض.' },
};

export function ProfileSettingsScreen() {
  const route = useRoute<SettingsRouteProp>();
  const navigation = useNavigation<SettingsNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguage();
  const isArabic = language === 'ar';
  const [pushStatus, setPushStatus] = useState<PushNotificationActivationStatus>('disabled');
  const [isActivatingPush, setIsActivatingPush] = useState(false);
  const [publicProfile, setPublicProfile] = useState(true);
  const [trailUpdates, setTrailUpdates] = useState(true);
  const meta = settingMeta[route.params.settingId] ?? settingMeta.s5;
  const notificationsOn = pushStatus === 'enabled';

  const refreshPushStatus = useCallback(async () => {
    try {
      setPushStatus(await getPushNotificationActivationStatus());
    } catch {
      setPushStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    if (route.params.settingId === 's3') {
      void refreshPushStatus();
    }
  }, [refreshPushStatus, route.params.settingId]);

  const handleNotificationsToggle = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      Alert.alert(
        'Notifications stay active',
        'Turn them off from your device notification settings.',
      );
      return;
    }

    setIsActivatingPush(true);
    try {
      const token = await registerDeviceForPushNotifications();
      await refreshPushStatus();

      if (!token) {
        Alert.alert('Notifications unavailable', 'Push notifications need a physical device and notification permission.');
      }
    } catch (error) {
      Alert.alert('Unable to enable notifications', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsActivatingPush(false);
    }
  }, [refreshPushStatus]);

  const rows = useMemo(() => {
    if (route.params.settingId === 's1') {
      return [
        { id: 'ar', labelEn: 'Arabic', labelAr: 'العربية', active: language === 'ar', onPress: () => setLanguage('ar' as const) },
        { id: 'en', labelEn: 'English', labelAr: 'English', active: language === 'en', onPress: () => setLanguage('en' as const) },
      ];
    }
    if (route.params.settingId === 's2') {
      return [
        { id: 'favorites', labelEn: 'Favorite trails', labelAr: 'المسارات المفضلة', active: true, onPress: () => navigation.navigate('AppTabs', { screen: 'Saved' }) },
        { id: 'ongoing', labelEn: 'Ongoing activities', labelAr: 'الأنشطة الجارية', active: false, onPress: () => navigation.navigate('OngoingActivities') },
        { id: 'history', labelEn: 'Completed trails', labelAr: 'المسارات المكتملة', active: false, onPress: () => navigation.navigate('History') },
      ];
    }
    if (route.params.settingId === 's5') {
      return [
        { id: 'notifications', labelEn: 'Notifications', labelAr: 'الإشعارات', active: false, onPress: () => navigation.navigate('Notifications') },
        { id: 'support', labelEn: 'Support & help', labelAr: 'الدعم والمساعدة', active: false, onPress: () => navigation.navigate('SupportHelp') },
        { id: 'reportIssue', labelEn: 'Report issue', labelAr: 'الإبلاغ عن مشكلة', active: false, onPress: () => navigation.navigate('ReportIssue') },
        { id: 'legal', labelEn: 'Legal', labelAr: 'الشروط والخصوصية', active: false, onPress: () => navigation.navigate('Legal') },
      ];
    }
    return [];
  }, [language, navigation, route.params.settingId, setLanguage]);

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(28, insets.bottom + 22) }]}>
        <AnimatedBlock delay={40}>
          <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
            <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
              <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{isArabic ? meta.titleAr : meta.titleEn}</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name={meta.icon} size={20} color="#630E13" />
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={90} style={styles.card}>
          {rows.length ? (
            rows.map((row) => (
              <Pressable key={row.id} style={[styles.row, isArabic ? rtlRow : ltrRow]} onPress={row.onPress}>
                <Text style={[styles.rowTitle, isArabic ? rtlText : ltrText]}>{isArabic ? row.labelAr : row.labelEn}</Text>
                {row.active ? <Ionicons name="checkmark-circle" size={20} color="#630E13" /> : <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={17} color="#A18F7A" />}
              </Pressable>
            ))
          ) : (
            <>
              <View style={[styles.row, isArabic ? rtlRow : ltrRow]}>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'الإشعارات' : 'Notifications'}</Text>
                  <Text style={[styles.rowSubtitle, isArabic ? rtlText : ltrText]}>
                    {pushStatus === 'enabled'
                      ? 'Enabled'
                      : pushStatus === 'unavailable'
                      ? 'Needs a physical device'
                      : 'Tap to enable push alerts'}
                  </Text>
                </View>
                {isActivatingPush ? (
                  <ActivityIndicator color="#630E13" />
                ) : (
                  <Switch
                    value={notificationsOn}
                    disabled={pushStatus === 'unavailable'}
                    onValueChange={(enabled) => void handleNotificationsToggle(enabled)}
                    trackColor={{ true: '#D7BDA7', false: '#E5DDD2' }}
                    thumbColor={notificationsOn ? '#630E13' : '#fff'}
                  />
                )}
              </View>
              <View style={[styles.row, isArabic ? rtlRow : ltrRow]}>
                <Text style={[styles.rowTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'ملف عام' : 'Public profile'}</Text>
                <Switch value={publicProfile} onValueChange={setPublicProfile} trackColor={{ true: '#D7BDA7', false: '#E5DDD2' }} thumbColor={publicProfile ? '#630E13' : '#fff'} />
              </View>
              <View style={[styles.row, isArabic ? rtlRow : ltrRow]}>
                <Text style={[styles.rowTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'تحديثات المسارات' : 'Trail updates'}</Text>
                <Switch value={trailUpdates} onValueChange={setTrailUpdates} trackColor={{ true: '#D7BDA7', false: '#E5DDD2' }} thumbColor={trailUpdates ? '#630E13' : '#fff'} />
              </View>
            </>
          )}
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
  subtitle: { marginTop: 4, color: '#7B6D5A', fontSize: 13, lineHeight: 19 },
  badge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7EBE8' },
  card: { overflow: 'hidden', borderRadius: 24, backgroundColor: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1E5D8' },
  rowCopy: { flex: 1 },
  rowTitle: { flex: 1, color: '#2C2418', fontSize: 15, fontWeight: '800' },
  rowSubtitle: { marginTop: 4, color: '#7B6D5A', fontSize: 12, lineHeight: 17, fontWeight: '700' },
});
