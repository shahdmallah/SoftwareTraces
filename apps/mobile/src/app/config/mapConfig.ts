// Map configuration for static map image generation
// Add your Mapbox token to your environment or update this file

export const MAP_CONFIG = {
  // Mapbox Static Images API token
  // Get your token at: https://account.mapbox.com/
  // Add to .env as: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token
  MAPBOX_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
  
  // Map style for static images
  // Options: satellite-v9, outdoors-v12, light-v11, dark-v11, streets-v12
  STYLE: 'outdoors-v12',
  
  // Default zoom level for trail previews
  ZOOM: 13,
  
  // Preview dimensions
  PREVIEW_WIDTH: 340,  // 2x of 170 for crisp display
  PREVIEW_HEIGHT: 240, // 2x of 120
};

/**
 * Build Mapbox Static Images URL for a trail preview
 * @param lng - Longitude (usually trail center or mid-point)
 * @param lat - Latitude
 * @returns URL string for the static map image
 */
export function buildMapImageUri(lng: number, lat: number): string {
  const { MAPBOX_TOKEN, STYLE, ZOOM, PREVIEW_WIDTH, PREVIEW_HEIGHT } = MAP_CONFIG;

  if (!MAPBOX_TOKEN) {
    console.warn(
      'Mapbox token not configured. Set EXPO_PUBLIC_MAPBOX_TOKEN env var. ' +
      'Falling back to gradient map.'
    );
    return '';
  }

  // Mapbox Static Images API format:
  // https://api.mapbox.com/styles/v1/{username}/{id}/static/{lon},{lat},{zoom},{bearing},{pitch}/{width}x{height}{@2x}
  const bearing = 0; // North-up
  const pitch = 0;   // No tilt for preview
  const retina = '@2x'; // High DPI

  return (
    `https://api.mapbox.com/styles/v1/mapbox/${STYLE}/static/` +
    `${lng},${lat},${ZOOM},${bearing},${pitch}/` +
    `${PREVIEW_WIDTH}x${PREVIEW_HEIGHT}${retina}` +
    `?access_token=${MAPBOX_TOKEN}&attribution=false`
  );
}
