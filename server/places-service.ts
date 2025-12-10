import { db } from "./db";
import { guideCities, guideSpots, type GuideCity, type GuideSpot, type InsertGuideCity, type InsertGuideSpot } from "@shared/schema";
import { eq, sql, ilike, desc } from "drizzle-orm";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  photos?: { photo_reference: string }[];
  opening_hours?: { open_now?: boolean };
  website?: string;
  formatted_phone_number?: string;
  url?: string;
  types?: string[];
  editorial_summary?: { overview?: string };
  address_components?: {
    long_name: string;
    short_name: string;
    types: string[];
  }[];
}

interface PlacesSearchResponse {
  results: GooglePlaceResult[];
  status: string;
  error_message?: string;
}

interface PlaceDetailsResponse {
  result: GooglePlaceResult;
  status: string;
  error_message?: string;
}

function getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
  if (!GOOGLE_PLACES_API_KEY) return '';
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
}

function extractCountryFromComponents(components?: { long_name: string; short_name: string; types: string[] }[]): { country: string; countryCode: string } {
  if (!components) return { country: 'Unknown', countryCode: '' };
  
  const countryComponent = components.find(c => c.types.includes('country'));
  return {
    country: countryComponent?.long_name || 'Unknown',
    countryCode: countryComponent?.short_name || '',
  };
}

function mapCategoryToPlaceTypes(category: string): string[] {
  switch (category) {
    case 'landmark':
      return ['tourist_attraction', 'point_of_interest', 'museum', 'park', 'church', 'mosque', 'hindu_temple', 'synagogue'];
    case 'cafe':
      return ['cafe', 'bakery', 'coffee'];
    case 'restaurant':
      return ['restaurant', 'meal_takeaway', 'meal_delivery'];
    case 'hidden_gem':
      return ['art_gallery', 'book_store', 'library', 'spa', 'bar', 'night_club'];
    default:
      return ['point_of_interest'];
  }
}

export class PlacesService {
  async searchCities(query: string): Promise<GuideCity[]> {
    console.log(`🔍 Searching cities for: "${query}"`);
    
    if (!GOOGLE_PLACES_API_KEY) {
      console.error('❌ GOOGLE_PLACES_API_KEY not configured');
      return [];
    }

    const existingCities = await db.select()
      .from(guideCities)
      .where(ilike(guideCities.name, `%${query}%`))
      .limit(10);

    if (existingCities.length > 0) {
      console.log(`✅ Found ${existingCities.length} cached cities for "${query}"`);
      return existingCities;
    }
    
    console.log(`🌐 No cached cities, calling Google Places API for "${query}"`...);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' city')}&type=locality&key=${GOOGLE_PLACES_API_KEY}`
      );
      
      const data: PlacesSearchResponse = await response.json();
      console.log(`📊 Google Places API response status: ${data.status}, results: ${data.results?.length || 0}`);
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('❌ Places API error:', data.status, data.error_message);
        return [];
      }

      const cities: GuideCity[] = [];
      
      for (const place of data.results.slice(0, 5)) {
        const existingCity = await db.select()
          .from(guideCities)
          .where(eq(guideCities.placeId, place.place_id))
          .limit(1);

        if (existingCity.length > 0) {
          cities.push(existingCity[0]);
          continue;
        }

        const detailsResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=address_components,photos&key=${GOOGLE_PLACES_API_KEY}`
        );
        const detailsData: PlaceDetailsResponse = await detailsResponse.json();
        
        const { country, countryCode } = extractCountryFromComponents(detailsData.result?.address_components);
        const heroPhoto = detailsData.result?.photos?.[0]?.photo_reference;

        const cityData: InsertGuideCity = {
          placeId: place.place_id,
          name: place.name,
          country,
          countryCode,
          heroImageUrl: heroPhoto ? getPhotoUrl(heroPhoto, 800) : null,
          latitude: place.geometry?.location.lat?.toString() || null,
          longitude: place.geometry?.location.lng?.toString() || null,
          searchCount: 1,
        };

        const [insertedCity] = await db.insert(guideCities)
          .values(cityData)
          .returning();
        
        cities.push(insertedCity);
      }

      return cities;
    } catch (error) {
      console.error('Error searching cities:', error);
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
    if (!GOOGLE_PLACES_API_KEY) {
      console.error('GOOGLE_PLACES_API_KEY not configured');
      return [];
    }

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
    
    for (const category of categories) {
      const types = mapCategoryToPlaceTypes(category);
      
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${city.latitude},${city.longitude}&radius=5000&type=${types[0]}&key=${GOOGLE_PLACES_API_KEY}`
        );
        
        const data: PlacesSearchResponse = await response.json();
        
        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          console.error(`Places API error for ${category}:`, data.status);
          continue;
        }

        for (const place of data.results.slice(0, 5)) {
          const existing = await db.select()
            .from(guideSpots)
            .where(eq(guideSpots.placeId, place.place_id))
            .limit(1);

          if (existing.length > 0) {
            await db.update(guideSpots)
              .set({ 
                rating: place.rating?.toString() || null,
                userRatingsTotal: place.user_ratings_total || null,
                openNow: place.opening_hours?.open_now || null,
                lastSyncAt: new Date(),
              })
              .where(eq(guideSpots.placeId, place.place_id));
            continue;
          }

          const detailsResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_address,website,formatted_phone_number,url,editorial_summary&key=${GOOGLE_PLACES_API_KEY}`
          );
          const detailsData: PlaceDetailsResponse = await detailsResponse.json();
          const details = detailsData.result || {};

          const photoRef = place.photos?.[0]?.photo_reference;

          const spotData: InsertGuideSpot = {
            cityId,
            placeId: place.place_id,
            name: place.name,
            category,
            description: details.editorial_summary?.overview || null,
            address: details.formatted_address || place.formatted_address || null,
            rating: place.rating?.toString() || null,
            userRatingsTotal: place.user_ratings_total || null,
            priceLevel: place.price_level || null,
            photoUrl: photoRef ? getPhotoUrl(photoRef) : null,
            latitude: place.geometry?.location.lat?.toString() || null,
            longitude: place.geometry?.location.lng?.toString() || null,
            openNow: place.opening_hours?.open_now || null,
            website: details.website || null,
            phoneNumber: details.formatted_phone_number || null,
            googleMapsUrl: details.url || null,
          };

          await db.insert(guideSpots)
            .values(spotData)
            .onConflictDoNothing();
        }
      } catch (error) {
        console.error(`Error syncing ${category} spots:`, error);
      }
    }
  }
}

export const placesService = new PlacesService();
