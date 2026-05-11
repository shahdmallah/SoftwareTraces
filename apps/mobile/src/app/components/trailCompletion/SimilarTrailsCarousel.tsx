import React from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { Trail } from '../../api/trailsApi';
import { completionRadii } from '../../features/trailCompletion/theme';
import type { RootStackParamList } from '../../navigation/types';
import { ltrText, rtlText } from '../../utils/direction';

type Nav = StackNavigationProp<RootStackParamList>;

type Props = {
  trails: Trail[];
  isArabic: boolean;
  navigation: Nav;
  onTrailPress?: (trailId: string) => void;
};

export function SimilarTrailsCarousel({ trails, isArabic, navigation, onTrailPress }: Props) {
  if (!trails.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, isArabic ? rtlText : ltrText]}>
        {isArabic ? 'مسارات قريبة تشبه اختيارك' : 'Nearby trails you might love'}
      </Text>
      <FlatList
        horizontal
        data={trails}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              onTrailPress?.(item.id);
              navigation.navigate('TrailDetail', { trailId: item.id });
            }}
          >
            <Image source={{ uri: item.image }} style={styles.image} />
            <View style={styles.body}>
              <Text style={[styles.name, isArabic ? rtlText : ltrText]} numberOfLines={2}>
                {isArabic ? item.nameAr || item.name : item.name}
              </Text>
              <View style={styles.meta}>
                <Ionicons name="navigate-outline" size={12} color="#630E13" />
                <Text style={styles.metaText}>{item.distance} km</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2C2418',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  list: {
    gap: 12,
    paddingBottom: 4,
  },
  card: {
    width: 168,
    borderRadius: completionRadii.card,
    overflow: 'hidden',
    backgroundColor: '#FFFCF8',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,36,24,0.08)',
  },
  image: {
    width: '100%',
    height: 104,
    backgroundColor: '#E7D8C3',
  },
  body: {
    padding: 12,
  },
  name: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2C2418',
    lineHeight: 17,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B5D4E',
  },
});
