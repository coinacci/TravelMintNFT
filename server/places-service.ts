import { db } from "./db";
import { guideCities, guideSpots, type GuideCity, type GuideSpot, type InsertGuideCity, type InsertGuideSpot } from "@shared/schema";
import { eq, sql, ilike, desc } from "drizzle-orm";

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const NOMINATIM_USER_AGENT = 'TravelMint/1.0 (travel-nft-app)';

interface NominatimPlace {
  place_id: number;
  osm_id: number;
  osm_type: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
    country_code?: string;
  };
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    'name:en'?: string;
    amenity?: string;
    tourism?: string;
    cuisine?: string;
    website?: string;
    phone?: string;
    opening_hours?: string;
    'addr:street'?: string;
    'addr:housenumber'?: string;
    description?: string;
  };
}

function mapCategoryToOverpassQuery(category: string): string {
  switch (category) {
    case 'landmark':
      return `["tourism"~"attraction|museum|monument|artwork|viewpoint"]`;
    case 'cafe':
      return `["amenity"~"cafe|coffee_shop"]`;
    case 'restaurant':
      return `["amenity"="restaurant"]`;
    case 'hidden_gem':
      return `["amenity"~"bar|pub|library|arts_centre"]["name"]`;
    default:
      return `["tourism"="attraction"]`;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class PlacesService {
  private lastRequestTime = 0;
  
  private async rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 1100) {
      await delay(1100 - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
    
    return fetch(url, {
      ...options,
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        ...options?.headers,
      }
    });
  }

  async searchCities(query: string): Promise<GuideCity[]> {
    console.log(`🔍 Searching cities for: "${query}"`);

    const existingCities = await db.select()
      .from(guideCities)
      .where(ilike(guideCities.name, `%${query}%`))
      .limit(10);

    if (existingCities.length > 0) {
      console.log(`✅ Found ${existingCities.length} cached cities for "${query}"`);
      return existingCities;
    }
    
    console.log(`🌐 No cached cities, calling Nominatim API for "${query}"`);

    try {
      const searchUrl = `https://nominatim.openstreetmap.org/search?` + 
        new URLSearchParams({
          q: query,
          format: 'json',
          addressdetails: '1',
          limit: '5',
          featuretype: 'city'
        }).toString();

      const response = await this.rateLimitedFetch(searchUrl);
      const data: NominatimPlace[] = await response.json();
      
      console.log(`📊 Nominatim response: ${data.length} results`);
      
      if (!data || data.length === 0) {
        console.log('📭 No places found for query');
        return [];
      }

      const cities: GuideCity[] = [];
      
      for (const place of data) {
        const placeId = `osm_${place.osm_type}_${place.osm_id}`;
        
        const existingCity = await db.select()
          .from(guideCities)
          .where(eq(guideCities.placeId, placeId))
          .limit(1);

        if (existingCity.length > 0) {
          cities.push(existingCity[0]);
          continue;
        }

        const cityName = place.address?.city || 
                        place.address?.town || 
                        place.address?.village || 
                        place.address?.municipality ||
                        place.display_name.split(',')[0];

        const cityData: InsertGuideCity = {
          placeId,
          name: cityName,
          country: place.address?.country || 'Unknown',
          countryCode: place.address?.country_code?.toUpperCase() || '',
          heroImageUrl: null,
          latitude: place.lat,
          longitude: place.lon,
          searchCount: 1,
        };

        const [insertedCity] = await db.insert(guideCities)
          .values(cityData)
          .returning();
        
        cities.push(insertedCity);
        console.log(`✅ Added city: ${cityData.name}, ${cityData.country}`);
      }

      return cities;
    } catch (error) {
      console.error('❌ Error searching cities:', error);
      return [];
    }
  }

  async getPopularCities(limit: number = 10): Promise<GuideCity[]> {
    return db.select()
      .from(guideCities)
      .orderBy(desc(guideCities.searchCount))
      .limit(limit);
  }

  async getCityById(cityId: string): Promise<GuideCity | null> {
    const [city] = await db.select()
      .from(guideCities)
      .where(eq(guideCities.id, cityId))
      .limit(1);
    
    if (city) {
      await db.update(guideCities)
        .set({ searchCount: sql`${guideCities.searchCount} + 1` })
        .where(eq(guideCities.id, cityId));
    }
    
    return city || null;
  }

  async getSpotsByCity(
    cityId: string,
    category?: string,
    limit: number = 20,
    isHolder: boolean = true
  ): Promise<GuideSpot[]> {
    const city = await this.getCityById(cityId);
    if (!city) return [];

    const existingSpots = await db.select()
      .from(guideSpots)
      .where(eq(guideSpots.cityId, cityId));

    const now = new Date();
    const cacheValid = existingSpots.length > 0 && 
      existingSpots.every(spot => {
        const lastSync = new Date(spot.lastSyncAt);
        return (now.getTime() - lastSync.getTime()) < CACHE_DURATION_MS;
      });

    if (cacheValid) {
      let spots = existingSpots;
      if (category) {
        spots = spots.filter(s => s.category === category);
      }
      
      if (!isHolder) {
        const previewSpots: GuideSpot[] = [];
        const categories = ['landmark', 'cafe', 'restaurant', 'hidden_gem'];
        for (const cat of categories) {
          const catSpot = spots.find(s => s.category === cat);
          if (catSpot) previewSpots.push(catSpot);
        }
        return previewSpots;
      }
      
      return spots.slice(0, limit);
    }

    await this.syncCitySpots(cityId, city);

    const freshSpots = await db.select()
      .from(guideSpots)
      .where(eq(guideSpots.cityId, cityId));

    let spots = freshSpots;
    if (category) {
      spots = spots.filter(s => s.category === category);
    }

    if (!isHolder) {
      const previewSpots: GuideSpot[] = [];
      const categories = ['landmark', 'cafe', 'restaurant', 'hidden_gem'];
      for (const cat of categories) {
        const catSpot = spots.find(s => s.category === cat);
        if (catSpot) previewSpots.push(catSpot);
      }
      return previewSpots;
    }

    return spots.slice(0, limit);
  }

  private async syncCitySpots(cityId: string, city: GuideCity): Promise<void> {
    const categories = ['landmark', 'cafe', 'restaurant', 'hidden_gem'];
    const lat = parseFloat(city.latitude || '0');
    const lon = parseFloat(city.longitude || '0');
    const radius = 5000;
    
    for (const category of categories) {
      const osmQuery = mapCategoryToOverpassQuery(category);
      
      try {
        const overpassQuery = `
          [out:json][timeout:25];
          (
            node${osmQuery}(around:${radius},${lat},${lon});
            way${osmQuery}(around:${radius},${lat},${lon});
          );
          out center 10;
        `;
        
        console.log(`🔍 Searching ${category} spots for ${city.name}...`);
        
        const response = await fetch(
          'https://overpass-api.de/api/interpreter',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `data=${encodeURIComponent(overpassQuery)}`
          }
        );
        
        const data = await response.json();
        const elements: OverpassElement[] = data.elements || [];
        
        if (elements.length === 0) {
          console.log(`📭 No ${category} spots found for ${city.name}`);
          continue;
        }

        console.log(`📍 Found ${elements.length} ${category} spots for ${city.name}`);

        for (const element of elements.slice(0, 5)) {
          const placeId = `osm_${element.type}_${element.id}`;
          const spotLat = element.lat || element.center?.lat;
          const spotLon = element.lon || element.center?.lon;
          const tags = element.tags || {};
          
          if (!tags.name && !tags['name:en']) continue;
          
          const existing = await db.select()
            .from(guideSpots)
            .where(eq(guideSpots.placeId, placeId))
            .limit(1);

          if (existing.length > 0) {
            await db.update(guideSpots)
              .set({ lastSyncAt: new Date() })
              .where(eq(guideSpots.placeId, placeId));
            continue;
          }

          const address = tags['addr:street'] 
            ? `${tags['addr:housenumber'] || ''} ${tags['addr:street']}`.trim()
            : null;

          const osmUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;

          const spotData: InsertGuideSpot = {
            cityId,
            placeId,
            name: tags['name:en'] || tags.name || 'Unknown Place',
            category,
            description: tags.description || (tags.cuisine ? `Cuisine: ${tags.cuisine}` : null),
            address,
            rating: null,
            userRatingsTotal: null,
            priceLevel: null,
            photoUrl: null,
            latitude: spotLat?.toString() || null,
            longitude: spotLon?.toString() || null,
            openNow: null,
            website: tags.website || null,
            phoneNumber: tags.phone || null,
            googleMapsUrl: osmUrl,
          };

          await db.insert(guideSpots)
            .values(spotData)
            .onConflictDoNothing();
            
          console.log(`  ✅ Added: ${spotData.name}`);
        }
        
        await delay(1000);
      } catch (error) {
        console.error(`❌ Error syncing ${category} spots:`, error);
      }
    }
  }
}

export const placesService = new PlacesService();
