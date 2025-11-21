import fetch from 'node-fetch';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

// Natural Earth 110m Countries GeoJSON URL
const COUNTRIES_GEOJSON_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

interface CountryProperties {
  NAME: string;
  NAME_LONG: string;
  ABBREV: string;
  FORMAL_EN: string;
  ISO_A2: string;
  ISO_A3: string;
  [key: string]: any;
}

interface CountryFeature {
  type: 'Feature';
  properties: CountryProperties;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: any;
  };
}

interface CountriesGeoJSON {
  type: 'FeatureCollection';
  features: CountryFeature[];
}

class GeoJSONService {
  private countriesData: CountriesGeoJSON | null = null;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.countriesData) {
      return;
    }

    if (this.isLoading) {
      return this.loadPromise!;
    }

    this.isLoading = true;
    this.loadPromise = this.loadCountriesData();
    
    try {
      await this.loadPromise;
    } finally {
      this.isLoading = false;
    }
  }

  private async loadCountriesData(): Promise<void> {
    try {
      console.log('🌍 Downloading Natural Earth countries GeoJSON...');
      const response = await fetch(COUNTRIES_GEOJSON_URL);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch GeoJSON: ${response.statusText}`);
      }

      this.countriesData = await response.json() as CountriesGeoJSON;
      console.log(`✅ Loaded ${this.countriesData.features.length} countries from Natural Earth`);
    } catch (error) {
      console.error('❌ Failed to load countries GeoJSON:', error);
      throw error;
    }
  }

  getCountriesList(): string[] {
    if (!this.countriesData) {
      throw new Error('GeoJSON data not loaded. Call initialize() first.');
    }

    return this.countriesData.features
      .map(f => f.properties.NAME)
      .filter(name => name && name.trim())
      .sort();
  }

  getCountryGeometry(countryName: string): CountryFeature | null {
    if (!this.countriesData) {
      throw new Error('GeoJSON data not loaded. Call initialize() first.');
    }

    const normalizedSearch = countryName.toLowerCase().trim();

    return this.countriesData.features.find(feature => {
      const name = feature.properties.NAME?.toLowerCase();
      const nameLong = feature.properties.NAME_LONG?.toLowerCase();
      const formalName = feature.properties.FORMAL_EN?.toLowerCase();

      return (
        name === normalizedSearch ||
        nameLong === normalizedSearch ||
        formalName === normalizedSearch
      );
    }) || null;
  }

  getAllCountries(): CountryFeature[] {
    if (!this.countriesData) {
      throw new Error('GeoJSON data not loaded. Call initialize() first.');
    }

    return this.countriesData.features;
  }

  isReady(): boolean {
    return this.countriesData !== null;
  }

  isPointInCountry(latitude: number, longitude: number, countryName: string): boolean {
    const country = this.getCountryGeometry(countryName);
    
    if (!country) {
      return false;
    }

    const pt = point([longitude, latitude]); // GeoJSON format: [lng, lat]
    return booleanPointInPolygon(pt, country.geometry);
  }

  filterNFTsByCountry<T extends { latitude: string | null; longitude: string | null }>(
    nfts: T[],
    countryName: string
  ): T[] {
    const country = this.getCountryGeometry(countryName);
    
    if (!country) {
      return [];
    }

    return nfts.filter(nft => {
      if (!nft.latitude || !nft.longitude) {
        return false;
      }

      const lat = parseFloat(nft.latitude);
      const lng = parseFloat(nft.longitude);

      if (isNaN(lat) || isNaN(lng)) {
        return false;
      }

      const pt = point([lng, lat]);
      return booleanPointInPolygon(pt, country.geometry);
    });
  }
}

export const geoJsonService = new GeoJSONService();
