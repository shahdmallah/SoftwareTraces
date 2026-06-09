import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ActivityIndicator as PaperActivityIndicator, Card, ProgressBar, Text as PaperText } from 'react-native-paper';
import type { Feature, FeatureCollection, Point } from 'geojson';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { createMeetup } from '../api/meetupsApi';
import { uploadMedia, type ReactNativeFile } from '../api/mediaApi';
import { hasDetectedSpecies, identifySpeciesDetails, type SpeciesIdentification, type SpeciesPrediction } from '../api/speciesApi';
import { getFollowers, getFollowing, type SocialProfile } from '../api/socialApi';
import { getTrails, type Trail } from '../api/trailsApi';
import { getWeatherForecast, type WeatherForecast } from '../api/weatherApi';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';
import { formatPercent, formatTemperature, formatWind, getWeatherVisual } from '../utils/weatherUtils';

type ComposerRouteProp = RouteProp<RootStackParamList, 'ActivityShareComposer'>;
type ComposerNavigationProp = StackNavigationProp<RootStackParamList, 'ActivityShareComposer'>;
type MapboxModule = typeof import('@rnmapbox/maps');
type LngLat = [number, number];
type PlanVisibility = 'public' | 'private' | 'friends';
type DeparturePeriod = 'AM' | 'PM';
type SpeciesResultTab = 'details' | 'ecology' | 'funfacts';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
const MAPBOX_STYLE_URL =
  process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/shahdmallah/cmnqgt687000h01s66inve68a';
const DEFAULT_MEETING_COORDINATE: LngLat = [35.22, 31.9];

const BRING_OPTIONS = [
  { en: 'Water', ar: 'ماء' },
  { en: 'Hat', ar: 'قبعة' },
  { en: 'Sunscreen', ar: 'واقي شمس' },
  { en: 'Light jacket', ar: 'معطف خفيف' },
  { en: 'Warm layer', ar: 'طبقة دافئة' },
  { en: 'Rain jacket', ar: 'معطف مطر' },
  { en: 'Snacks', ar: 'وجبات خفيفة' },
  { en: 'Lunch', ar: 'غداء' },
  { en: 'Electrolytes', ar: 'أملاح وسوائل' },
  { en: 'First aid kit', ar: 'حقيبة إسعاف' },
  { en: 'Power bank', ar: 'شاحن متنقل' },
  { en: 'Headlamp', ar: 'مصباح رأس' },
  { en: 'Trekking poles', ar: 'عصي مشي' },
  { en: 'Offline map', ar: 'خريطة بدون إنترنت' },
  { en: 'ID or permit', ar: 'هوية أو تصريح' },
  { en: 'Personal medication', ar: 'أدوية شخصية' },
  { en: 'Comfortable shoes', ar: 'حذاء مريح' },
];

const TRIP_DESCRIPTION_OPTIONS = [
  { en: 'Adults only', ar: 'للبالغين فقط' },
  { en: 'Kids welcome', ar: 'الأطفال مرحب بهم' },
  { en: 'Teen friendly', ar: 'مناسب للمراهقين' },
  { en: 'Family friendly', ar: 'مناسب للعائلة' },
  { en: 'Beginner friendly', ar: 'مناسب للمبتدئين' },
  { en: 'Some hiking experience', ar: 'يحتاج خبرة مشي بسيطة' },
  { en: 'Experienced hikers', ar: 'للمتمرسين' },
  { en: 'Easy pace', ar: 'وتيرة سهلة' },
  { en: 'Moderate pace', ar: 'وتيرة متوسطة' },
  { en: 'Strong pace', ar: 'وتيرة قوية' },
  { en: 'Low intensity', ar: 'جهد خفيف' },
  { en: 'Moderate fitness needed', ar: 'يحتاج لياقة متوسطة' },
  { en: 'High stamina needed', ar: 'يحتاج تحمل عالي' },
  { en: 'Challenging climbs', ar: 'صعود صعب' },
  { en: 'Photo stops', ar: 'توقفات للتصوير' },
  { en: 'Coffee stop', ar: 'استراحة قهوة' },
  { en: 'Sunset walk', ar: 'مشي وقت الغروب' },
  { en: 'Quiet nature route', ar: 'مسار طبيعي هادئ' },
];

let Mapbox: MapboxModule | null = null;
let mapboxLoadError: string | null = null;

try {
  // Load Mapbox lazily so Expo Go or stale native builds can still use the rest of the composer.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Mapbox = require('@rnmapbox/maps') as MapboxModule;
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
} catch (error) {
  mapboxLoadError = error instanceof Error ? error.message : 'Mapbox native code not available.';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDateOptions(language: string): { value: string; label: string; iso: string }[] {
  const today = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      iso: d.toISOString(),
      value: d.toISOString(),
      label: new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(d),
    };
  });
}

// ─── Reusable field row ────────────────────────────────────────────────────────

type FieldRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  isArabic: boolean;
  children: React.ReactNode;
};

function FieldRow({ icon, label, isArabic, children }: FieldRowProps) {
  return (
    <View style={fieldStyles.wrap}>
      <View style={[fieldStyles.labelRow, isArabic ? rtlRow : ltrRow]}>
        <Ionicons name={icon} size={14} color="#630E13" />
        <Text style={[fieldStyles.label, isArabic ? rtlText : ltrText]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginTop: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '800', color: '#6B5D4E', textTransform: 'uppercase', letterSpacing: 0.4 },
});

// ─── Select pill (opens a modal) ──────────────────────────────────────────────

type SelectPillProps = {
  value: string;
  placeholder: string;
  isArabic: boolean;
  onPress: () => void;
  iconRight?: keyof typeof Ionicons.glyphMap;
};

function SelectPill({ value, placeholder, isArabic, onPress, iconRight = 'chevron-down-outline' }: SelectPillProps) {
  return (
    <Pressable style={[pillStyles.pill, isArabic && pillStyles.pillRtl]} onPress={onPress}>
      <Text style={[pillStyles.text, !value && pillStyles.placeholder, isArabic ? rtlText : ltrText]} numberOfLines={1}>
        {value || placeholder}
      </Text>
      <Ionicons name={iconRight} size={17} color="#8A7A6A" />
    </Pressable>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: '#FFF8F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pillRtl: { flexDirection: 'row-reverse' },
  text: { flex: 1, fontSize: 14, color: '#2C2418' },
  placeholder: { color: '#A18F7A' },
});

// ─── Reusable bottom-sheet modal ──────────────────────────────────────────────

function formatDepartureTime(hour: number, minute: number, period: DeparturePeriod) {
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
}

function buildStartsAtIso(dateIso: string, hour: number, minute: number, period: DeparturePeriod) {
  const date = dateIso ? new Date(dateIso) : new Date();
  const normalizedHour = period === 'PM' ? (hour % 12) + 12 : hour % 12;
  date.setHours(normalizedHour, minute, 0, 0);
  return date.toISOString();
}

function imageUriToFile(uri: string): ReactNativeFile {
  const cleanName = uri.split('/').pop()?.split('?')[0] || `meetup-cover-${Date.now()}.jpg`;
  const extension = cleanName.split('.').pop()?.toLowerCase();
  const type = extension === 'png'
    ? 'image/png'
    : extension === 'webp'
      ? 'image/webp'
      : extension === 'gif'
        ? 'image/gif'
        : 'image/jpeg';

  return { uri, name: cleanName, type };
}

type DepartureTimePickerProps = {
  visible: boolean;
  hour: number;
  minute: number;
  period: DeparturePeriod;
  isArabic: boolean;
  onClose: () => void;
  onConfirm: (hour: number, minute: number, period: DeparturePeriod) => void;
};

