// Wikipedia API Service - Free image and info fetching
// Uses Wikimedia Commons REST API (completely free, no API key needed)

interface WikipediaResult {
  title: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  pageUrl: string | null;
}

export async function getWikipediaInfo(placeName: string, city?: string): Promise<WikipediaResult | null> {
  try {
    // Build search query with city context for better results
    const searchQuery = city ? `${placeName} ${city}` : placeName;
    
    // Use Wikipedia REST API to search for the place
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchQuery.replace(/ /g, '_'))}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'TravelMint/1.0 (travel app; contact@travelmint.app)'
      }
    });
    
    if (!response.ok) {
      // Try with just the place name if city-specific search fails
      if (city) {
        return getWikipediaInfo(placeName);
      }
      return null;
    }
    
    const data = await response.json();
    
    return {
      title: data.title || placeName,
      imageUrl: data.originalimage?.source || null,
      thumbnailUrl: data.thumbnail?.source || null,
      description: data.extract || null,
      pageUrl: data.content_urls?.desktop?.page || null
    };
  } catch (error) {
    console.error('Wikipedia API error:', error);
    return null;
  }
}

export async function getPlaceImages(placeNames: string[], city: string): Promise<Map<string, WikipediaResult>> {
  const results = new Map<string, WikipediaResult>();
  
  // Fetch images in parallel but limit concurrency
  const promises = placeNames.slice(0, 5).map(async (name) => {
    const result = await getWikipediaInfo(name, city);
    if (result) {
      results.set(name, result);
    }
  });
  
  await Promise.allSettled(promises);
  return results;
}
