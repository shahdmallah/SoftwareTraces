import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import type { Feature, FeatureCollection, Point } from 'geojson';

import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { addLocalFeedItem } from '../data/localSocial';
import { getFollowers, getFollowing, type SocialProfile } from '../api/socialApi';
import { RootStackParamList } from '../navigation/types';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type ComposerRouteProp = RouteProp<RootStackParamList, 'ActivityShareComposer'>;
type ComposerNavigationProp = StackNavigationProp<RootStackParamList, 'ActivityShareComposer'>;
type MapboxModule = typeof import('@rnmapbox/maps');
type LngLat = [number, number];
type PlanVisibility = 'public' | 'private';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
const MAPBOX_STYLE_URL =
  process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/shahdmallah/cmnqgt687000h01s66inve68a';
const DEFAULT_MEETING_COORDINATE: LngLat = [35.22, 31.9];

const BRING_OPTIONS = [
  { en: 'Water', ar: 'ماء' },
  { en: 'Hat', ar: 'قبعة' },
  { en: 'Sunscreen', ar: 'واقي شمس' },
  { en: 'Light jacket', ar: 'معطف خفيف' },
  { en: 'Snacks', ar: 'وجبات خفيفة' },
  { en: 'First aid kit', ar: 'حقيبة إسعاف' },
  { en: 'Power bank', ar: 'شاحن متنقل' },
  { en: 'Comfortable shoes', ar: 'حذاء مريح' },
];

const TRIP_DESCRIPTION_OPTIONS = [
  { en: 'Easy pace', ar: 'وتيرة سهلة' },
  { en: 'Moderate pace', ar: 'وتيرة متوسطة' },
  { en: 'Challenging climbs', ar: 'صعود صعب' },
  { en: 'Photo stops', ar: 'توقفات للتصوير' },
  { en: 'Coffee stop', ar: 'استراحة قهوة' },
  { en: 'Family friendly', ar: 'مناسب للعائلة' },
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

type PickerModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  large?: boolean;
};

function PickerModal({ visible, title, onClose, children, large }: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose} />
      <View style={[modalStyles.sheet, large && modalStyles.sheetLarge]}>
        <View style={modalStyles.handle} />
        <Text style={modalStyles.title}>{title}</Text>
        {children}
        <Pressable style={modalStyles.closeBtn} onPress={onClose}>
          <Text style={modalStyles.closeBtnText}>Done</Text>
        </Pressable>
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
  onAdd: () => void;
  onRemove: (uri: string) => void;
  isArabic: boolean;
};

function PhotoGrid({ photos, onAdd, onRemove, isArabic }: PhotoGridProps) {
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
        <Pressable style={photoStyles.addBtn} onPress={onAdd}>
          <Ionicons name="add" size={28} color="#630E13" />
          <Text style={photoStyles.addText}>{isArabic ? 'إضافة' : 'Add'}</Text>
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
};

const LOCATION_PRESETS = [
  { labelEn: 'Main park entrance', labelAr: 'بوابة الحديقة الرئيسية', lat: 31.9, lng: 35.2 },
  { labelEn: 'Trailhead parking', labelAr: 'موقف السيارات عند بداية المسار', lat: 31.85, lng: 35.15 },
  { labelEn: 'Visitor center', labelAr: 'مركز الزوار', lat: 31.92, lng: 35.22 },
  { labelEn: 'Summit pavilion', labelAr: 'منصة القمة', lat: 31.88, lng: 35.18 },
  { labelEn: 'Wadi Qelt trailhead', labelAr: 'بداية مسار وادي قلط', lat: 31.84, lng: 35.41 },
  { labelEn: 'Makhrour Valley gate', labelAr: 'بوابة وادي مخرور', lat: 31.72, lng: 35.14 },
];

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

function formatCoordinateLabel(coordinate: LngLat) {
  return `${coordinate[1].toFixed(5)}, ${coordinate[0].toFixed(5)}`;
}