function DepartureTimePicker({ visible, hour, minute, period, isArabic, onClose, onConfirm }: DepartureTimePickerProps) {
  const [draftHour, setDraftHour] = useState(hour);
  const [draftMinute, setDraftMinute] = useState(minute);
  const [draftPeriod, setDraftPeriod] = useState<DeparturePeriod>(period);

  useEffect(() => {
    if (!visible) return;
    setDraftHour(hour);
    setDraftMinute(minute);
    setDraftPeriod(period);
  }, [hour, minute, period, visible]);

  const bumpHour = (delta: number) => {
    setDraftHour((current) => {
      const next = current + delta;
      if (next > 12) return 1;
      if (next < 1) return 12;
      return next;
    });
  };

  const bumpMinute = (delta: number) => {
    setDraftMinute((current) => {
      const next = current + delta;
      if (next >= 60) return 0;
      if (next < 0) return 55;
      return next;
    });
  };

  const quickTimes: Array<{ hour: number; minute: number; period: DeparturePeriod; icon: keyof typeof Ionicons.glyphMap }> = [
    { hour: 5, minute: 30, period: 'AM', icon: 'sunny-outline' },
    { hour: 6, minute: 0, period: 'AM', icon: 'partly-sunny-outline' },
    { hour: 4, minute: 30, period: 'PM', icon: 'cloudy-night-outline' },
    { hour: 7, minute: 0, period: 'PM', icon: 'moon-outline' },
  ];

  return (
    <PickerModal visible={visible} title={isArabic ? 'وقت الانطلاق' : 'Departure time'} onClose={onClose} hideDone>
      <View style={timePickerStyles.face}>
        <Text style={timePickerStyles.preview}>{formatDepartureTime(draftHour, draftMinute, draftPeriod)}</Text>
        <View style={[timePickerStyles.columns, isArabic && timePickerStyles.columnsRtl]}>
          <View style={timePickerStyles.column}>
            <Pressable style={timePickerStyles.stepBtn} onPress={() => bumpHour(1)}>
              <Ionicons name="chevron-up" size={22} color="#630E13" />
            </Pressable>
            <Text style={timePickerStyles.number}>{String(draftHour).padStart(2, '0')}</Text>
            <Pressable style={timePickerStyles.stepBtn} onPress={() => bumpHour(-1)}>
              <Ionicons name="chevron-down" size={22} color="#630E13" />
            </Pressable>
          </View>
          <Text style={timePickerStyles.separator}>:</Text>
          <View style={timePickerStyles.column}>
            <Pressable style={timePickerStyles.stepBtn} onPress={() => bumpMinute(5)}>
              <Ionicons name="chevron-up" size={22} color="#630E13" />
            </Pressable>
            <Text style={timePickerStyles.number}>{String(draftMinute).padStart(2, '0')}</Text>
            <Pressable style={timePickerStyles.stepBtn} onPress={() => bumpMinute(-5)}>
              <Ionicons name="chevron-down" size={22} color="#630E13" />
            </Pressable>
          </View>
        </View>
        <View style={timePickerStyles.periodRow}>
          {(['AM', 'PM'] as DeparturePeriod[]).map((option) => {
            const active = draftPeriod === option;
            return (
              <Pressable
                key={option}
                style={[timePickerStyles.periodBtn, active && timePickerStyles.periodBtnActive]}
                onPress={() => setDraftPeriod(option)}
              >
                <Text style={[timePickerStyles.periodText, active && timePickerStyles.periodTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={timePickerStyles.quickRow}>
        {quickTimes.map((option) => {
          const label = formatDepartureTime(option.hour, option.minute, option.period);
          const active = draftHour === option.hour && draftMinute === option.minute && draftPeriod === option.period;
          return (
            <Pressable
              key={label}
              style={[timePickerStyles.quickBtn, active && timePickerStyles.quickBtnActive]}
              onPress={() => {
                setDraftHour(option.hour);
                setDraftMinute(option.minute);
                setDraftPeriod(option.period);
              }}
            >
              <Ionicons name={option.icon} size={16} color={active ? '#fff' : '#630E13'} />
              <Text style={[timePickerStyles.quickText, active && timePickerStyles.quickTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={timePickerStyles.confirmBtn}
        onPress={() => {
          onConfirm(draftHour, draftMinute, draftPeriod);
          onClose();
        }}
      >
        <Ionicons name="alarm-outline" size={18} color="#fff" />
        <Text style={timePickerStyles.confirmText}>{isArabic ? 'تأكيد الوقت' : 'Set departure time'}</Text>
      </Pressable>
    </PickerModal>
  );
}

const timePickerStyles = StyleSheet.create({
  face: { borderRadius: 22, backgroundColor: '#FFF8F1', padding: 16, alignItems: 'center' },
  preview: { fontSize: 34, fontWeight: '900', color: '#2C2418', marginBottom: 12 },
  columns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  columnsRtl: { flexDirection: 'row-reverse' },
  column: { width: 82, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', paddingVertical: 8 },
  stepBtn: { width: 54, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 38, fontWeight: '900', color: '#630E13', fontVariant: ['tabular-nums'] },
  separator: { fontSize: 34, fontWeight: '900', color: '#8A7A6A' },
  periodRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  periodBtn: { minWidth: 74, borderRadius: 999, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF' },
  periodBtnActive: { backgroundColor: '#630E13' },
  periodText: { fontSize: 13, fontWeight: '900', color: '#630E13' },
  periodTextActive: { color: '#fff' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#F6E9DE' },
  quickBtnActive: { backgroundColor: '#630E13' },
  quickText: { fontSize: 12, fontWeight: '800', color: '#630E13' },
  quickTextActive: { color: '#fff' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, borderRadius: 16, paddingVertical: 14, backgroundColor: '#630E13' },
  confirmText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});

type PickerModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  large?: boolean;
  hideDone?: boolean;
};

function PickerModal({ visible, title, onClose, children, large, hideDone }: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose} />
      <View style={[modalStyles.sheet, large && modalStyles.sheetLarge]}>
        <View style={modalStyles.handle} />
        <Text style={modalStyles.title}>{title}</Text>
        {children}
        {!hideDone && (
          <Pressable style={modalStyles.closeBtn} onPress={onClose}>
            <Text style={modalStyles.closeBtnText}>Done</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(24,20,16,0.38)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '65%',
  },
  sheetLarge: { maxHeight: '80%' },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#E0D5C7', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '900', color: '#2C2418', marginBottom: 14 },
  closeBtn: { marginTop: 14, borderRadius: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: '#630E13' },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});

// ─── Option row inside a picker modal ─────────────────────────────────────────

type OptionRowProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  checkmark?: boolean;
};

function OptionRow({ label, selected, onPress, checkmark }: OptionRowProps) {
  return (
    <Pressable style={[optionStyles.row, selected && optionStyles.rowActive]} onPress={onPress}>
      <Text style={[optionStyles.label, selected && optionStyles.labelActive]} numberOfLines={1}>{label}</Text>
      {checkmark && selected && <Ionicons name="checkmark-circle" size={18} color="#630E13" />}
    </Pressable>
  );
}

const optionStyles = StyleSheet.create({
  row: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F9F3EB',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowActive: { backgroundColor: '#E7D3C3' },
  label: { flex: 1, fontSize: 14, color: '#2C2418' },
  labelActive: { fontWeight: '800', color: '#630E13' },
});

// ─── Inline calendar ──────────────────────────────────────────────────────────

type CalendarProps = {
  selectedIso: string;
  onSelect: (iso: string, label: string) => void;
  language: string;
};

function InlineCalendar({ selectedIso, onSelect, language }: CalendarProps) {
  const isArabic = language === 'ar';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

  const monthLabel = new Intl.DateTimeFormat(isArabic ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' }).format(
    new Date(viewYear, viewMonth, 1),
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const dayNames = isArabic
    ? ['أح', 'إث', 'ث', 'أر', 'خ', 'ج', 'س']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={calStyles.wrap}>
      <View style={calStyles.nav}>
        <Pressable onPress={prevMonth} style={calStyles.navBtn}>
          <Ionicons name="chevron-back" size={18} color="#2C2418" />
        </Pressable>
        <Text style={calStyles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={nextMonth} style={calStyles.navBtn}>
          <Ionicons name="chevron-forward" size={18} color="#2C2418" />
        </Pressable>
      </View>

      <View style={calStyles.dayNames}>
        {dayNames.map(d => (
          <Text key={d} style={calStyles.dayName}>{d}</Text>
        ))}
      </View>

      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (!day) return <View key={`e${idx}`} style={calStyles.cell} />;
          const cellDate = new Date(viewYear, viewMonth, day);
          cellDate.setHours(0, 0, 0, 0);
          const isPast = cellDate < today;
          const iso = cellDate.toISOString();
          const isSelected = selectedIso && new Date(selectedIso).toDateString() === cellDate.toDateString();
          return (
            <Pressable
              key={`d${day}`}
              style={[calStyles.cell, isSelected && calStyles.cellSelected, isPast && calStyles.cellPast]}
              onPress={() => {
                if (isPast) return;
                const label = new Intl.DateTimeFormat(isArabic ? 'ar-SA' : 'en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                }).format(cellDate);
                onSelect(iso, label);
              }}
              disabled={isPast}
            >
              <Text style={[calStyles.cellText, isSelected && calStyles.cellTextSelected, isPast && calStyles.cellTextPast]}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  wrap: { backgroundColor: '#FFF8F1', borderRadius: 18, padding: 14, marginTop: 8 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 14, fontWeight: '800', color: '#2C2418' },
  dayNames: { flexDirection: 'row', marginBottom: 6 },
  dayName: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#8A7A6A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  cellSelected: { backgroundColor: '#630E13' },
  cellPast: { opacity: 0.3 },
  cellText: { fontSize: 14, color: '#2C2418', fontWeight: '600' },
  cellTextSelected: { color: '#fff', fontWeight: '900' },
  cellTextPast: { color: '#A18F7A' },
});

// ─── Photo grid ────────────────────────────────────────────────────────────────

type PhotoGridProps = {
  photos: string[];
  onAddFromCamera: () => void;
  onAddFromLibrary: () => void;
  onRemove: (uri: string) => void;
  isArabic: boolean;
};

function PhotoGrid({ photos, onAddFromCamera, onAddFromLibrary, onRemove, isArabic }: PhotoGridProps) {
  return (
    <View style={photoStyles.grid}>
      {photos.map((uri) => (
        <View key={uri} style={photoStyles.thumb}>
          <Image source={{ uri }} style={photoStyles.img} resizeMode="cover" />
          <Pressable style={photoStyles.remove} onPress={() => onRemove(uri)}>
            <Ionicons name="close-circle" size={20} color="#fff" />
          </Pressable>
        </View>
      ))}
      {photos.length < 6 && (
        <Pressable style={photoStyles.addBtn} onPress={onAddFromLibrary}>
          <Ionicons name="image-outline" size={22} color="#630E13" />
          <Text style={photoStyles.addText}>{isArabic ? 'إضافة' : 'Add'}</Text>
        </Pressable>
      )}
      {photos.length < 6 && (
        <Pressable style={photoStyles.addBtn} onPress={onAddFromCamera}>
          <Ionicons name="camera-outline" size={22} color="#630E13" />
          <Text style={photoStyles.addText}>{isArabic ? 'ط§ظ„ظƒط§ظ…ظٹط±ط§' : 'Camera'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const photoStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  thumb: { width: '30.5%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  img: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 4, right: 4 },
  addBtn: {
    width: '30.5%',
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E7D8C3',
    borderStyle: 'dashed',
    backgroundColor: '#FFF8F1',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addText: { fontSize: 11, fontWeight: '800', color: '#630E13' },
});

// ─── Map location picker (placeholder — swap for your map component) ──────────

type MapPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (label: string, coords: { lat: number; lng: number }) => void;
  isArabic: boolean;
  initialCoords?: { lat: number; lng: number } | null;
  initialLabel?: string;
};

function toPointFeature(coordinate: LngLat | null): FeatureCollection<Point> {
  const features: Feature<Point>[] = coordinate
    ? [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: coordinate,
          },
        },
      ]
    : [];

  return {
    type: 'FeatureCollection',
    features,
  };
}

function joinPlaceParts(parts: Array<string | null | undefined>): string {
  const uniqueParts: string[] = [];

  parts.forEach((part) => {
    const cleanPart = part?.trim();
    if (!cleanPart) {
      return;
    }

    const exists = uniqueParts.some((existing) => existing.toLowerCase() === cleanPart.toLowerCase());
    if (!exists) {
      uniqueParts.push(cleanPart);
    }
  });

  return uniqueParts.join(', ');
}

async function reverseGeocodeExpoPlace(coordinate: LngLat): Promise<string> {
  try {
    const [place] = await Location.reverseGeocodeAsync({
      latitude: coordinate[1],
      longitude: coordinate[0],
    });

    if (!place) {
      return '';
    }

    const primary = place.name || place.street || place.district || place.city || place.region;
    const area = place.city || place.district || place.region || place.country;

    return joinPlaceParts([primary, area]);
  } catch {
    return '';
  }
}

async function reverseGeocodeMeetingPlace(coordinate: LngLat, isArabic: boolean): Promise<string> {
  if (!MAPBOX_ACCESS_TOKEN) {
    return reverseGeocodeExpoPlace(coordinate);
  }

  try {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinate[0]},${coordinate[1]}.json`);
    url.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN);
    url.searchParams.set('types', 'poi,address,place,locality,neighborhood,district');
    url.searchParams.set('language', isArabic ? 'ar' : 'en');
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString());
    if (!res.ok) {
      return reverseGeocodeExpoPlace(coordinate);
    }

    const data = await res.json() as {
      features?: Array<{
        text?: string;
        place_name?: string;
        place_type?: string[];
        context?: Array<{ text?: string; id?: string }>;
      }>;
    };
    const feature = data.features?.[0];
    if (!feature) {
      return reverseGeocodeExpoPlace(coordinate);
    }

    const primary = feature.text?.trim();
    const neighborhood = feature.context?.find((item) => item.id?.startsWith('neighborhood') || item.id?.startsWith('district'))?.text?.trim();
    const city = feature.context?.find((item) => item.id?.startsWith('place') || item.id?.startsWith('locality'))?.text?.trim();

    if (primary && city && primary.toLowerCase() !== city.toLowerCase()) {
      return `${primary}, ${city}`;
    }

    if (primary && neighborhood && primary.toLowerCase() !== neighborhood.toLowerCase()) {
      return `${primary}, ${neighborhood}`;
    }

    return primary || feature.place_name?.split(',')[0]?.trim() || reverseGeocodeExpoPlace(coordinate);
  } catch {
    return reverseGeocodeExpoPlace(coordinate);
  }
}

function MapPickerModal({ visible, onClose, onConfirm, isArabic, initialCoords, initialLabel }: MapPickerModalProps) {
  const [customText, setCustomText] = useState('');
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);
  const [placeLookupFailed, setPlaceLookupFailed] = useState(false);
  const [pickedCoordinate, setPickedCoordinate] = useState<LngLat | null>(
    initialCoords ? [initialCoords.lng, initialCoords.lat] : null,
  );
  const geocodeRequestRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setPickedCoordinate(initialCoords ? [initialCoords.lng, initialCoords.lat] : null);
    setCustomText(initialLabel ?? '');
    setIsResolvingPlace(false);
    setPlaceLookupFailed(false);
  }, [initialCoords, initialLabel, visible]);

  const selectedCoordinate = pickedCoordinate;
  const selectedLabel = customText.trim();
  const canRenderMap = Boolean(Mapbox && !mapboxLoadError && MAPBOX_ACCESS_TOKEN);
  const canConfirmLocation = Boolean(selectedCoordinate && selectedLabel);

  const resolvePickedPlace = useCallback(async (coordinate: LngLat) => {
    const requestId = geocodeRequestRef.current + 1;
    geocodeRequestRef.current = requestId;
    setPickedCoordinate(coordinate);
    setCustomText('');
    setPlaceLookupFailed(false);
    setIsResolvingPlace(true);

    const placeName = await reverseGeocodeMeetingPlace(coordinate, isArabic);

    if (geocodeRequestRef.current !== requestId) {
      return;
    }

    setIsResolvingPlace(false);
    if (placeName) {
      setCustomText(placeName);
    } else {
      setPlaceLookupFailed(true);
    }
  }, [isArabic]);

  return (
    <PickerModal
      visible={visible}
      title={isArabic ? 'اختر نقطة اللقاء' : 'Choose meeting place'}
      onClose={onClose}
      large
    >
      <View style={mapStyles.mapPlaceholder}>
        {canRenderMap && Mapbox ? (
          <Mapbox.MapView
            style={mapStyles.map}
            styleURL={MAPBOX_STYLE_URL || Mapbox.StyleURL.Outdoors}
            compassEnabled
            scaleBarEnabled={false}
            logoEnabled={false}
            attributionEnabled={false}
            onPress={(e) => {
              const coord = (e.geometry?.coordinates ?? null) as unknown as LngLat | null;
              if (coord && coord.length === 2) {
                void resolvePickedPlace(coord);
              }
            }}
          >
            <Mapbox.Camera centerCoordinate={selectedCoordinate ?? DEFAULT_MEETING_COORDINATE} zoomLevel={10.5} />
            <Mapbox.ShapeSource id="plan-meeting-point-source" shape={toPointFeature(selectedCoordinate)}>
              <Mapbox.CircleLayer
                id="plan-meeting-point"
                style={{
                  circleColor: '#630E13',
                  circleStrokeColor: '#FFFFFF',
                  circleStrokeWidth: 3,
                  circleRadius: 8,
                }}
              />
            </Mapbox.ShapeSource>
          </Mapbox.MapView>
        ) : (
          <>
            <Ionicons name="map-outline" size={32} color="#630E13" />
            <Text style={mapStyles.mapHint}>
              {MAPBOX_ACCESS_TOKEN
                ? mapboxLoadError ?? (isArabic ? 'الخريطة غير متاحة في هذا البناء' : 'Map is not available in this build')
                : isArabic ? 'أضف رمز Mapbox لتفعيل الخريطة' : 'Add a Mapbox token to enable the map'}
            </Text>
          </>
        )}
        {selectedCoordinate && (
          <View style={mapStyles.pin}>
            {isResolvingPlace ? (
              <ActivityIndicator size="small" color="#630E13" />
            ) : (
              <Ionicons name="location" size={22} color="#630E13" />
            )}
            <Text style={mapStyles.pinLabel} numberOfLines={1}>
              {selectedLabel || (isResolvingPlace
                ? isArabic ? 'جارٍ العثور على اسم المكان...' : 'Finding place name...'
                : isArabic ? 'اكتب اسم المكان أدناه' : 'Type the place name below')}
            </Text>
          </View>
        )}
      </View>

      <TextInput
        value={customText}
        onChangeText={setCustomText}
        placeholder={isArabic ? 'اسم المكان، مثل: مدخل المسار أو المقهى القريب' : 'Place name, e.g. trail gate or nearby cafe'}
        placeholderTextColor="#A18F7A"
        style={mapStyles.customInput}
      />
      {placeLookupFailed ? (
        <Text style={mapStyles.lookupHint}>
          {isArabic ? 'لم نتمكن من معرفة اسم المكان تلقائياً. اكتب الاسم لتأكيده.' : 'Could not find a place name automatically. Type one to confirm it.'}
        </Text>
      ) : null}

      <Pressable
        style={[mapStyles.confirmBtn, !canConfirmLocation && mapStyles.confirmBtnDisabled]}
        onPress={() => {
          const coordinate = selectedCoordinate ?? DEFAULT_MEETING_COORDINATE;
          const label = selectedLabel;
          if (label) { onConfirm(label, { lat: coordinate[1], lng: coordinate[0] }); onClose(); }
        }}
        disabled={!canConfirmLocation}
      >
        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
        <Text style={mapStyles.confirmBtnText}>{isArabic ? 'تأكيد الموقع' : 'Confirm location'}</Text>
      </Pressable>
    </PickerModal>
  );
}

const mapStyles = StyleSheet.create({
  mapPlaceholder: {
    height: 220,
    borderRadius: 16,
    backgroundColor: '#F0EAE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  map: { ...StyleSheet.absoluteFillObject },
  mapHint: { fontSize: 12, color: '#8A7A6A' },
  pin: { position: 'absolute', bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pinLabel: { fontSize: 13, fontWeight: '700', color: '#2C2418' },
  customInput: { minHeight: 46, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#FFF8F1', color: '#2C2418', fontSize: 14, marginTop: 10, marginBottom: 4 },
  lookupHint: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#8A7A6A', lineHeight: 17 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, borderRadius: 16, paddingVertical: 14, backgroundColor: '#630E13' },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export function ActivityShareComposerScreen() {
  const route = useRoute<ComposerRouteProp>();
  const navigation = useNavigation<ComposerNavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const isPlan = route.params.type === 'plan';
  const isLocationMedia = route.params.type === 'locationMedia';

  // Fields
  const [trail, setTrail] = useState(route.params?.trailName ?? '');
  const [selectedTrailId, setSelectedTrailId] = useState(route.params?.trailId ?? '');
  const [trailOptions, setTrailOptions] = useState<Trail[]>([]);
  const [isLoadingTrails, setIsLoadingTrails] = useState(false);
  const [trailSearch, setTrailSearch] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [speciesResult, setSpeciesResult] = useState<SpeciesIdentification | null>(null);
  const [speciesPredictions, setSpeciesPredictions] = useState<SpeciesPrediction[]>([]);
  const [speciesIsFallback, setSpeciesIsFallback] = useState(false);
  const [speciesResultTab, setSpeciesResultTab] = useState<SpeciesResultTab>('details');
  const [speciesError, setSpeciesError] = useState<string | null>(null);
  const [isIdentifyingSpecies, setIsIdentifyingSpecies] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [mediaCoords, setMediaCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Plan-only fields
  const [selectedDateIso, setSelectedDateIso] = useState('');
  const [selectedDateLabel, setSelectedDateLabel] = useState('');
  const [timeText, setTimeText] = useState('');
  const [departureHour, setDepartureHour] = useState(6);
  const [departureMinute, setDepartureMinute] = useState(0);
  const [departurePeriod, setDeparturePeriod] = useState<DeparturePeriod>('AM');
  const [meetingPlace, setMeetingPlace] = useState('');
  const [meetingCoords, setMeetingCoords] = useState<{ lat: number; lng: number } | null>(
    typeof route.params.initialMeetingLat === 'number' && typeof route.params.initialMeetingLng === 'number'
      ? { lat: route.params.initialMeetingLat, lng: route.params.initialMeetingLng }
      : null,
  );
  const [planVisibility, setPlanVisibility] = useState<PlanVisibility>('public');
  const [maxHeadcount, setMaxHeadcount] = useState('6');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [bringItems, setBringItems] = useState('');
  const [selectedBringItems, setSelectedBringItems] = useState<string[]>([]);
  const [customBringItem, setCustomBringItem] = useState('');
  const [selectedDescriptionItems, setSelectedDescriptionItems] = useState<string[]>([]);
  const [customDescription, setCustomDescription] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [contacts, setContacts] = useState<SocialProfile[]>([]);
  const [meetupWeather, setMeetupWeather] = useState<WeatherForecast | null>(null);
  const [isMeetupWeatherLoading, setIsMeetupWeatherLoading] = useState(false);
  const [meetupWeatherError, setMeetupWeatherError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  // Modal visibility
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showBringPicker, setShowBringPicker] = useState(false);
  const [showDescriptionPicker, setShowDescriptionPicker] = useState(false);
  const [showTrailPicker, setShowTrailPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) { setContacts([]); return; }

    const load = async () => {
      try {
        const [following, followers] = await Promise.all([
          getFollowing(user.id, { page: 1, limit: 40 }).catch(() => ({ data: [] as SocialProfile[] })),
          getFollowers(user.id, { page: 1, limit: 40 }).catch(() => ({ data: [] as SocialProfile[] })),
        ]);
        if (!cancelled) {
          const merged = [...following.data, ...followers.data];
          setContacts(Array.from(new Map(merged.map(f => [f.id, f])).values()));
        }
      } catch {
        if (!cancelled) setContacts([]);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingTrails(true);
    getTrails(1, 50)
      .then((items) => {
        if (cancelled) return;
        setTrailOptions(items);
        if (route.params?.trailId || isLocationMedia) return;
        const firstTrail = items[0];
        if (firstTrail && !selectedTrailId) {
          setSelectedTrailId(firstTrail.id);
          setTrail(isArabic ? firstTrail.nameAr || firstTrail.name : firstTrail.name);
        }
      })
      .catch(() => {
        if (!cancelled) setTrailOptions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTrails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isArabic, isLocationMedia, route.params?.trailId]);

  const friendOptions = useMemo(() => {
    const q = friendSearch.trim().toLowerCase();
    return q ? contacts.filter(f => f.full_name.toLowerCase().includes(q)) : contacts;
  }, [contacts, friendSearch]);

  const selectedTrail = useMemo(
    () => trailOptions.find((item) => item.id === selectedTrailId) ?? null,
    [selectedTrailId, trailOptions],
  );
  const primaryPhotoUri = photos[0] ?? '';

  const filteredTrailOptions = useMemo(() => {
    const q = trailSearch.trim().toLowerCase();
    if (!q) return trailOptions;
    return trailOptions.filter((item) =>
      [item.name, item.nameAr, item.region, item.regionAr]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q)),
    );
  }, [trailOptions, trailSearch]);

  const bringOptions = useMemo(
    () => BRING_OPTIONS.map(option => (isArabic ? option.ar : option.en)),
    [isArabic],
  );

  const descriptionOptions = useMemo(
    () => TRIP_DESCRIPTION_OPTIONS.map(option => (isArabic ? option.ar : option.en)),
    [isArabic],
  );

  useEffect(() => {
    if (!isPlan) return;
    setTimeText(formatDepartureTime(departureHour, departureMinute, departurePeriod));
  }, [departureHour, departureMinute, departurePeriod, isPlan]);

  useEffect(() => {
    let cancelled = false;

    if (!isPlan || !selectedDateIso || !meetingCoords) {
      setMeetupWeather(null);
      setMeetupWeatherError(null);
      setIsMeetupWeatherLoading(false);
      return;
    }

    const loadWeather = async () => {
      setIsMeetupWeatherLoading(true);
      setMeetupWeatherError(null);

      try {
        const date = selectedDateIso.slice(0, 10);
        const forecast = await getWeatherForecast({
          lat: meetingCoords.lat,
          lng: meetingCoords.lng,
          date,
        });

        if (!cancelled) {
          setMeetupWeather(forecast);
        }
      } catch (error) {
        if (!cancelled) {
          setMeetupWeather(null);
          setMeetupWeatherError(error instanceof Error ? error.message : 'Unable to load weather.');
        }
      } finally {
        if (!cancelled) {
          setIsMeetupWeatherLoading(false);
        }
      }
    };

    void loadWeather();

    return () => {
      cancelled = true;
    };
  }, [isPlan, meetingCoords, selectedDateIso]);

  const meetupWeatherVisual = meetupWeather ? getWeatherVisual(meetupWeather.condition, meetupWeather.is_daytime) : null;
  const meetupWeatherSummary = meetupWeather
    ? `${meetupWeather.condition}, ${formatTemperature(meetupWeather.high_c)}/${formatTemperature(meetupWeather.low_c)}, ${formatPercent(meetupWeather.precipitation_probability)} rain`
    : '';

  useEffect(() => {
    setBringItems([...selectedBringItems, customBringItem.trim()].filter(Boolean).join(', '));
  }, [selectedBringItems, customBringItem]);

  useEffect(() => {
    if (!isPlan) return;
    setNote([...selectedDescriptionItems, customDescription.trim()].filter(Boolean).join('. '));
  }, [isPlan, selectedDescriptionItems, customDescription]);

  useEffect(() => {
    let cancelled = false;

    if (isPlan || !primaryPhotoUri) {
      setSpeciesResult(null);
      setSpeciesPredictions([]);
      setSpeciesIsFallback(false);
      setSpeciesError(null);
      setIsIdentifyingSpecies(false);
      return;
    }

    setIsIdentifyingSpecies(true);
    setSpeciesError(null);
    setSpeciesResult(null);
    setSpeciesPredictions([]);
    setSpeciesIsFallback(false);
    setSpeciesResultTab('details');

    identifySpeciesDetails(imageUriToFile(primaryPhotoUri), isArabic ? 'ar' : 'en')
      .then((identification) => {
        if (!cancelled) {
          setSpeciesResult(identification.result);
          setSpeciesPredictions(identification.top5);
          setSpeciesIsFallback(identification.isFallback);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSpeciesError(
            error instanceof Error
              ? error.message
              : 'Unable to identify species. Check that the wildlife server is reachable.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsIdentifyingSpecies(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isArabic, isPlan, primaryPhotoUri]);

  const toggleSelectedValue = useCallback(
    (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
      setter(prev => (prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]));
    },
    [],
  );

  const getDetectedClassificationForUpload = useCallback(
    async (photoUri: string, index: number) => {
      const classification = index === 0 && speciesResult
        ? speciesResult
        : (await identifySpeciesDetails(imageUriToFile(photoUri), isArabic ? 'ar' : 'en')).result;

      return hasDetectedSpecies(classification) ? classification : null;
    },
    [isArabic, speciesResult],
  );

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(
        isArabic ? 'ط§ظ„طµظˆط± ظ…ط·ظ„ظˆط¨ط©' : 'Photos needed',
        isArabic ? 'ط§ط³ظ…ط­ ط¨ط§ظ„ظˆطµظˆظ„ ظ„ظ„طµظˆط± ظ„ط§ط®طھظٹط§ط± طµظˆط±ط©.' : 'Allow photo library access to choose an image.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 6 - photos.length,
      quality: 0.85,
    });
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 6));
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(
        isArabic ? 'ط§ظ„ظƒط§ظ…ظٹط±ط§ ظ…ط·ظ„ظˆط¨ط©' : 'Camera needed',
        isArabic ? 'ط§ط³ظ…ط­ ط¨ط§ط³طھط®ط¯ط§ظ… ط§ظ„ظƒط§ظ…ظٹط±ط§ ظ„ط§ظ„طھظ‚ط§ط· طµظˆط±ط©.' : 'Allow camera access to take a photo.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 6));
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          isArabic ? 'الموقع مطلوب' : 'Location needed',
          isArabic ? 'اسمح بالوصول للموقع لربط الصور بمكانك الحالي.' : 'Allow location access to link media to your current place.',
        );
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: current.coords.latitude, lng: current.coords.longitude };
      setMediaCoords(coords);
      setLocationLabel(isArabic ? 'جار العثور على اسم المكان...' : 'Finding place name...');

      const placeName = await reverseGeocodeMeetingPlace([coords.lng, coords.lat], isArabic);
      setLocationLabel(placeName || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    } catch (error) {
      Alert.alert(
        isArabic ? 'تعذر تحديد الموقع' : 'Unable to get location',
        error instanceof Error ? error.message : isArabic ? 'حاول مرة أخرى.' : 'Please try again.',
      );
    } finally {
      setIsLocating(false);
    }
  };

  const handlePost = async () => {
    const trimmedTrail = trail.trim() || (isArabic ? 'مسارك' : 'Your trail');
    const trimmedNote = note.trim() || (isArabic ? 'مشاركة لحظة جديدة' : 'Sharing a new trail moment');

    if (isLocationMedia) {
      if (!photos.length) {
        Alert.alert(isArabic ? 'أضف صوراً' : 'Add media', isArabic ? 'اختر صورة واحدة على الأقل.' : 'Choose at least one photo.');
        return;
      }
      if (!mediaCoords) {
        Alert.alert(isArabic ? 'اختر الموقع' : 'Add location', isArabic ? 'استخدم موقعك الحالي أولاً.' : 'Use your current location first.');
        return;
      }

      if (isLocating) {
        Alert.alert(
          isArabic ? 'جار العثور على اسم المكان' : 'Finding place name',
          isArabic ? 'انتظر حتى ننتهي من تحديد اسم المكان.' : 'Wait until the place name finishes resolving.',
        );
        return;
      }

      setIsPosting(true);
      try {
        const trailIdForMedia = null;
        const mediaLatitude = mediaCoords.lat;
        const mediaLongitude = mediaCoords.lng;
        const mediaLocationName = locationLabel.trim() || null;
        const uploaded = await Promise.all(
          photos.map(async (photo, index) => {
            let classification: SpeciesIdentification | null = null;

            try {
              classification = await getDetectedClassificationForUpload(photo, index);
            } catch (error) {
              console.warn('[ActivityShareComposer] Location media species identification skipped', error);
            }

            return uploadMedia({
              file: imageUriToFile(photo),
              caption: trimmedNote,
              latitude: mediaLatitude,
              longitude: mediaLongitude,
              locationName: mediaLocationName,
              tripId: trailIdForMedia,
              language: isArabic ? 'ar' : 'en',
              classification,
            });
          }),
        );

        void ({
          id: `local-location-media-${Date.now()}`,
          kind: 'recap',
          sourceType: 'media',
          photoId: uploaded[0]?.id,
          photoType: 'media',
          trailId: trailIdForMedia ?? '',
          user: user?.full_name || 'You',
          handle: '@you',
          avatar: user?.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=faces&fit=crop&w=240&h=240',
          image: uploaded[0]?.url ?? photos[0],
          trailNameEn: locationLabel.trim() || 'Current location',
          trailNameAr: locationLabel.trim() || 'الموقع الحالي',
          regionEn: 'Pinned to current location',
          regionAr: 'مرتبط بالموقع الحالي',
          captionEn: trimmedNote,
          captionAr: trimmedNote,
          timeEn: 'Just now',
          timeAr: 'الآن',
          likes: 1,
          comments: 0,
          distance: `${uploaded.length} media`,
        });

        Alert.alert(
          isArabic ? 'تم رفع الوسائط' : 'Media added',
          isArabic ? 'تم ربط الصور بموقعك الحالي.' : 'Your photos are linked to your current location.',
          [{ text: isArabic ? 'حسناً' : 'OK', onPress: () => navigation.navigate('AppTabs', { screen: 'Activity' }) }],
        );
      } catch (error) {
        Alert.alert(
          isArabic ? 'تعذر رفع الوسائط' : 'Unable to add media',
          error instanceof Error ? error.message : isArabic ? 'حاول مرة أخرى.' : 'Please try again.',
        );
      } finally {
        setIsPosting(false);
      }
      return;
    }

    if (!isPlan && !selectedTrailId) {
      Alert.alert(isArabic ? 'اختر مساراً' : 'Choose a trail', isArabic ? 'اختر مساراً من قائمة Explore قبل النشر.' : 'Choose a trail from Explore before posting.');
      return;
    }

    if (!isPlan && !photos.length) {
      Alert.alert(isArabic ? 'ط£ط¶ظپ طµظˆط±ط§ظ‹' : 'Add media', isArabic ? 'ط§ط®طھط± طµظˆط±ط© ظˆط§ط­ط¯ط© ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„.' : 'Choose at least one photo for this recap.');
      return;
    }

    const headcount = parseInt(maxHeadcount, 10) || 6;
    const joined = Math.max(1, 1 + selectedFriends.length);
    const spotsLeft = Math.max(0, headcount - joined);
    const startsAtIso = buildStartsAtIso(selectedDateIso, departureHour, departureMinute, departurePeriod);
    if (isPlan) {
      const invitedUserIds = contacts
        .filter((contact) => selectedFriends.includes(contact.full_name))
        .map((contact) => contact.id);

      setIsPosting(true);
      try {
        let coverUrl = photos[0] && /^https?:\/\//i.test(photos[0]) ? photos[0] : null;

        if (photos[0] && !coverUrl) {
          const uploaded = await uploadMedia({
            file: imageUriToFile(photos[0]),
            caption: trimmedTrail,
            latitude: meetingCoords?.lat ?? null,
            longitude: meetingCoords?.lng ?? null,
            locationName: meetingPlace || null,
            tripId: route.params?.trailId ?? selectedTrailId ?? null,
          });
          coverUrl = uploaded.url;
        }

        await createMeetup({
          trail_id: route.params?.trailId ?? null,
          title: trimmedTrail,
          title_ar: trimmedTrail,
          note: trimmedNote,
          note_ar: trimmedNote,
          vibe: null,
          vibe_ar: null,
          cover_url: coverUrl,
          starts_at: startsAtIso,
          meeting_place: meetingPlace || null,
          meeting_latitude: meetingCoords?.lat ?? null,
          meeting_longitude: meetingCoords?.lng ?? null,
          visibility: planVisibility,
          max_headcount: Math.min(500, Math.max(1, headcount)),
          bring_items: bringItems.split(',').map((item) => item.trim()).filter(Boolean),
          invited_user_ids: invitedUserIds,
        });

        Alert.alert(
          isArabic ? 'تم إنشاء اللقاء' : 'Meetup created',
          isArabic ? 'سيظهر اللقاء في صفحة النشاط.' : 'Your meetup is now connected to Activity.',
          [{ text: isArabic ? 'حسنا' : 'OK', onPress: () => navigation.navigate('AppTabs', { screen: 'Activity' }) }],
        );
      } catch (error) {
        Alert.alert(
          isArabic ? 'تعذر إنشاء اللقاء' : 'Unable to create meetup',
          error instanceof Error ? error.message : isArabic ? 'حاول مرة أخرى.' : 'Please try again.',
        );
      } finally {
        setIsPosting(false);
      }
      return;
    }

    setIsPosting(true);
    try {
      const selectedTrailLatitude = typeof selectedTrail?.coordinates?.[0] === 'number' ? selectedTrail.coordinates[0] : null;
      const selectedTrailLongitude = typeof selectedTrail?.coordinates?.[1] === 'number' ? selectedTrail.coordinates[1] : null;
      const uploaded = await Promise.all(
        photos.map(async (photo, index) => {
          let classification: SpeciesIdentification | null = null;

          try {
            classification = await getDetectedClassificationForUpload(photo, index);
          } catch (error) {
            console.warn('[ActivityShareComposer] Recap species identification skipped', error);
          }

          return uploadMedia({
            file: imageUriToFile(photo),
            caption: trimmedNote,
            latitude: selectedTrailLatitude,
            longitude: selectedTrailLongitude,
            locationName: selectedTrail?.name || trimmedTrail,
            tripId: selectedTrailId,
            language: isArabic ? 'ar' : 'en',
            classification,
          });
        }),
      );

      void ({
        id: `local-media-recap-${Date.now()}`,
        kind: 'recap',
        sourceType: 'media',
        photoId: uploaded[0]?.id,
        photoType: 'media',
        trailId: selectedTrailId,
        user: user?.full_name || 'You',
        handle: '@you',
        avatar: user?.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=faces&fit=crop&w=240&h=240',
        image: uploaded[0]?.url ?? photos[0],
        trailNameEn: selectedTrail?.name || trimmedTrail,
        trailNameAr: selectedTrail?.nameAr || selectedTrail?.name || trimmedTrail,
        regionEn: selectedTrail?.region || 'Trail recap',
        regionAr: selectedTrail?.regionAr || selectedTrail?.region || 'Trail recap',
        captionEn: trimmedNote,
        captionAr: trimmedNote,
        timeEn: 'Just now',
        timeAr: 'ط§ظ„ط¢ظ†',
        likes: 0,
        comments: 0,
        natureSightings: [],
        distance: uploaded.length > 1 ? `${uploaded.length} photos` : 'Photo',
      });

      Alert.alert(
        isArabic ? 'طھظ… ط§ظ„ظ†ط´ط±' : 'Posted',
        isArabic
          ? 'طھظ…طھ ظ…ط´ط§ط±ظƒطھظƒ ظپظٹ طµظپط­ط© ط§ظ„ظ†ط´ط§ط·.'
          : 'Your recap media is saved to the backend and will appear in Activity.',
        [{ text: isArabic ? 'ط­ط³ظ†ط§ظ‹' : 'OK', onPress: () => navigation.navigate('AppTabs', { screen: 'Activity' }) }],
      );
    } catch (error) {
      Alert.alert(
        isArabic ? 'طھط¹ط°ط± ط§ظ„ظ†ط´ط±' : 'Unable to post',
        error instanceof Error ? error.message : isArabic ? 'ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰.' : 'Please try again.',
      );
    } finally {
      setIsPosting(false);
    }
    return;

  };

  const topSpeciesPrediction = speciesPredictions[0] ?? null;
  const speciesDetected = hasDetectedSpecies(speciesResult);

  return (
    <AnimatedScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(12, insets.top + 8), paddingBottom: Math.max(40, insets.bottom + 28) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <AnimatedBlock delay={40}>
          <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
            <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
              <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, isArabic ? rtlText : ltrText]}>
                {isPlan
                  ? (isArabic ? 'خطة جديدة' : 'New meetup plan')
                  : isLocationMedia
                    ? (isArabic ? 'وسائط الموقع' : 'Location media')
                    : isArabic ? 'منشور رحلة' : 'Trail recap'}
              </Text>
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={80} style={styles.card}>

          {/* ── Photos ── */}
          <FieldRow icon="images-outline" label={isArabic ? 'الصور' : 'Photos'} isArabic={isArabic}>
            {photos.length === 0 ? (
              <View style={[styles.photoEmptyActions, isArabic && styles.photoEmptyActionsRtl]}>
                <Pressable style={styles.photoEmptyBtn} onPress={handleTakePhoto}>
                <Ionicons name="camera-outline" size={28} color="#630E13" />
                <Text style={styles.photoEmptyText}>
                  {isArabic ? 'اضغط لإضافة صور' : 'Tap to add photos'}
                </Text>
                </Pressable>
                <Pressable style={styles.photoEmptyBtn} onPress={handlePickPhoto}>
                  <Ionicons name="image-outline" size={28} color="#630E13" />
                  <Text style={styles.photoEmptyText}>
                    {isArabic ? 'ط±ظپط¹ طµظˆط±ط©' : 'Upload image'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <PhotoGrid
                photos={photos}
                onAddFromCamera={handleTakePhoto}
                onAddFromLibrary={handlePickPhoto}
                onRemove={uri => setPhotos(p => p.filter(u => u !== uri))}
                isArabic={isArabic}
              />
            )}
          </FieldRow>

          {!isPlan && primaryPhotoUri ? (
            <Card mode="contained" style={styles.speciesCard}>
              <Card.Content>
                {isIdentifyingSpecies ? (
                  <View style={styles.speciesLoadingRow}>
                    <PaperActivityIndicator animating color="#5A5A40" />
                    <PaperText style={styles.speciesLoadingText}>Identifying species...</PaperText>
                  </View>
                ) : speciesError ? (
                  <View style={styles.speciesErrorRow}>
                    <Ionicons name="warning-outline" size={18} color="#B42318" />
                    <PaperText style={styles.speciesErrorText}>{speciesError}</PaperText>
                  </View>
                ) : speciesResult ? (
                  <>
                    <View style={styles.speciesMetaRow}>
                      <View style={styles.speciesStatusPill}>
                        <PaperText style={styles.speciesStatusText}>
                          {speciesDetected ? (speciesIsFallback ? 'Local Suggestion' : 'Result Identified') : 'No Species Detected'}
                        </PaperText>
                      </View>
                      <View style={styles.speciesConfidenceBlock}>
                        <PaperText style={styles.speciesConfidenceLabel}>Confidence</PaperText>
                        <PaperText style={styles.speciesConfidenceValue}>
                          {speciesResult.confidenceLevel}%
                        </PaperText>
                      </View>
                    </View>

                    <View style={styles.speciesNomenclature}>
                      <PaperText style={styles.speciesTitle}>{speciesResult.commonName}</PaperText>
                      {speciesResult.scientificName ? (
                        <PaperText style={styles.speciesScientificName}>
                          {speciesResult.scientificName}
                        </PaperText>
                      ) : null}
                    </View>

                    <View style={styles.speciesDivider} />

                    <View style={styles.speciesTabs}>
                      {[
                        ['details', 'Anatomy'],
                        ['ecology', 'Ecology'],
                        ['funfacts', 'Discoveries'],
                      ].map(([value, label]) => {
                        const active = speciesResultTab === value;
                        return (
                          <Pressable
                            key={value}
                            style={[styles.speciesTab, active && styles.speciesTabActive]}
                            onPress={() => setSpeciesResultTab(value as SpeciesResultTab)}
                          >
                            <PaperText style={[styles.speciesTabText, active && styles.speciesTabTextActive]}>
                              {label}
                            </PaperText>
                          </Pressable>
                        );
                      })}
                    </View>

                    {speciesResultTab === 'details' ? (
                      <View style={styles.speciesTabPanel}>
                        <View style={styles.speciesTaxonomyGrid}>
                          {[
                            ['Kingdom', speciesResult.taxonomy.kingdom],
                            ['Family', speciesResult.taxonomy.family],
                            ['Order', speciesResult.taxonomy.order],
                            ['Genus', speciesResult.taxonomy.genus],
                          ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
                            <View key={label} style={styles.speciesTaxonomyItem}>
                              <PaperText style={styles.speciesTaxonomyLabel}>{label}</PaperText>
                              <PaperText style={styles.speciesTaxonomyValue} numberOfLines={1}>{value}</PaperText>
                            </View>
                          ))}
                        </View>

                        {speciesResult.shortDescription ? (
                          <View style={styles.speciesDetailsBlock}>
                            <PaperText style={styles.speciesSectionTitle}>Description</PaperText>
                            <PaperText style={styles.speciesDescription}>
                              {speciesResult.shortDescription}
                            </PaperText>
                          </View>
                        ) : null}

                        {speciesResult.notableFeatures.length ? (
                          <View style={styles.speciesDetailsBlock}>
                            <PaperText style={styles.speciesSectionTitle}>Distinguishing Features</PaperText>
                            {speciesResult.notableFeatures.slice(0, 4).map((feature) => (
                              <View key={feature} style={styles.speciesBulletRow}>
                                <View style={styles.speciesBulletDot} />
                                <PaperText style={styles.speciesBulletText}>{feature}</PaperText>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {speciesResultTab === 'ecology' ? (
                      <View style={styles.speciesTabPanel}>
                        <View style={styles.speciesEcologyCard}>
                          <PaperText style={styles.speciesSectionTitle}>Host & Habitat</PaperText>
                          <PaperText style={styles.speciesFactText}>
                            {speciesResult.ecologicalRole || 'No specific ecological interactions were listed for this scan.'}
                          </PaperText>
                        </View>
                        <View style={styles.speciesInfoRow}>
                          <Ionicons name="information-circle-outline" size={16} color="#5A5A40" />
                          <PaperText style={styles.speciesInfoText}>
                            Detailed notes come from the Gemini scanner result; verify important identifications in the field.
                          </PaperText>
                        </View>
                      </View>
                    ) : null}

                    {speciesResultTab === 'funfacts' ? (
                      <View style={styles.speciesTabPanel}>
                        <PaperText style={styles.speciesSectionTitle}>Fascinating Discoveries</PaperText>
                        {(speciesResult.funFacts?.length ? speciesResult.funFacts : ['No discoveries were returned for this scan.']).slice(0, 3).map((fact) => (
                          <View key={fact} style={styles.speciesDiscoveryCard}>
                            <Ionicons name="bulb-outline" size={17} color="#5A5A40" />
                            <PaperText style={styles.speciesFactText}>{fact}</PaperText>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {speciesIsFallback && speciesPredictions.length ? (
                      <View style={styles.speciesFallbackBlock}>
                        <PaperText style={styles.speciesSectionTitle}>Model Matches</PaperText>
                        {speciesPredictions.map((prediction) => (
                          <View key={prediction.label ?? prediction.name} style={styles.speciesRow}>
                            <View style={styles.speciesRowHeader}>
                              <PaperText style={styles.speciesName} numberOfLines={1}>
                                {prediction.scientificName ?? prediction.name}
                              </PaperText>
                              <PaperText style={styles.speciesPercent}>
                                {Math.round(prediction.confidence * 100)}%
                              </PaperText>
                            </View>
                            <ProgressBar
                              progress={Math.max(0, Math.min(1, prediction.confidence))}
                              color="#5A5A40"
                              style={styles.speciesProgress}
                            />
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <PaperText style={styles.speciesNote}>
                      Results are suggestions, not guaranteed identifications
                    </PaperText>
                  </>
                ) : topSpeciesPrediction ? (
                  <PaperText style={styles.speciesTitle}>{topSpeciesPrediction.name}</PaperText>
                ) : null}
              </Card.Content>
            </Card>
          ) : null}

          {isLocationMedia ? (
            <FieldRow icon="location-outline" label={isArabic ? 'الموقع الحالي' : 'Current location'} isArabic={isArabic}>
              <Pressable
                style={[styles.locationButton, isLocating && styles.submitButtonDisabled]}
                onPress={handleUseCurrentLocation}
                disabled={isLocating}
              >
                {isLocating ? <ActivityIndicator color="#630E13" /> : <Ionicons name="locate-outline" size={18} color="#630E13" />}
                <Text style={styles.locationButtonText}>
                  {locationLabel || (isArabic ? 'استخدم موقعي الحالي' : 'Use current location')}
                </Text>
              </Pressable>
            </FieldRow>
          ) : !isPlan ? (
            <FieldRow icon="trail-sign-outline" label={isArabic ? 'المسار' : 'Trail'} isArabic={isArabic}>
              <SelectPill
                value={trail}
                placeholder={isLoadingTrails ? (isArabic ? 'جار تحميل المسارات...' : 'Loading trails...') : (isArabic ? 'اختر مساراً من Explore' : 'Choose a trail from Explore')}
                isArabic={isArabic}
                onPress={() => setShowTrailPicker(true)}
                iconRight="list-outline"
              />
            </FieldRow>
          ) : null}

          {isPlan && (
            <>
              {/* ── Date (inline calendar) ── */}
              <FieldRow icon="calendar-outline" label={isArabic ? 'التاريخ' : 'Date'} isArabic={isArabic}>
                <InlineCalendar
                  selectedIso={selectedDateIso}
                  onSelect={(iso, label) => { setSelectedDateIso(iso); setSelectedDateLabel(label); }}
                  language={language}
                />
              </FieldRow>

              {/* ── Time ── */}
              <FieldRow icon="time-outline" label={isArabic ? 'وقت الانطلاق' : 'Departure time'} isArabic={isArabic}>
                <SelectPill
                  value={timeText}
                  placeholder={isArabic ? 'مثال: 6:00 صباحاً' : 'e.g. 6:00 AM'}
                  isArabic={isArabic}
                  onPress={() => setShowTimePicker(true)}
                  iconRight="alarm-outline"
                />
              </FieldRow>

              {/* ── Meeting location (map picker) ── */}
              <FieldRow icon="location-outline" label={isArabic ? 'نقطة اللقاء' : 'Meeting location'} isArabic={isArabic}>
                <SelectPill
                  value={meetingPlace}
                  placeholder={isArabic ? 'اختر على الخريطة...' : 'Pick on map...'}
                  isArabic={isArabic}
                  onPress={() => setShowMap(true)}
                  iconRight="map-outline"
                />
              </FieldRow>

              {isMeetupWeatherLoading || meetupWeatherError || (meetupWeather && meetupWeatherVisual) ? (
                <FieldRow icon="partly-sunny-outline" label={isArabic ? 'توقعات الطقس' : 'Weather prediction'} isArabic={isArabic}>
                  <View style={[styles.weatherPreview, { backgroundColor: meetupWeatherVisual?.tint ?? '#FFF8F1' }]}>
                    {isMeetupWeatherLoading ? (
                      <ActivityIndicator color="#630E13" />
                    ) : meetupWeatherError ? (
                      <Text style={[styles.weatherMeta, isArabic ? rtlText : ltrText]}>{meetupWeatherError}</Text>
                    ) : meetupWeather && meetupWeatherVisual ? (
                      <>
                        <View style={[styles.weatherIconBubble, { backgroundColor: meetupWeatherVisual.accent }]}>
                          <Text style={styles.weatherEmoji}>{meetupWeatherVisual.emoji}</Text>
                        </View>
                        <View style={styles.weatherCopy}>
                          <Text style={[styles.weatherCondition, isArabic ? rtlText : ltrText]}>
                            {meetupWeather.condition}
                          </Text>
                          <Text style={[styles.weatherMeta, isArabic ? rtlText : ltrText]}>
                            {formatTemperature(meetupWeather.high_c)} / {formatTemperature(meetupWeather.low_c)}
                            {'  '}·{'  '}
                            {formatPercent(meetupWeather.precipitation_probability)} rain
                            {'  '}·{'  '}
                            {formatWind(meetupWeather.wind_kph)}
                          </Text>
                        </View>
                      </>
                    ) : null}
                  </View>
                </FieldRow>
              ) : null}

              {/* ── Invite friends (multi-select dropdown) ── */}
              <FieldRow icon="people-outline" label={isArabic ? 'ادعُ الأصدقاء' : 'Invite friends'} isArabic={isArabic}>
                <SelectPill
                  value={selectedFriends.length ? `${selectedFriends.length} ${isArabic ? 'مدعوون' : 'invited'}` : ''}
                  placeholder={isArabic ? 'اختر من قائمة الأصدقاء' : 'Choose from your friends'}
                  isArabic={isArabic}
                  onPress={() => setShowFriends(true)}
                  iconRight="chevron-down-outline"
                />
                {selectedFriends.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {selectedFriends.map(name => (
                      <View key={name} style={styles.chip}>
                        <Text style={styles.chipText} numberOfLines={1}>{name}</Text>
                        <Pressable onPress={() => setSelectedFriends(p => p.filter(n => n !== name))}>
                          <Ionicons name="close" size={13} color="#630E13" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </FieldRow>

              <FieldRow icon="lock-closed-outline" label={isArabic ? 'خصوصية الخطة' : 'Plan privacy'} isArabic={isArabic}>
                <View style={[styles.visibilityRow, isArabic && styles.visibilityRowRtl]}>
                  {(['public', 'friends', 'private'] as PlanVisibility[]).map(option => {
                    const active = planVisibility === option;
                    const isPublic = option === 'public';
                    const isFriends = option === 'friends';
                    const visibilityTitle = isPublic
                      ? isArabic ? 'عام' : 'Public'
                      : isFriends
                        ? isArabic ? 'للأصدقاء' : 'Friends'
                        : isArabic ? 'خاص' : 'Private';
                    const visibilityHint = isPublic
                      ? isArabic ? 'يظهر في النشاط للجميع' : 'Visible in Activity'
                      : isFriends
                        ? isArabic ? 'يظهر للأصدقاء ويمكن دعوتهم' : 'Visible to friends'
                        : isArabic ? 'للمدعوين فقط' : 'Invited members only';
                    return (
                      <Pressable
                        key={option}
                        style={[styles.visibilityCard, active && styles.visibilityCardActive]}
                        onPress={() => setPlanVisibility(option)}
                      >
                        <Ionicons
                          name={isPublic ? 'globe-outline' : isFriends ? 'people-outline' : 'lock-closed-outline'}
                          size={18}
                          color={active ? '#fff' : '#630E13'}
                        />
                        <View style={styles.visibilityCopy}>
                          <Text style={[styles.visibilityTitle, active && styles.visibilityTextActive]}>{visibilityTitle}</Text>
                          <Text style={[styles.visibilityHint, active && styles.visibilityTextActive]} numberOfLines={2}>{visibilityHint}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </FieldRow>

              {/* ── Max headcount (plain numeric input) ── */}
              <FieldRow icon="person-outline" label={isArabic ? 'الحد الأقصى للمشاركين' : 'Max headcount'} isArabic={isArabic}>
                <View style={[styles.counterRow, isArabic && styles.counterRowRtl]}>
                  <Pressable
                    style={styles.counterBtn}
                    onPress={() => setMaxHeadcount(v => String(Math.max(2, parseInt(v, 10) - 1)))}
                  >
                    <Ionicons name="remove" size={20} color="#2C2418" />
                  </Pressable>
                  <TextInput
                    value={maxHeadcount}
                    onChangeText={v => setMaxHeadcount(v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    style={styles.counterInput}
                    maxLength={2}
                  />
                  <Pressable
                    style={styles.counterBtn}
                    onPress={() => setMaxHeadcount(v => String(Math.min(50, parseInt(v, 10) + 1)))}
                  >
                    <Ionicons name="add" size={20} color="#2C2418" />
                  </Pressable>
                  <Text style={styles.counterSuffix}>{isArabic ? 'شخص' : 'people max'}</Text>
                </View>
              </FieldRow>

              {/* ── What to bring ── */}
              <FieldRow icon="bag-outline" label={isArabic ? 'ماذا تجلب' : 'What to bring'} isArabic={isArabic}>
                <SelectPill
                  value={bringItems}
                  placeholder={isArabic ? 'اختر الأشياء الشائعة أو أضف غير ذلك' : 'Choose common items or add other'}
                  isArabic={isArabic}
                  onPress={() => setShowBringPicker(true)}
                />
              </FieldRow>
            </>
          )}

          {/* ── Caption / note ── */}
          <FieldRow
            icon="pencil-outline"
            label={isPlan ? (isArabic ? 'وصف الرحلة' : 'Trip description') : isArabic ? 'النص' : 'Caption'}
            isArabic={isArabic}
          >
            {isPlan ? (
              <>
                <SelectPill
                  value={note}
                  placeholder={isArabic ? 'اختر العمر والقدرة والوتيرة أو أضف غير ذلك' : 'Choose age, ability, pace, and strength'}
                  isArabic={isArabic}
                  onPress={() => setShowDescriptionPicker(true)}
                />
                <TextInput
                  value={customDescription}
                  onChangeText={setCustomDescription}
                  multiline
                  placeholder={isArabic ? 'غير ذلك...' : 'Other details...'}
                  placeholderTextColor="#A18F7A"
                  style={[styles.otherInput, isArabic ? rtlText : ltrText]}
                />
              </>
            ) : (
              <TextInput
                value={note}
                onChangeText={setNote}
                multiline
                placeholder={isLocationMedia ? (isArabic ? 'اكتب ملاحظة عن هذا المكان...' : 'Write a note about this place...') : (isArabic ? 'اكتب لحظة من الرحلة...' : 'Write a moment from the trail...')}
                placeholderTextColor="#A18F7A"
                style={[styles.textArea, isArabic ? rtlText : ltrText]}
              />
            )}
          </FieldRow>

          <Pressable style={[styles.submitButton, isPosting && styles.submitButtonDisabled]} onPress={handlePost} disabled={isPosting}>
            {isPosting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name={isPlan ? 'calendar-outline' : isLocationMedia ? 'cloud-upload-outline' : 'paper-plane-outline'} size={18} color="#fff" />
            )}
            <Text style={styles.submitText}>{isArabic ? 'نشر' : 'Post'}</Text>
          </Pressable>
        </AnimatedBlock>
      </ScrollView>

      <DepartureTimePicker
        visible={showTimePicker}
        hour={departureHour}
        minute={departureMinute}
        period={departurePeriod}
        isArabic={isArabic}
        onClose={() => setShowTimePicker(false)}
        onConfirm={(hour, minute, period) => {
          setDepartureHour(hour);
          setDepartureMinute(minute);
          setDeparturePeriod(period);
        }}
      />

      <PickerModal
        visible={showTrailPicker}
        title={isArabic ? 'اختر مساراً' : 'Choose trail'}
        onClose={() => { setShowTrailPicker(false); setTrailSearch(''); }}
        large
      >
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={17} color="#8A7A6A" />
          <TextInput
            value={trailSearch}
            onChangeText={setTrailSearch}
            placeholder={isArabic ? 'ابحث في مسارات Explore' : 'Search Explore trails'}
            placeholderTextColor="#A18F7A"
            style={[styles.searchInput, isArabic ? rtlText : ltrText]}
          />
        </View>
        <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
          {isLoadingTrails ? (
            <ActivityIndicator color="#630E13" />
          ) : filteredTrailOptions.length ? (
            filteredTrailOptions.map((item) => (
              <OptionRow
                key={item.id}
                label={`${isArabic ? item.nameAr || item.name : item.name} · ${isArabic ? item.regionAr || item.region : item.region}`}
                selected={selectedTrailId === item.id}
                onPress={() => {
                  setSelectedTrailId(item.id);
                  setTrail(isArabic ? item.nameAr || item.name : item.name);
                  setShowTrailPicker(false);
                  setTrailSearch('');
                }}
                checkmark
              />
            ))
          ) : (
            <Text style={styles.emptyText}>{isArabic ? 'لا توجد مسارات.' : 'No trails found.'}</Text>
          )}
        </ScrollView>
      </PickerModal>

      {/* ── Map picker modal ── */}
      <MapPickerModal
        visible={showMap}
        onClose={() => setShowMap(false)}
        onConfirm={(label, coords) => { setMeetingPlace(label); setMeetingCoords(coords); }}
        isArabic={isArabic}
        initialCoords={meetingCoords}
        initialLabel={meetingPlace}
      />

      {/* ── Friends multi-select modal ── */}
      <PickerModal
        visible={showFriends}
        title={isArabic ? 'اختر الأصدقاء' : 'Invite friends'}
        onClose={() => { setShowFriends(false); setFriendSearch(''); }}
        large
      >
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={17} color="#8A7A6A" />
          <TextInput
            value={friendSearch}
            onChangeText={setFriendSearch}
            placeholder={isArabic ? 'ابحث عن صديق' : 'Search friends'}
            placeholderTextColor="#A18F7A"
            style={[styles.searchInput, isArabic ? rtlText : ltrText]}
          />
        </View>
        <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
          {friendOptions.length ? (
            friendOptions.map(friend => {
              const sel = selectedFriends.includes(friend.full_name);
              return (
                <OptionRow
                  key={friend.id}
                  label={friend.full_name}
                  selected={sel}
                  onPress={() =>
                    setSelectedFriends(prev =>
                      prev.includes(friend.full_name)
                        ? prev.filter(n => n !== friend.full_name)
                        : [...prev, friend.full_name],
                    )
                  }
                  checkmark
                />
              );
            })
          ) : (
            <Text style={styles.emptyText}>
              {isArabic ? 'لا يوجد أصدقاء متاحون حالياً.' : 'No friends available yet.'}
            </Text>
          )}
        </ScrollView>
      </PickerModal>

      <PickerModal
        visible={showBringPicker}
        title={isArabic ? 'ماذا تجلب' : 'What to bring'}
        onClose={() => setShowBringPicker(false)}
        large
      >
        <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
          {bringOptions.map((option, index) => (
            <OptionRow
              key={`${option}-${index}`}
              label={option}
              selected={selectedBringItems.includes(option)}
              onPress={() => toggleSelectedValue(option, setSelectedBringItems)}
              checkmark
            />
          ))}
          <OptionRow
            label={isArabic ? 'غير ذلك' : 'Other'}
            selected={customBringItem.trim().length > 0}
            onPress={() => undefined}
            checkmark
          />
          <TextInput
            value={customBringItem}
            onChangeText={setCustomBringItem}
            placeholder={isArabic ? 'اكتب شيئاً آخر...' : 'Type another item...'}
            placeholderTextColor="#A18F7A"
            style={[styles.otherInput, isArabic ? rtlText : ltrText]}
          />
        </ScrollView>
      </PickerModal>

      <PickerModal
        visible={showDescriptionPicker}
        title={isArabic ? 'وصف الرحلة' : 'Trip description'}
        onClose={() => setShowDescriptionPicker(false)}
        large
      >
        <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
          {descriptionOptions.map((option, index) => (
            <OptionRow
              key={`${option}-${index}`}
              label={option}
              selected={selectedDescriptionItems.includes(option)}
              onPress={() => toggleSelectedValue(option, setSelectedDescriptionItems)}
              checkmark
            />
          ))}
          <OptionRow
            label={isArabic ? 'غير ذلك' : 'Other'}
            selected={customDescription.trim().length > 0}
            onPress={() => undefined}
            checkmark
          />
          <TextInput
            value={customDescription}
            onChangeText={setCustomDescription}
            placeholder={isArabic ? 'اكتب تفاصيل أخرى...' : 'Type other trip details...'}
            placeholderTextColor="#A18F7A"
            multiline
            style={[styles.otherInput, styles.otherInputTall, isArabic ? rtlText : ltrText]}
          />
        </ScrollView>
      </PickerModal>
    </AnimatedScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED' },
  content: { paddingHorizontal: 16 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconButton: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 2,
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 24, fontWeight: '900', color: '#2C2418' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#7B6D5A' },

  card: { borderRadius: 24, padding: 16, backgroundColor: '#fff', paddingBottom: 20 },

  speciesCard: {
    marginTop: 12,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEAE0',
    shadowColor: '#2C2C2C',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  speciesLoadingRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  speciesLoadingText: { fontSize: 14, fontWeight: '800', color: '#5A5A40' },
  speciesErrorRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, padding: 12, backgroundColor: '#FFF8E7', borderWidth: 1, borderColor: '#F3D69B' },
  speciesErrorText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#8A5A00', lineHeight: 18 },
  speciesMetaRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  speciesStatusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F0EDE5' },
  speciesStatusText: { fontSize: 10, fontWeight: '900', color: '#5A5A40', textTransform: 'uppercase', letterSpacing: 1.2 },
  speciesConfidenceBlock: { alignItems: 'flex-end' },
  speciesConfidenceLabel: { fontSize: 9, fontWeight: '900', color: '#A19D8F', textTransform: 'uppercase', letterSpacing: 1 },
  speciesConfidenceValue: { marginTop: 1, fontSize: 28, fontWeight: '300', color: '#5A5A40', fontVariant: ['tabular-nums'] },
  speciesNomenclature: { marginTop: 16 },
  speciesTitle: { fontSize: 32, fontWeight: '400', color: '#2C2C2C', lineHeight: 37, fontStyle: 'italic', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }) },
  speciesScientificName: { marginTop: 4, fontSize: 14, fontWeight: '700', color: '#8B8574', fontStyle: 'italic', letterSpacing: 0.4 },
  speciesDivider: { height: 1, backgroundColor: '#EEEAE0', marginVertical: 18 },
  speciesTabs: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, borderBottomWidth: 1, borderBottomColor: '#EEEAE0' },
  speciesTab: { paddingBottom: 9 },
  speciesTabActive: { borderBottomWidth: 2, borderBottomColor: '#5A5A40' },
  speciesTabText: { fontSize: 11, fontWeight: '900', color: '#A19D8F', textTransform: 'uppercase', letterSpacing: 0.8 },
  speciesTabTextActive: { color: '#5A5A40' },
  speciesTabPanel: { marginTop: 16, gap: 14 },
  speciesTaxonomyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  speciesTaxonomyItem: { minWidth: '46%', flex: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: 'rgba(238,234,224,0.70)' },
  speciesTaxonomyLabel: { fontSize: 8, fontWeight: '900', color: '#A19D8F', textTransform: 'uppercase', letterSpacing: 0.8 },
  speciesTaxonomyValue: { marginTop: 3, fontSize: 12, fontWeight: '800', color: '#5A5A40' },
  speciesDetailsBlock: { gap: 7 },
  speciesSectionTitle: { fontSize: 10, fontWeight: '900', color: '#A19D8F', textTransform: 'uppercase', letterSpacing: 1.1 },
  speciesDescription: { fontSize: 13, fontWeight: '400', color: '#555555', lineHeight: 20 },
  speciesBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  speciesBulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: '#5A5A40' },
  speciesBulletText: { flex: 1, fontSize: 12, fontWeight: '400', color: '#555555', lineHeight: 18 },
  speciesEcologyCard: { borderRadius: 18, padding: 14, gap: 8, backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: 'rgba(238,234,224,0.80)' },
  speciesInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#EEEAE0' },
  speciesInfoText: { flex: 1, fontSize: 11, fontWeight: '500', color: '#7C786A', lineHeight: 16 },
  speciesDiscoveryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 18, padding: 14, backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: 'rgba(238,234,224,0.70)' },
  speciesFactText: { flex: 1, fontSize: 12, fontWeight: '400', color: '#555555', lineHeight: 18 },
  speciesFallbackBlock: { marginTop: 16, gap: 10, borderRadius: 18, padding: 12, backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#EEEAE0' },
  speciesRow: { gap: 6 },
  speciesRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  speciesName: { flex: 1, fontSize: 12, fontWeight: '700', color: '#555555', fontStyle: 'italic' },
  speciesPercent: { fontSize: 11, fontWeight: '900', color: '#5A5A40', fontVariant: ['tabular-nums'] },
  speciesProgress: { height: 5, borderRadius: 999, backgroundColor: '#EEEAE0' },
  speciesNote: { marginTop: 16, fontSize: 11, fontWeight: '600', color: '#A19D8F', lineHeight: 16 },

  photoEmptyActions: { flexDirection: 'row', gap: 10 },
  photoEmptyActionsRtl: { flexDirection: 'row-reverse' },
  photoEmptyBtn: {
    flex: 1, height: 130, borderRadius: 18, borderWidth: 1.5, borderColor: '#E7D8C3',
    borderStyle: 'dashed', backgroundColor: '#FFF8F1',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  photoEmptyText: { fontSize: 13, fontWeight: '800', color: '#630E13' },

  locationButton: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: '#FFF8F1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationButtonText: {
    flex: 1,
    color: '#630E13',
    fontSize: 14,
    fontWeight: '900',
  },

  input: {
    minHeight: 50, borderRadius: 16, paddingHorizontal: 14,
    backgroundColor: '#FFF8F1', color: '#2C2418', fontSize: 14,
  },
  textArea: {
    minHeight: 110, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#FFF8F1', color: '#2C2418', fontSize: 14,
    lineHeight: 20, textAlignVertical: 'top',
  },
  otherInput: {
    minHeight: 48, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#FFF8F1', color: '#2C2418', fontSize: 14,
    lineHeight: 20, textAlignVertical: 'top', marginTop: 10,
  },
  otherInputTall: { minHeight: 92 },

  visibilityRow: { flexDirection: 'row', gap: 10 },
  visibilityRowRtl: { flexDirection: 'row-reverse' },
  visibilityCard: {
    flex: 1, minHeight: 76, borderRadius: 18, padding: 12,
    backgroundColor: '#FFF8F1', borderWidth: 1, borderColor: '#F0E2D2',
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  visibilityCardActive: { backgroundColor: '#630E13', borderColor: '#630E13' },
  visibilityCopy: { flex: 1 },
  visibilityTitle: { fontSize: 14, fontWeight: '900', color: '#2C2418', marginBottom: 3 },
  visibilityHint: { fontSize: 11, fontWeight: '700', color: '#8A7A6A', lineHeight: 15 },
  visibilityTextActive: { color: '#fff' },

  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counterRowRtl: { flexDirection: 'row-reverse' },
  counterBtn: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFF8F1',
    alignItems: 'center', justifyContent: 'center',
  },
  counterInput: {
    width: 56, height: 42, borderRadius: 14, backgroundColor: '#FFF8F1',
    textAlign: 'center', fontSize: 18, fontWeight: '900', color: '#2C2418',
  },
  counterSuffix: { fontSize: 13, color: '#8A7A6A', fontWeight: '600' },

  weatherPreview: {
    minHeight: 70,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(99,14,19,0.08)',
  },
  weatherIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherEmoji: { fontSize: 22 },
  weatherCopy: { flex: 1 },
  weatherCondition: { fontSize: 14, fontWeight: '900', color: '#2C2418' },
  weatherMeta: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#6B5D4E', lineHeight: 17 },

  chipScroll: { marginTop: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F6E9DE', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, marginRight: 8,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: '#630E13', maxWidth: 120 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF8F1', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#2C2418', minHeight: 28 },
  emptyText: { fontSize: 14, color: '#8A7A6A', textAlign: 'center', marginTop: 16 },

  submitButton: {
    marginTop: 22, borderRadius: 18, paddingVertical: 16,
    alignItems: 'center', backgroundColor: '#630E13',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  submitButtonDisabled: { opacity: 0.65 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});

