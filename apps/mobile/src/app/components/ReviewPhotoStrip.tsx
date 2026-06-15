import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import type { TrailReview } from '../api/trailsApi';

interface ReviewPhotoStripProps {
  photos?: TrailReview['photos'];
}

export function ReviewPhotoStrip({ photos }: ReviewPhotoStripProps) {
  const visiblePhotos = (photos ?? []).filter((photo) => photo.url);

  if (!visiblePhotos.length) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {visiblePhotos.map((photo) => (
        <View key={photo.id} style={styles.photoFrame}>
          <Image source={{ uri: photo.url }} style={styles.photo} resizeMode="cover" />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
    paddingRight: 2,
  },
  photoFrame: {
    width: 92,
    height: 92,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E7D8C3',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
});