function MapPickerModal({ visible, onClose, onConfirm, isArabic, initialCoords }: MapPickerModalProps) {
  const [selected, setSelected] = useState<typeof LOCATION_PRESETS[0] | null>(null);
  const [customText, setCustomText] = useState('');
  const [pickedCoordinate, setPickedCoordinate] = useState<LngLat | null>(
    initialCoords ? [initialCoords.lng, initialCoords.lat] : null,
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    setPickedCoordinate(initialCoords ? [initialCoords.lng, initialCoords.lat] : null);
  }, [initialCoords, visible]);

  const selectedCoordinate = pickedCoordinate ?? (selected ? [selected.lng, selected.lat] as LngLat : null);
  const selectedLabel = customText.trim() || (selected ? (isArabic ? selected.labelAr : selected.labelEn) : '');
  const canRenderMap = Boolean(Mapbox && !mapboxLoadError && MAPBOX_ACCESS_TOKEN);

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
                setSelected(null);
                setPickedCoordinate(coord);
                if (!customText.trim()) {
                  setCustomText(formatCoordinateLabel(coord));
                }
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
            <Ionicons name="location" size={22} color="#630E13" />
            <Text style={mapStyles.pinLabel} numberOfLines={1}>{selectedLabel || formatCoordinateLabel(selectedCoordinate)}</Text>
          </View>
        )}
      </View>

      <Text style={mapStyles.orLabel}>{isArabic ? 'أو اختر من القائمة' : 'Or pick from list'}</Text>
      <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
        {LOCATION_PRESETS.map((loc) => {
          const label = isArabic ? loc.labelAr : loc.labelEn;
          return (
            <OptionRow
              key={loc.labelEn}
              label={label}
              selected={selected?.labelEn === loc.labelEn}
              onPress={() => {
                setSelected(loc);
                setPickedCoordinate([loc.lng, loc.lat]);
                setCustomText('');
              }}
              checkmark
            />
          );
        })}
      </ScrollView>

      <TextInput
        value={customText}
        onChangeText={setCustomText}
        placeholder={isArabic ? 'أو اكتب موقعاً مخصصاً...' : 'Or type a custom location...'}
        placeholderTextColor="#A18F7A"
        style={mapStyles.customInput}
      />

      <Pressable
        style={[mapStyles.confirmBtn, !selectedCoordinate && !customText.trim() && mapStyles.confirmBtnDisabled]}
        onPress={() => {
          const coordinate = selectedCoordinate ?? DEFAULT_MEETING_COORDINATE;
          const label = selectedLabel || formatCoordinateLabel(coordinate);
          if (label) { onConfirm(label, { lat: coordinate[1], lng: coordinate[0] }); onClose(); }
        }}
        disabled={!selectedCoordinate && !customText.trim()}
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
  orLabel: { fontSize: 12, fontWeight: '800', color: '#8A7A6A', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  customInput: { minHeight: 46, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#FFF8F1', color: '#2C2418', fontSize: 14, marginTop: 10, marginBottom: 4 },
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

  // Fields
  const [trail, setTrail] = useState(route.params?.trailName ?? '');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  // Plan-only fields
  const [selectedDateIso, setSelectedDateIso] = useState('');
  const [selectedDateLabel, setSelectedDateLabel] = useState('');
  const [timeText, setTimeText] = useState('');
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

  // Modal visibility
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showBringPicker, setShowBringPicker] = useState(false);
  const [showDescriptionPicker, setShowDescriptionPicker] = useState(false);

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

  const friendOptions = useMemo(() => {
    const q = friendSearch.trim().toLowerCase();
    return q ? contacts.filter(f => f.full_name.toLowerCase().includes(q)) : contacts;
  }, [contacts, friendSearch]);

  const bringOptions = useMemo(
    () => BRING_OPTIONS.map(option => (isArabic ? option.ar : option.en)),
    [isArabic],
  );

  const descriptionOptions = useMemo(
    () => TRIP_DESCRIPTION_OPTIONS.map(option => (isArabic ? option.ar : option.en)),
    [isArabic],
  );

  useEffect(() => {
    setBringItems([...selectedBringItems, customBringItem.trim()].filter(Boolean).join(', '));
  }, [selectedBringItems, customBringItem]);

  useEffect(() => {
    if (!isPlan) return;
    setNote([...selectedDescriptionItems, customDescription.trim()].filter(Boolean).join('. '));
  }, [isPlan, selectedDescriptionItems, customDescription]);

  const toggleSelectedValue = useCallback(
    (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
      setter(prev => (prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]));
    },
    [],
  );

  const handlePickPhoto = async () => {
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

  const handlePost = () => {
    const trimmedTrail = trail.trim() || (isArabic ? 'مسارك' : 'Your trail');
    const trimmedNote = note.trim() || (isArabic ? 'مشاركة لحظة جديدة' : 'Sharing a new trail moment');

    const headcount = parseInt(maxHeadcount, 10) || 6;
    const joined = Math.max(1, 1 + selectedFriends.length);
    const spotsLeft = Math.max(0, headcount - joined);
    const meetingSummary = meetingPlace
      ? `${isArabic ? 'نقطة اللقاء' : 'Meet'}: ${meetingPlace}${
          meetingCoords ? ` (${meetingCoords.lat.toFixed(5)}, ${meetingCoords.lng.toFixed(5)})` : ''
        }`
      : null;

    const item = isPlan
      ? {
          id: `local-plan-${Date.now()}`,
          kind: 'plan' as const,
          trailId: route.params?.trailId ?? '0',
          user: 'You',
          handle: '@you',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=faces&fit=crop&w=240&h=240',
          cover: photos[0] ?? 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
          destinationEn: trimmedTrail,
          destinationAr: trimmedTrail,
          dateEn: [selectedDateLabel, timeText].filter(Boolean).join(' · ') || 'Soon',
          dateAr: [selectedDateLabel, timeText].filter(Boolean).join(' · ') || 'قريباً',
          vibeEn: trimmedNote,
          vibeAr: trimmedNote,
          noteEn: [trimmedNote, meetingSummary, bringItems ? `Bring: ${bringItems}` : null].filter(Boolean).join(' · '),
          noteAr: [trimmedNote, meetingSummary, bringItems ? `أحضر: ${bringItems}` : null].filter(Boolean).join(' · '),
          peopleJoined: joined,
          spotsLeft,
          visibility: planVisibility,
          invitedNames: selectedFriends,
        }
      : {
          id: `local-recap-${Date.now()}`,
          kind: 'recap' as const,
          trailId: '0',
          user: 'You',
          handle: '@you',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=faces&fit=crop&w=240&h=240',
          image: photos[0] ?? 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
          trailNameEn: trimmedTrail,
          trailNameAr: trimmedTrail,
          regionEn: 'Your route',
          regionAr: 'رحلتي',
          captionEn: trimmedNote,
          captionAr: trimmedNote,
          timeEn: 'Just now',
          timeAr: 'الآن',
          likes: 1,
          comments: 0,
          distance: '0.0 km',
        };

    addLocalFeedItem(item);
    Alert.alert(
      isArabic ? 'تم النشر' : 'Posted',
      isArabic
        ? 'تمت مشاركتك في صفحة النشاط.'
        : 'Your post was added to the Activity feed.',
      [{ text: isArabic ? 'حسناً' : 'OK', onPress: () => navigation.navigate('AppTabs', { screen: 'Activity' }) }],
    );
  };

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
                {isPlan ? (isArabic ? 'خطة جديدة' : 'New meetup plan') : isArabic ? 'منشور رحلة' : 'Trail recap'}
              </Text>
              <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>
                {isPlan
                  ? isArabic ? 'ادع الأصدقاء إلى المسار القادم.' : 'Invite friends to your next trail.'
                  : isArabic ? 'شارك لحظة من رحلتك.' : 'Share a moment from your hike.'}
              </Text>
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={80} style={styles.card}>

          {/* ── Photos ── */}
          <FieldRow icon="images-outline" label={isArabic ? 'الصور' : 'Photos'} isArabic={isArabic}>
            {photos.length === 0 ? (
              <Pressable style={styles.photoEmptyBtn} onPress={handlePickPhoto}>
                <Ionicons name="camera-outline" size={28} color="#630E13" />
                <Text style={styles.photoEmptyText}>
                  {isArabic ? 'اضغط لإضافة صور' : 'Tap to add photos'}
                </Text>
              </Pressable>
            ) : (
              <PhotoGrid
                photos={photos}
                onAdd={handlePickPhoto}
                onRemove={uri => setPhotos(p => p.filter(u => u !== uri))}
                isArabic={isArabic}
              />
            )}
          </FieldRow>

          {/* ── Trail name ── */}
          <FieldRow icon="trail-sign-outline" label={isArabic ? 'المسار' : 'Trail'} isArabic={isArabic}>
            <TextInput
              value={trail}
              onChangeText={setTrail}
              placeholder={isArabic ? 'اختر أو اكتب اسم المسار' : 'Choose or type a trail name'}
              placeholderTextColor="#A18F7A"
              style={[styles.input, isArabic ? rtlText : ltrText]}
            />
          </FieldRow>

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
                <TextInput
                  value={timeText}
                  onChangeText={setTimeText}
                  placeholder={isArabic ? 'مثال: 6:00 صباحاً' : 'e.g. 6:00 AM'}
                  placeholderTextColor="#A18F7A"
                  style={[styles.input, isArabic ? rtlText : ltrText]}
                  keyboardType="default"
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
                  {(['public', 'private'] as PlanVisibility[]).map(option => {
                    const active = planVisibility === option;
                    const isPublic = option === 'public';
                    return (
                      <Pressable
                        key={option}
                        style={[styles.visibilityCard, active && styles.visibilityCardActive]}
                        onPress={() => setPlanVisibility(option)}
                      >
                        <Ionicons
                          name={isPublic ? 'globe-outline' : 'people-outline'}
                          size={18}
                          color={active ? '#fff' : '#630E13'}
                        />
                        <View style={styles.visibilityCopy}>
                          <Text style={[styles.visibilityTitle, active && styles.visibilityTextActive]}>
                            {isPublic
                              ? isArabic ? 'عام' : 'Public'
                              : isArabic ? 'خاص' : 'Private'}
                          </Text>
                          <Text style={[styles.visibilityHint, active && styles.visibilityTextActive]} numberOfLines={2}>
                            {isPublic
                              ? isArabic ? 'يظهر في النشاط للجميع' : 'Visible in Activity'
                              : isArabic ? 'للمدعوين فقط' : 'Invited members only'}
                          </Text>
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
                  placeholder={isArabic ? 'اختر الأجواء والوتيرة أو أضف غير ذلك' : 'Choose vibe and pace or add other'}
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
                placeholder={isArabic ? 'اكتب لحظة من الرحلة...' : 'Write a moment from the trail...'}
                placeholderTextColor="#A18F7A"
                style={[styles.textArea, isArabic ? rtlText : ltrText]}
              />
            )}
          </FieldRow>

          <Pressable style={styles.submitButton} onPress={handlePost}>
            <Ionicons name={isPlan ? 'calendar-outline' : 'paper-plane-outline'} size={18} color="#fff" />
            <Text style={styles.submitText}>{isArabic ? 'نشر' : 'Post'}</Text>
          </Pressable>
        </AnimatedBlock>
      </ScrollView>

      {/* ── Map picker modal ── */}
      <MapPickerModal
        visible={showMap}
        onClose={() => setShowMap(false)}
        onConfirm={(label, coords) => { setMeetingPlace(label); setMeetingCoords(coords); }}
        isArabic={isArabic}
        initialCoords={meetingCoords}
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
          {bringOptions.map(option => (
            <OptionRow
              key={option}
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
          {descriptionOptions.map(option => (
            <OptionRow
              key={option}
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

  photoEmptyBtn: {
    height: 130, borderRadius: 18, borderWidth: 1.5, borderColor: '#E7D8C3',
    borderStyle: 'dashed', backgroundColor: '#FFF8F1',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  photoEmptyText: { fontSize: 13, fontWeight: '800', color: '#630E13' },

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
  submitText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
