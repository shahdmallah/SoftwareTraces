import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedEntrance } from '../AnimatedUI';
import { completionRadii, completionShadow } from '../../features/trailCompletion/theme';
import { ltrText, rtlText } from '../../utils/direction';

type Props = {
  photoUris: string[];
  isArabic: boolean;
  isOwner?: boolean;
  ownerName?: string;
  delay?: number;
  onOpenPhoto?: (uri: string) => void;
};

export function PhotoGalleryStrip({ photoUris, isArabic, isOwner = true, ownerName, delay = 300, onOpenPhoto }: Props) {
  const displayName = ownerName?.trim() || 'Trail friend';

  return (
    <AnimatedEntrance
      fromY={14}
      duration={440}
      delay={delay}
      style={[styles.section, completionShadow.card]}
    >
      <View style={styles.sectionHead}>
        <Text style={[styles.title, isArabic ? rtlText : ltrText]}>
          {isOwner ? (isArabic ? 'ذكرياتك من هذه الرحلة' : 'Your memories from this hike') : (isArabic ? `صور رحلة ${displayName}` : `${displayName}'s hike photos`)}
        </Text>
        <Text style={[styles.sub, isArabic ? rtlText : ltrText]}>
          {isOwner ? (isArabic ? 'لقطات التقطتها أثناء المسار' : 'Moments you captured along the way') : (isArabic ? 'لقطات من الجولة المنشورة' : 'Moments from the published outing')}
        </Text>
      </View>

      {photoUris.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.row, isArabic && styles.rowRtl]}
        >
          {photoUris.map((uri, index) => (
            <Pressable key={`${uri}-${index}`} onPress={() => onOpenPhoto?.(uri)} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="images-outline" size={28} color="#8A7A6A" />
          <Text style={[styles.emptyText, isArabic ? rtlText : ltrText]}>
            {isOwner
              ? (isArabic ? 'لم تُضف صوراً هذه المرة — يمكنك مشاركة الملخص فقط.' : 'No photos this time — your recap still tells the story.')
              : (isArabic ? 'لا توجد صور منشورة لهذه الجولة.' : 'No photos were published for this outing.')}
          </Text>
        </View>
      )}
    </AnimatedEntrance>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: completionRadii.card,
    backgroundColor: '#FFFCF8',
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,36,24,0.06)',
  },
  sectionHead: {
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2C2418',
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B5D4E',
    fontWeight: '600',
  },
  row: {
    paddingHorizontal: 14,
    gap: 12,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  thumbWrap: {
    borderRadius: completionRadii.thumb,
    overflow: 'hidden',
  },
  thumb: {
    width: 132,
    height: 168,
    borderRadius: completionRadii.thumb,
    backgroundColor: '#E7D8C3',
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 10,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: '#6B5D4E',
    fontWeight: '600',
  },
});
