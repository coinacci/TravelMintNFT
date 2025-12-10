import { db } from "./db";
import { guideCities, guideSpots, type GuideCity, type GuideSpot, type InsertGuideCity, type InsertGuideSpot } from "@shared/schema";
import { eq, sql, ilike, desc } from "drizzle-orm";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface GooglePlaceNew {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  photos?: { name: string }[];
  regularOpeningHours?: { openNow?: boolean };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  types?: string[];
  editorialSummary?: { text?: string };
  addressComponents?: {
    longText: string;
    shortText: string;
    types: string[];
  }[];
}

interface PlacesSearchResponseNew {
  places?: GooglePlaceNew[];
}

interface PlaceDetailsResponseNew extends GooglePlaceNew {}

function getPhotoUrl(photoName: string, maxWidth: number = 400): string {
  if (!GOOGLE_PLACES_API_KEY || !photoName) return '';
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_PLACES_API_KEY}`;
}

function extractCountryFromComponents(components?: { longText: string; shortText: string; types: string[] }[]): { country: string; countryCode: string } {
  if (!components) return { country: 'Unknown', countryCode: '' };
  
  const countryComponent = components.find(c => c.types.includes('country'));
  return {
    country: countryComponent?.longText || 'Unknown',
    countryCode: countryComponent?.shortText || '',
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
    
    console.log(`🌐 No cached cities, calling Google Places API for "${query}"`);

    try {
      const requestBody = {
        textQuery: query,
        maxResultCount: 5
      };
      
      console.log(`🌐 Sending request to Places API (New):`, JSON.stringify(requestBody));
      
      const response = await fetch(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos,places.addressComponents'
          },
          body: JSON.stringify(requestBody)
        }
      );
      
      const data = await response.json();
      console.log(`📊 Google Places API (New) response status: ${response.status}`);
      console.log(`📊 Google Places API (New) response:`, JSON.stringify(data).substring(0, 500));
      
      if (!data.places || data.places.length === 0) {
        console.log('📭 No places found for query');
        return [];
      }

      const cities: GuideCity[] = [];
      
      for (const place of data.places) {
        const existingCity = await db.select()
          .from(guideCities)
          .where(eq(guideCities.placeId, place.id))
          .limit(1);

        if (existingCity.length > 0) {
          cities.push(existingCity[0]);
          continue;
        }

        const { country, countryCode } = extractCountryFromComponents(place.addressComponents);
        const heroPhoto = place.photos?.[0]?.name;

        const cityData: InsertGuideCity = {
          placeId: place.id,
          name: place.displayName?.text || query,
          country,
          countryCode,
          heroImageUrl: heroPhoto ? getPhotoUrl(heroPhoto, 800) : null,
          latitude: place.location?.latitude?.toString() || null,
          longitude: place.location?.longitude?.toString() || null,
          searchCount: 1,
        };

        const [insertedCity] = await db.insert(guideCities)
          .values(cityData)
          .returning();
        
        cities.push(insertedCity);
        console.log(`✅ Added city: ${cityData.name}, ${country}`);
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
          'https://places.googleapis.com/v1/places:searchText',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY!,
              'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.regularOpeningHours,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.editorialSummary'
            },
            body: JSON.stringify({
              textQuery: `${types[0].replace('_', ' ')} in ${city.name}`,
              locationBias: {
                circle: {
                  center: {
                    latitude: parseFloat(city.latitude || '0'),
                    longitude: parseFloat(city.longitude || '0')
                  },
                  radius: 5000.0
                }
              },
              maxResultCount: 5
            })
          }
        );
        
        const data: PlacesSearchResponseNew = await response.json();
        
        if (!data.places || data.places.length === 0) {
          console.log(`📭 No ${category} spots found for ${city.name}`);
          continue;
        }

        console.log(`📍 Found ${data.places.length} ${category} spots for ${city.name}`);

        for (const place of data.places) {
          const existing = await db.select()
            .from(guideSpots)
            .where(eq(guideSpots.placeId, place.id))
            .limit(1);

          if (existing.length > 0) {
            await db.update(guideSpots)
              .set({ 
                rating: place.rating?.toString() || null,
                userRatingsTotal: place.userRatingCount || null,
                openNow: place.regularOpeningHours?.openNow || null,
                lastSyncAt: new Date(),
              })
              .where(eq(guideSpots.placeId, place.id));
            continue;
          }

          const photoName = place.photos?.[0]?.name;
          const priceLevelNum = place.priceLevel ? 
            parseInt(place.priceLevel.replace('PRICE_LEVEL_', '')) - 1 : null;

          const spotData: InsertGuideSpot = {
            cityId,
            placeId: place.id,
            name: place.displayName?.text || 'Unknown',
            category,
            description: place.editorialSummary?.text || null,
            address: place.formattedAddress || null,
            rating: place.rating?.toString() || null,
            userRatingsTotal: place.userRatingCount || null,
            priceLevel: priceLevelNum,
            photoUrl: photoName ? getPhotoUrl(photoName) : null,
            latitude: place.location?.latitude?.toString() || null,
            longitude: place.location?.longitude?.toString() || null,
            openNow: place.regularOpeningHours?.openNow || null,
            website: place.websiteUri || null,
            phoneNumber: place.nationalPhoneNumber || null,
            googleMapsUrl: place.googleMapsUri || null,
          };

          await db.insert(guideSpots)
            .values(spotData)
            .onConflictDoNothing();
        }
      } catch (error) {
        console.error(`❌ Error syncing ${category} spots:`, error);
      }
    }
  }
}

export const placesService = new PlacesService();
