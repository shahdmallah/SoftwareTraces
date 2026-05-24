import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { getMeetup, joinMeetup, leaveMeetup, type Meetup } from '../api/meetupsApi';
import { getWeatherForecast, type WeatherForecast } from '../api/weatherApi';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';
import { formatPercent, formatTemperature, formatWind, getWeatherVisual } from '../utils/weatherUtils';

type PlanJoinRouteProp = RouteProp<RootStackParamList, 'ActivityPlanJoin'>;
type PlanJoinNavigationProp = StackNavigationProp<RootStackParamList, 'ActivityPlanJoin'>;

function hasImageUri(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? 'T'}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

function formatMeetupDate(value: string | undefined, locale: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatVisibility(value: string | undefined, isArabic: boolean) {
  if (value === 'private') return isArabic ? 'خاص' : 'Private';
  if (value === 'friends') return isArabic ? 'للأصدقاء' : 'Friends';
  return isArabic ? 'عام' : 'Public';
}

function stripKnownLabel(value: string) {
  return value
    .replace(/^(meet|meeting place|weather|bring|نقطة اللقاء|أحضر)\s*:\s*/i, '')
    .trim();
}

function parseMeetupNote(note: string, meetingPlace: string, bringItems: string[]) {
  const parts = note
    .split(/\s+[·•]\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const description: string[] = [];
  let weather = '';
  let meeting = meetingPlace;
  let bring = bringItems.join(', ');

  parts.forEach((part) => {
    const normalized = part.toLowerCase();

    if (normalized.startsWith('weather:')) {
      weather = stripKnownLabel(part);
      return;
    }

    if (normalized.startsWith('meet:') || normalized.startsWith('meeting place:') || part.startsWith('نقطة اللقاء')) {
      meeting = meeting || stripKnownLabel(part);
      return;
    }

    if (normalized.startsWith('bring:') || part.startsWith('أحضر')) {
      bring = bring || stripKnownLabel(part);
      return;
    }

    description.push(part);
  });

  return { description, weather, meeting, bring };
}

function parseBringItems(note: string, bringItems: string[]) {
  if (bringItems.length) return bringItems;

  return note
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ActivityPlanJoinScreen() {
  const route = useRoute<PlanJoinRouteProp>();
  const navigation = useNavigation<PlanJoinNavigationProp>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const { plan } = route.params;

  const [joined, setJoined] = useState(plan.viewerStatus === 'joined' || plan.viewerStatus === 'host');
  const [guests, setGuests] = useState(0);
  const [peopleJoinedBase, setPeopleJoinedBase] = useState(plan.peopleJoined);
  const [spotsLeftBase, setSpotsLeftBase] = useState(plan.spotsLeft);
  const [viewerStatus, setViewerStatus] = useState(plan.viewerStatus);
  const [meetupDetails, setMeetupDetails] = useState<Meetup | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMeetup, setIsLoadingMeetup] = useState(Boolean(plan.meetupId));
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!plan.meetupId) {
      setIsLoadingMeetup(false);
      return () => { cancelled = true; };
    }

    const loadMeetup = async () => {
      setIsLoadingMeetup(true);
      try {
        const meetup = await getMeetup(plan.meetupId!);
        if (!cancelled) {
          setMeetupDetails(meetup);
          setPeopleJoinedBase(meetup.people_joined);
          setSpotsLeftBase(meetup.spots_left);
          setViewerStatus(meetup.viewer_status);
          setJoined(meetup.viewer_status === 'joined' || meetup.viewer_status === 'host');
        }
      } catch {
        if (!cancelled) {
          Alert.alert(isArabic ? 'تعذر تحميل اللقاء' : 'Unable to load meetup', isArabic ? 'حاول مرة أخرى لاحقا.' : 'Please try again later.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMeetup(false);
        }
      }
    };

    void loadMeetup();
    return () => { cancelled = true; };
  }, [isArabic, plan.meetupId]);

  useEffect(() => {
    let cancelled = false;

    if (
      typeof meetupDetails?.meeting_latitude !== 'number' ||
      typeof meetupDetails?.meeting_longitude !== 'number' ||
      !meetupDetails?.starts_at
    ) {
      setWeather(null);
      setWeatherError(false);
      return () => { cancelled = true; };
    }

    const loadWeather = async () => {
      try {
        const forecast = await getWeatherForecast({
          lat: meetupDetails.meeting_latitude!,
          lng: meetupDetails.meeting_longitude!,
          date: meetupDetails.starts_at.slice(0, 10),
        });

        if (!cancelled) {
          setWeather(forecast);
          setWeatherError(false);
        }
      } catch {
        if (!cancelled) {
          setWeather(null);
          setWeatherError(true);
        }
      }
    };

    void loadWeather();
    return () => { cancelled = true; };
  }, [meetupDetails?.meeting_latitude, meetupDetails?.meeting_longitude, meetupDetails?.starts_at]);

  const peopleJoined = peopleJoinedBase;
  const spotsLeft = Math.max(0, spotsLeftBase);
  const canAddGuest = !joined && spotsLeft > guests + 1 && guests < 5;
  const isHost = viewerStatus === 'host';
  const title = isArabic
    ? meetupDetails?.title_ar || meetupDetails?.title || plan.destinationAr
    : meetupDetails?.title || plan.destinationEn;
  const note = isArabic
    ? meetupDetails?.note_ar || meetupDetails?.note || plan.noteAr
    : meetupDetails?.note || plan.noteEn;
  const vibe = isArabic
    ? meetupDetails?.vibe_ar || meetupDetails?.vibe || plan.vibeAr
    : meetupDetails?.vibe || plan.vibeEn;
  const dateLabel = formatMeetupDate(meetupDetails?.starts_at, isArabic ? 'ar-SA' : 'en-US') || (isArabic ? plan.dateAr : plan.dateEn);
  const coverUri = hasImageUri(meetupDetails?.cover_url) ? meetupDetails.cover_url.trim() : plan.cover;
  const hostName = meetupDetails?.host.full_name || plan.user;
  const hostHandle = meetupDetails?.host.username
    ? meetupDetails.host.username.startsWith('@') ? meetupDetails.host.username : `@${meetupDetails.host.username}`
    : plan.handle;
  const hostAvatar = meetupDetails?.host.avatar_url || plan.avatar;
  const meetingPlace = meetupDetails?.meeting_place || '';
  const visibilityLabel = formatVisibility(meetupDetails?.visibility || plan.visibility, isArabic);
  const maxHeadcount = meetupDetails?.max_headcount;
  const bringItems = meetupDetails?.bring_items ?? [];
  const hasCoordinates = typeof meetupDetails?.meeting_latitude === 'number' && typeof meetupDetails?.meeting_longitude === 'number';
  const noteSections = useMemo(() => parseMeetupNote(note, meetingPlace, bringItems), [bringItems, meetingPlace, note]);
  const descriptionText = note || vibe;
  const displayNote = descriptionText;
  const displayBringItems = useMemo(() => parseBringItems(note, bringItems), [bringItems, note]);
  const weatherVisual = weather ? getWeatherVisual(weather.condition, weather.is_daytime) : null;
  const trailId = meetupDetails?.trail_id || plan.trailId;
  const invitedCount = meetupDetails?.invited_user_ids?.length ?? plan.invitedNames?.length ?? 0;
  const viewerStatusLabel = isHost
    ? isArabic ? 'أنت المضيف' : 'Host'
    : joined
      ? isArabic ? 'منضم' : 'Joined'
      : viewerStatus === 'invited'
        ? isArabic ? 'مدعو' : 'Invited'
        : isArabic ? 'غير منضم' : 'Not joined';

  const updateAttendance = async () => {
    const meetupId = plan.meetupId;
    if (!meetupId) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (joined) {
        const result = await leaveMeetup(meetupId);
        setJoined(false);
        setGuests(0);
        setViewerStatus('none');
        setPeopleJoinedBase(result.people_joined);
        setSpotsLeftBase(result.spots_left);
      } else {
        const result = await joinMeetup(meetupId, guests);
        setJoined(true);
        setViewerStatus('joined');
        setPeopleJoinedBase(result.people_joined);
        setSpotsLeftBase(result.spots_left);
      }
    } catch (error) {
      Alert.alert(
        isArabic ? 'تعذر تحديث الحضور' : 'Unable to update attendance',
        error instanceof Error ? error.message : isArabic ? 'حاول مرة أخرى.' : 'Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleJoin = async () => {
    if (!plan.meetupId) {
      setJoined((current) => !current);
      if (joined) setGuests(0);
      return;
    }

    if (isHost) {
      Alert.alert(
        isArabic ? 'أنت المضيف' : 'You are hosting',
        isArabic
          ? 'لا يوجد حالياً مسار من الخادم لإلغاء أو حذف لقاء قمت باستضافته.'
          : 'There is no backend endpoint yet to cancel or delete a meetup you host.',
      );
      return;
    }

    if (joined) {
      Alert.alert(
        isArabic ? 'مغادرة اللقاء؟' : 'Leave meetup?',
        isArabic ? 'سيتم إلغاء حضورك لهذا اللقاء.' : 'This will cancel your attendance for this meetup.',
        [
          { text: isArabic ? 'تراجع' : 'Keep joined', style: 'cancel' },
          {
            text: isArabic ? 'مغادرة' : 'Leave meetup',
            style: 'destructive',
            onPress: () => void updateAttendance(),
          },
        ],
      );
      return;
    }

    await updateAttendance();
  };

  const meetupTraits = useMemo(() => {
    const text = [vibe, note].join(' ').toLowerCase();
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
  }, [isArabic, note, vibe]);

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
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={80}>
          <View style={styles.hero}>
            {hasImageUri(coverUri) ? (
              <Image source={{ uri: coverUri }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImage, styles.heroImageFallback]}>
                <Ionicons name="images-outline" size={32} color="#D7BDA7" />
              </View>
            )}
            <LinearGradient colors={['rgba(15,10,7,0.08)', 'rgba(15,10,7,0.82)']} style={styles.heroOverlay}>
              <Text style={[styles.heroTitle, isArabic ? rtlText : ltrText]}>{title}</Text>
              <Text style={[styles.heroDate, isArabic ? rtlText : ltrText]}>{dateLabel}</Text>
            </LinearGradient>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={110}>
          <View style={styles.card}>
            <View style={[styles.hostRow, isArabic ? rtlRow : ltrRow]}>
              {hasImageUri(hostAvatar) ? (
                <Image source={{ uri: hostAvatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>{getInitials(hostName)}</Text>
                </View>
              )}
              <View style={styles.hostCopy}>
                <Text style={[styles.hostName, isArabic ? rtlText : ltrText]}>{hostName}</Text>
                <Text style={[styles.hostHandle, isArabic ? rtlText : ltrText]}>{hostHandle}</Text>
              </View>
            </View>
            {vibe && vibe !== displayNote ? <Text style={[styles.vibe, isArabic ? rtlText : ltrText]}>{vibe}</Text> : null}
            <Text style={[styles.note, isArabic ? rtlText : ltrText]}>{displayNote}</Text>
            {isLoadingMeetup ? (
              <View style={[styles.loadingRow, isArabic ? rtlRow : ltrRow]}>
                <ActivityIndicator size="small" color="#630E13" />
                <Text style={[styles.loadingText, isArabic ? rtlText : ltrText]}>
                  {isArabic ? 'جار تحديث تفاصيل اللقاء...' : 'Refreshing meetup details...'}
                </Text>
              </View>
            ) : null}
            <View style={[styles.pillRow, isArabic ? rtlRow : ltrRow]}>
              <View style={styles.pill}>
                <Ionicons name="people-outline" size={15} color="#630E13" />
                <Text style={styles.pillText}>{isArabic ? `${peopleJoined} منضمون` : `${peopleJoined} joined`}</Text>
              </View>
              <View style={styles.pill}>
                <Ionicons name="sparkles-outline" size={15} color="#630E13" />
                <Text style={styles.pillText}>{isArabic ? `${spotsLeft} أماكن` : `${spotsLeft} spots left`}</Text>
              </View>
              {maxHeadcount ? (
                <View style={styles.pill}>
                  <Ionicons name="person-outline" size={15} color="#630E13" />
                  <Text style={styles.pillText}>{isArabic ? `${maxHeadcount} كحد أقصى` : `${maxHeadcount} max`}</Text>
                </View>
              ) : null}
              <View style={styles.pill}>
                <Ionicons name="lock-open-outline" size={15} color="#630E13" />
                <Text style={styles.pillText}>{visibilityLabel}</Text>
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

        {descriptionText ? (
          <AnimatedBlock delay={118}>
            <View style={styles.card}>
              <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>
                {isArabic ? 'الملاحظات' : 'Notes'}
              </Text>
              <Text style={[styles.note, isArabic ? rtlText : ltrText]}>{displayNote}</Text>
            </View>
          </AnimatedBlock>
        ) : null}

        <AnimatedBlock delay={125}>
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>
              {isArabic ? 'تفاصيل اللقاء' : 'Meetup details'}
            </Text>
            <View style={styles.detailList}>
              <View style={[styles.detailRow, isArabic ? rtlRow : ltrRow]}>
                <View style={styles.detailIcon}>
                  <Ionicons name="time-outline" size={17} color="#630E13" />
                </View>
                <View style={styles.detailCopy}>
                  <Text style={[styles.detailLabel, isArabic ? rtlText : ltrText]}>{isArabic ? 'الوقت' : 'Time'}</Text>
                  <Text style={[styles.detailValue, isArabic ? rtlText : ltrText]}>{dateLabel}</Text>
                </View>
              </View>
              <View style={[styles.detailRow, isArabic ? rtlRow : ltrRow]}>
                <View style={styles.detailIcon}>
                  <Ionicons name="people-outline" size={17} color="#630E13" />
                </View>
                <View style={styles.detailCopy}>
                  <Text style={[styles.detailLabel, isArabic ? rtlText : ltrText]}>{isArabic ? 'المقاعد' : 'Capacity'}</Text>
                  <Text style={[styles.detailValue, isArabic ? rtlText : ltrText]}>
                    {isArabic
                      ? `${peopleJoined} منضمون · ${spotsLeft} أماكن متبقية${maxHeadcount ? ` · ${maxHeadcount} كحد أقصى` : ''}`
                      : `${peopleJoined} joined · ${spotsLeft} spots left${maxHeadcount ? ` · ${maxHeadcount} max` : ''}`}
                  </Text>
                </View>
              </View>
              <View style={[styles.detailRow, isArabic ? rtlRow : ltrRow]}>
                <View style={styles.detailIcon}>
                  <Ionicons name="shield-checkmark-outline" size={17} color="#630E13" />
                </View>
                <View style={styles.detailCopy}>
                  <Text style={[styles.detailLabel, isArabic ? rtlText : ltrText]}>{isArabic ? 'الحالة والخصوصية' : 'Status and privacy'}</Text>
                  <Text style={[styles.detailValue, isArabic ? rtlText : ltrText]}>{viewerStatusLabel} · {visibilityLabel}</Text>
                  {invitedCount > 0 ? (
                    <Text style={[styles.detailMeta, isArabic ? rtlText : ltrText]}>
                      {isArabic ? `${invitedCount} مدعوين` : `${invitedCount} invited`}
                    </Text>
                  ) : null}
                </View>
              </View>
              {trailId ? (
                <Pressable style={[styles.detailRow, isArabic ? rtlRow : ltrRow]} onPress={() => navigation.navigate('TrailDetail', { trailId })}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="map-outline" size={17} color="#630E13" />
                  </View>
                  <View style={styles.detailCopy}>
                    <Text style={[styles.detailLabel, isArabic ? rtlText : ltrText]}>{isArabic ? 'المسار' : 'Trail'}</Text>
                    <Text style={[styles.detailValue, isArabic ? rtlText : ltrText]}>{title}</Text>
                    <Text style={[styles.detailMeta, isArabic ? rtlText : ltrText]}>{isArabic ? 'افتح تفاصيل المسار' : 'Open trail details'}</Text>
                  </View>
                  <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={16} color="#8A7A6A" />
                </Pressable>
              ) : null}
              {meetingPlace ? (
                <View style={[styles.detailRow, isArabic ? rtlRow : ltrRow]}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="location-outline" size={17} color="#630E13" />
                  </View>
                  <View style={styles.detailCopy}>
                    <Text style={[styles.detailLabel, isArabic ? rtlText : ltrText]}>{isArabic ? 'مكان اللقاء' : 'Meeting place'}</Text>
                    <Text style={[styles.detailValue, isArabic ? rtlText : ltrText]}>{meetingPlace}</Text>
                    {hasCoordinates ? (
                      <Text style={[styles.detailMeta, isArabic ? rtlText : ltrText]}>
                        {meetupDetails!.meeting_latitude!.toFixed(4)}, {meetupDetails!.meeting_longitude!.toFixed(4)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
              {weather ? (
                <View style={[styles.detailRow, isArabic ? rtlRow : ltrRow]}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="partly-sunny-outline" size={17} color="#630E13" />
                  </View>
                  <View style={styles.detailCopy}>
                    <Text style={[styles.detailLabel, isArabic ? rtlText : ltrText]}>{isArabic ? 'الطقس المتوقع' : 'Weather forecast'}</Text>
                    <Text style={[styles.detailValue, isArabic ? rtlText : ltrText]}>
                      {weatherVisual ? `${weatherVisual.emoji} ` : ''}{weather?.condition}
                    </Text>
                    <Text style={[styles.detailMeta, isArabic ? rtlText : ltrText]}>
                      {weather ? `${formatTemperature(weather.high_c)} / ${formatTemperature(weather.low_c)} · ${formatPercent(weather.precipitation_probability)} rain · ${formatWind(weather.wind_kph)}` : ''}
                    </Text>
                  </View>
                </View>
              ) : null}
              {displayBringItems.length ? (
                <View style={[styles.detailRow, isArabic ? rtlRow : ltrRow]}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="bag-handle-outline" size={17} color="#630E13" />
                  </View>
                  <View style={styles.detailCopy}>
                    <Text style={[styles.detailLabel, isArabic ? rtlText : ltrText]}>{isArabic ? 'ما يجب إحضاره' : 'What to bring'}</Text>
                    <View style={[styles.bringRow, isArabic ? rtlRow : ltrRow]}>
                      {displayBringItems.map((item) => (
                        <Text key={item} style={styles.bringChip}>{item}</Text>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={140}>
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>
              {isArabic ? 'حضورك' : 'Your attendance'}
            </Text>
            <Pressable
              style={[styles.joinButton, joined && styles.joinButtonActive]}
              onPress={handleToggleJoin}
              disabled={isSubmitting || isLoadingMeetup || isHost}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={joined ? '#fff' : '#630E13'} />
              ) : (
                <Ionicons name={joined ? 'checkmark-circle' : 'person-add-outline'} size={18} color={joined ? '#fff' : '#630E13'} />
              )}
              <Text style={[styles.joinButtonText, joined && styles.joinButtonTextActive]}>
                {isHost
                  ? isArabic ? 'أنت المضيف' : 'You are hosting'
                  : joined
                    ? isArabic ? 'مغادرة اللقاء' : 'Leave meetup'
                    : isArabic ? 'سأنضم' : "I'm joining"}
              </Text>
            </Pressable>

            {!joined && !isHost ? (
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

        {trailId ? (
        <Pressable style={styles.trailButton} onPress={() => navigation.navigate('TrailDetail', { trailId })}>
          <Ionicons name="map-outline" size={18} color="#fff" />
          <Text style={styles.trailButtonText}>{isArabic ? 'عرض المسار' : 'View trail'}</Text>
        </Pressable>
        ) : null}
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
  heroImageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#3A2E22' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', padding: 18 },
  heroTitle: { fontSize: 25, lineHeight: 31, fontWeight: '900', color: '#fff' },
  heroDate: { marginTop: 8, fontSize: 14, fontWeight: '900', color: '#F0DCAA' },
  card: { marginTop: 14, borderRadius: 20, padding: 15, backgroundColor: '#FFFFFF' },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E7D8C3' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6E9DE', borderWidth: 1, borderColor: '#E7D8C3' },
  avatarFallbackText: { color: '#630E13', fontSize: 13, fontWeight: '900' },
  hostCopy: { flex: 1, minWidth: 0 },
  hostName: { fontSize: 15, fontWeight: '900', color: '#2C2418' },
  hostHandle: { marginTop: 2, fontSize: 12, color: '#8A7A6A' },
  vibe: { marginTop: 14, fontSize: 13, lineHeight: 19, fontWeight: '900', color: '#630E13' },
  note: { marginTop: 14, fontSize: 14, lineHeight: 21, color: '#43382C' },
  loadingRow: { alignItems: 'center', gap: 8, marginTop: 12 },
  loadingText: { flex: 1, color: '#6B5D4E', fontSize: 12, fontWeight: '800' },
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
  detailList: { gap: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6E9DE',
  },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: { fontSize: 12, fontWeight: '900', color: '#8A7A6A' },
  detailValue: { marginTop: 3, fontSize: 14, lineHeight: 20, fontWeight: '800', color: '#2C2418' },
  detailMeta: { marginTop: 3, fontSize: 12, color: '#8A7A6A' },
  descriptionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  descriptionChip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#F6E9DE',
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  bringRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  bringChip: {
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

