export function getDifficultyTone(difficulty: string) {
  if (difficulty === 'Easy') return '#7A9A3A';
  if (difficulty === 'Moderate') return '#D4A843';
  if (difficulty === 'Hard') return '#BB2823';
  return '#630E13';
}

export function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) {
    return '';
  }

  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${point.y}`;
  }

  return points.reduce((path, point, index) =>
    index === 0
      ? `M ${point.x} ${point.y}`
      : `${path} L ${point.x} ${point.y}`,
    ''
  );
}

export function buildMiniRoutePreviewPoints(coordinates: [number, number][] | undefined) {
  if (!coordinates || coordinates.length < 2) {
    return [
      { x: 18, y: 96 },
      { x: 40, y: 78 },
      { x: 54, y: 40 },
      { x: 74, y: 30 },
      { x: 92, y: 22 },
      { x: 110, y: 42 },
      { x: 118, y: 58 },
      { x: 126, y: 76 },
      { x: 142, y: 88 },
      { x: 154, y: 94 },
    ];
  }

  const longitudes = coordinates.map((point) => point[0]);
  const latitudes = coordinates.map((point) => point[1]);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const lngRange = Math.max(0.0001, maxLng - minLng);
  const latRange = Math.max(0.0001, maxLat - minLat);

  // Preserve aspect ratio by using a single scale so the full route fits the preview.
  const scale = Math.min(140 / lngRange, 88 / latRange);

  return coordinates.map(([lng, lat]) => ({
    x: 16 + (lng - minLng) * scale,
    y: 16 + (maxLat - lat) * scale,
  }));
}

export function buildGalleryImages(images: string[], fallbackImage: string) {
  const mergedImages = [fallbackImage, ...images].filter(
    (imageUri, index, collection): imageUri is string =>
      Boolean(imageUri) && collection.indexOf(imageUri) === index,
  );

  const nextImages = mergedImages.length ? [...mergedImages] : ['https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1600'];

  // Pad with mock images so horizontal scrolling can still be tested with sparse trail data.
  const fallbackImages = [
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1600',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1600',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1600',
  ];

  for (const mockImage of fallbackImages) {
    if (nextImages.length >= 3) {
      break;
    }

    if (!nextImages.includes(mockImage)) {
      nextImages.push(mockImage);
    }
  }

  while (nextImages.length < 3) {
    nextImages.push(fallbackImages[nextImages.length % fallbackImages.length]);
  }

  return nextImages;
}