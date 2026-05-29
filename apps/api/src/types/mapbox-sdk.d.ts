declare module "@mapbox/mapbox-sdk/services/geocoding" {
  interface GeocodingClientConfig {
    accessToken: string;
  }

  interface ForwardGeocodeOptions {
    query: string;
    limit?: number;
    countries?: string[];
    types?: string[];
    language?: string[];
  }

  interface GeocodingFeature {
    center?: [number, number];
    place_name?: string;
  }

  interface GeocodingResponse {
    body: {
      features?: GeocodingFeature[];
    };
  }

  interface GeocodingClient {
    forwardGeocode(options: ForwardGeocodeOptions): {
      send(): Promise<GeocodingResponse>;
    };
  }

  function createGeocodingClient(config: GeocodingClientConfig): GeocodingClient;

  export = createGeocodingClient;
}
