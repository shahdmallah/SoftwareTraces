import React, { useMemo, useState } from 'react';
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

type PlanJoinRouteProp = RouteProp<RootStackParamList, 'ActivityPlanJoin'>;
type PlanJoinNavigationProp = StackNavigationProp<RootStackParamList, 'ActivityPlanJoin'>;

export function ActivityPlanJoinScreen() {
  const route = useRoute<PlanJoinRouteProp>();
  const navigation = useNavigation<PlanJoinNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const { plan } = route.params;

  const [joined, setJoined] = useState(false);
  const [guests, setGuests] = useState(0);

  const totalJoining = joined ? guests + 1 : 0;
  const peopleJoined = plan.peopleJoined + totalJoining;
  const spotsLeft = Math.max(0, plan.spotsLeft - totalJoining);
  const canAddGuest = joined && spotsLeft > 0 && guests < 5;

  const meetupTraits = useMemo(() => {
    const text = [plan.vibeEn, plan.noteEn].join(' ').toLowerCase();
    return [
      text.includes('easy') || text.includes('gentle') || text.includes('beginner')
        ? isArabic ? 'سهل' : 'Easy'
        : null,
      text.includes('child') || text.includes('kid') || text.includes('family')
        ? isArabic ? 'مناسب للأطفال' : 'Child friendly'
        : null,
      text.includes('photo') || text.includes('sunset')
        ? isArabic ? 'تصوير' : 'Photo friendly'
        : null,
    ].filter(Boolean) as string[];
  }, [isArabic, plan.noteEn, plan.vibeEn]);

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(28, insets.bottom + 22) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedBlock delay={40}>
          <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
            <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
              <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{isArabic ? 'الانضمام للقاء' : 'Join meetup'}</Text>
              <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                {isArabic ? plan.destinationAr : plan.destinationEn}
              </Text>
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={80}>
          <View style={styles.hero}>
            <Image source={{ uri: plan.cover }} style={styles.heroImage} resizeMode="cover" />
            <LinearGradient colors={['rgba(15,10,7,0.08)', 'rgba(15,10,7,0.82)']} style={styles.heroOverlay}>
              <Text style={[styles.heroTitle, isArabic ? rtlText : ltrText]}>{isArabic ? plan.destinationAr : plan.destinationEn}</Text>
              <Text style={[styles.heroDate, isArabic ? rtlText : ltrText]}>{isArabic ? plan.dateAr : plan.dateEn}</Text>
            </LinearGradient>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={110}>
          <View style={styles.card}>
            <View style={[styles.hostRow, isArabic ? rtlRow : ltrRow]}>
              <Image source={{ uri: plan.avatar }} style={styles.avatar} />
              <View style={styles.hostCopy}>
                <Text style={[styles.hostName, isArabic ? rtlText : ltrText]}>{plan.user}</Text>
                <Text style={[styles.hostHandle, isArabic ? rtlText : ltrText]}>{plan.handle}</Text>
              </View>
            </View>
            <Text style={[styles.note, isArabic ? rtlText : ltrText]}>{isArabic ? plan.noteAr : plan.noteEn}</Text>
            <View style={[styles.pillRow, isArabic ? rtlRow : ltrRow]}>
              <View style={styles.pill}>
                <Ionicons name="people-outline" size={15} color="#630E13" />
                <Text style={styles.pillText}>{isArabic ? `${peopleJoined} منضمون` : `${peopleJoined} joined`}</Text>
              </View>
              <View style={styles.pill}>
                <Ionicons name="sparkles-outline" size={15} color="#630E13" />
                <Text style={styles.pillText}>{isArabic ? `${spotsLeft} أماكن` : `${spotsLeft} spots left`}</Text>
              </View>
            </View>
            {meetupTraits.length ? (
              <View style={[styles.traitRow, isArabic ? rtlRow : ltrRow]}>
                {meetupTraits.map((trait) => (
                  <Text key={trait} style={styles.trait}>{trait}</Text>
                ))}
              </View>
            ) : null}
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={140}>
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>
              {isArabic ? 'حضورك' : 'Your attendance'}
            </Text>
            <Pressable
              style={[styles.joinButton, joined && styles.joinButtonActive]}
              onPress={() => {
                setJoined((current) => !current);
                if (joined) setGuests(0);
              }}
            >
              <Ionicons name={joined ? 'checkmark-circle' : 'person-add-outline'} size={18} color={joined ? '#fff' : '#630E13'} />
              <Text style={[styles.joinButtonText, joined && styles.joinButtonTextActive]}>
                {joined ? (isArabic ? 'أنا منضم' : "I'm joining") : isArabic ? 'سأنضم' : "I'm joining"}
              </Text>
            </Pressable>

            {joined ? (
              <View style={[styles.guestRow, isArabic ? rtlRow : ltrRow]}>
                <Text style={[styles.guestLabel, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'عدد الأشخاص معي' : 'People with me'}
                </Text>
                <View style={[styles.stepper, isArabic ? rtlRow : ltrRow]}>
                  <Pressable
                    style={[styles.stepperButton, guests === 0 && styles.stepperButtonDisabled]}
                    onPress={() => setGuests((value) => Math.max(0, value - 1))}
                    disabled={guests === 0}
                  >
                    <Ionicons name="remove" size={15} color="#2C2418" />
                  </Pressable>
                  <Text style={styles.stepperValue}>{guests}</Text>
                  <Pressable
                    style={[styles.stepperButton, !canAddGuest && styles.stepperButtonDisabled]}
                    onPress={() => setGuests((value) => Math.min(5, value + 1))}
                    disabled={!canAddGuest}
                  >
                    <Ionicons name="add" size={15} color="#2C2418" />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </AnimatedBlock>

        <Pressable style={styles.trailButton} onPress={() => navigation.navigate('TrailDetail', { trailId: plan.trailId })}>
          <Ionicons name="map-outline" size={18} color="#fff" />
          <Text style={styles.trailButtonText}>{isArabic ? 'عرض المسار' : 'View trail'}</Text>
        </Pressable>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED' },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, fontWeight: '900', color: '#2C2418' },
  subtitle: { marginTop: 3, fontSize: 13, color: '#7B6D5A' },
  hero: { height: 310, borderRadius: 22, overflow: 'hidden', backgroundColor: '#E7D8C3' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', padding: 18 },
  heroTitle: { fontSize: 25, lineHeight: 31, fontWeight: '900', color: '#fff' },
  heroDate: { marginTop: 8, fontSize: 14, fontWeight: '900', color: '#F0DCAA' },
  card: { marginTop: 14, borderRadius: 20, padding: 15, backgroundColor: '#FFFFFF' },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E7D8C3' },
  hostCopy: { flex: 1, minWidth: 0 },
  hostName: { fontSize: 15, fontWeight: '900', color: '#2C2418' },
  hostHandle: { marginTop: 2, fontSize: 12, color: '#8A7A6A' },
  note: { marginTop: 14, fontSize: 14, lineHeight: 21, color: '#43382C' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F6E9DE',
  },
  pillText: { fontSize: 12, fontWeight: '900', color: '#630E13' },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  trait: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#FFF8F1',
    color: '#5A4F41',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#2C2418', marginBottom: 12 },
  joinButton: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  joinButtonActive: { backgroundColor: '#630E13', borderColor: '#630E13' },
  joinButtonText: { fontSize: 14, fontWeight: '900', color: '#630E13' },
  joinButtonTextActive: { color: '#FFFFFF' },
  guestRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  guestLabel: { flex: 1, fontSize: 13, fontWeight: '800', color: '#5A4F41' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6E9DE',
  },
  stepperButtonDisabled: { opacity: 0.35 },
  stepperValue: { minWidth: 26, textAlign: 'center', fontSize: 15, fontWeight: '900', color: '#2C2418' },
  trailButton: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#630E13',
  },
  trailButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
