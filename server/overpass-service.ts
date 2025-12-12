// Overpass API Service for querying OpenStreetMap POI data
// Completely free, no API key required

interface OverpassPOI {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat: number;
  lon: number;
  tags: {
    name?: string;
    amenity?: string;
    tourism?: string;
    shop?: string;
    leisure?: string;
    historic?: string;
    'addr:street'?: string;
    'addr:city'?: string;
    opening_hours?: string;
    website?: string;
    phone?: string;
    cuisine?: string;
    [key: string]: string | undefined;
  };
}

export interface POIResult {
  osmId: string;
  name: string;
  category: string;
  subcategory: string;
  lat: number;
  lon: number;
  address?: string;
  openingHours?: string;
  website?: string;
  phone?: string;
  cuisine?: string;
}

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

// Category mapping for user-friendly display
function getCategory(tags: OverpassPOI['tags']): { category: string; subcategory: string } {
  if (tags.amenity) {
    const amenityMap: Record<string, string> = {
      'cafe': 'Kafe',
      'restaurant': 'Restoran',
      'bar': 'Bar',
      'pub': 'Pub',
      'fast_food': 'Fast Food',
      'museum': 'Müze',
      'theatre': 'Tiyatro',
      'cinema': 'Sinema',
      'library': 'Kütüphane',
      'place_of_worship': 'İbadet Yeri',
      'hospital': 'Hastane',
      'pharmacy': 'Eczane',
      'bank': 'Banka',
      'atm': 'ATM',
      'fuel': 'Benzin İstasyonu',
      'parking': 'Otopark',
    };
    return { 
      category: 'Mekan', 
      subcategory: amenityMap[tags.amenity] || tags.amenity 
    };
  }
  
  if (tags.tourism) {
    const tourismMap: Record<string, string> = {
      'attraction': 'Turistik Yer',
      'museum': 'Müze',
      'gallery': 'Galeri',
      'viewpoint': 'Manzara Noktası',
      'hotel': 'Otel',
      'hostel': 'Hostel',
      'guest_house': 'Pansiyon',
      'monument': 'Anıt',
      'artwork': 'Sanat Eseri',
    };
    return { 
      category: 'Turizm', 
      subcategory: tourismMap[tags.tourism] || tags.tourism 
    };
  }
  
  if (tags.shop) {
    const shopMap: Record<string, string> = {
      'supermarket': 'Süpermarket',
      'convenience': 'Market',
      'clothes': 'Giyim',
      'electronics': 'Elektronik',
      'books': 'Kitapçı',
      'bakery': 'Fırın',
      'butcher': 'Kasap',
      'jewelry': 'Kuyumcu',
    };
    return { 
      category: 'Mağaza', 
      subcategory: shopMap[tags.shop] || tags.shop 
    };
  }
  
  if (tags.leisure) {
    const leisureMap: Record<string, string> = {
      'park': 'Park',
      'garden': 'Bahçe',
      'playground': 'Oyun Alanı',
      'sports_centre': 'Spor Merkezi',
      'stadium': 'Stadyum',
      'swimming_pool': 'Yüzme Havuzu',
    };
    return { 
      category: 'Eğlence', 
      subcategory: leisureMap[tags.leisure] || tags.leisure 
    };
  }
  
  if (tags.historic) {
    return { 
      category: 'Tarihi', 
      subcategory: tags.historic 
    };
  }
  
  return { category: 'Diğer', subcategory: 'Mekan' };
}

// Query nearby POIs using Overpass API
export async function getNearbyPOIs(
  lat: number,
  lon: number,
  radiusMeters: number = 500,
  categories: string[] = ['amenity', 'tourism', 'shop', 'leisure', 'historic']
): Promise<POIResult[]> {
  // Build Overpass QL query for multiple categories
  const categoryFilters = categories.map(cat => `node["${cat}"](around:${radiusMeters},${lat},${lon});`).join('\n');
  
  const query = `
    [out:json][timeout:25];
    (
      ${categoryFilters}
    );
    out body;
  `;

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    const elements: OverpassPOI[] = data.elements || [];

    // Transform to our POI format
    const pois: POIResult[] = elements
      .filter(el => el.tags?.name) // Only include named places
      .map(el => {
        const { category, subcategory } = getCategory(el.tags);
        return {
          osmId: `${el.type}/${el.id}`,
          name: el.tags.name!,
          category,
          subcategory,
          lat: el.lat,
          lon: el.lon,
          address: el.tags['addr:street'] 
            ? `${el.tags['addr:street']}${el.tags['addr:city'] ? ', ' + el.tags['addr:city'] : ''}`
            : undefined,
          openingHours: el.tags.opening_hours,
          website: el.tags.website,
          phone: el.tags.phone,
          cuisine: el.tags.cuisine,
        };
      });

    return pois;
  } catch (error) {
    console.error('Overpass API error:', error);
    throw new Error('Failed to fetch nearby places. Please try again.');
  }
}

// Search for POIs by name in a bounding box
export async function searchPOIs(
  searchQuery: string,
  south: number,
  west: number,
  north: number,
  east: number,
  limit: number = 50
): Promise<POIResult[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["name"~"${searchQuery}",i](${south},${west},${north},${east});
    );
    out body ${limit};
  `;

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    const elements: OverpassPOI[] = data.elements || [];

    const pois: POIResult[] = elements
      .filter(el => el.tags?.name)
      .map(el => {
        const { category, subcategory } = getCategory(el.tags);
        return {
          osmId: `${el.type}/${el.id}`,
          name: el.tags.name!,
          category,
          subcategory,
          lat: el.lat,
          lon: el.lon,
          address: el.tags['addr:street'] 
            ? `${el.tags['addr:street']}${el.tags['addr:city'] ? ', ' + el.tags['addr:city'] : ''}`
            : undefined,
          openingHours: el.tags.opening_hours,
          website: el.tags.website,
          phone: el.tags.phone,
          cuisine: el.tags.cuisine,
        };
      });

    return pois;
  } catch (error) {
    console.error('Overpass API search error:', error);
    throw new Error('Failed to search places. Please try again.');
  }
}

// Get POI details by OSM ID
export async function getPOIDetails(osmId: string): Promise<POIResult | null> {
  const [type, id] = osmId.split('/');
  
  const query = `
    [out:json][timeout:10];
    ${type}(${id});
    out body;
  `;

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    const element = data.elements?.[0] as OverpassPOI | undefined;

    if (!element || !element.tags?.name) {
      return null;
    }

    const { category, subcategory } = getCategory(element.tags);
    return {
      osmId,
      name: element.tags.name,
      category,
      subcategory,
      lat: element.lat,
      lon: element.lon,
      address: element.tags['addr:street'] 
        ? `${element.tags['addr:street']}${element.tags['addr:city'] ? ', ' + element.tags['addr:city'] : ''}`
        : undefined,
      openingHours: element.tags.opening_hours,
      website: element.tags.website,
      phone: element.tags.phone,
      cuisine: element.tags.cuisine,
    };
  } catch (error) {
    console.error('Overpass API details error:', error);
    return null;
  }
}
