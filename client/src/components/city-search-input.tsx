import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Search } from "lucide-react";

interface City {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
  place_id: string;
}

interface CitySearchInputProps {
  onCitySelect: (city: { name: string; latitude: number; longitude: number }) => void;
  placeholder?: string;
  className?: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function CitySearchInput({ 
  onCitySelect, 
  placeholder = "Search for a city...",
  className = "" 
}: CitySearchInputProps) {
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>('');
  
  const debouncedQuery = useDebounce(query, 500); // 500ms debounce
  const resultsRef = useRef<HTMLDivElement>(null);
  const lastRequestTime = useRef<number>(0);

  // Close results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Search cities using OpenStreetMap Nominatim API
  const searchCities = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setCities([]);
      return;
    }

    // Enforce 1 request per second rate limit
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime.current;
    if (timeSinceLastRequest < 1000) {
      const delay = 1000 - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    lastRequestTime.current = Date.now();

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&` +
        `q=${encodeURIComponent(searchQuery)}&` +
        `limit=10&` +
        `addressdetails=1&` +
        `accept-language=en&` +
        `class=place&` +
        `type=city,town,village`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log(`🔍 Nominatim API response for "${searchQuery}":`, {
        totalResults: data.length,
        sampleResults: data.slice(0, 3).map((item: any) => ({
          name: item.display_name,
          type: item.type,
          category: item.category,
          importance: item.importance
        }))
      });
      
      // Filter for cities, towns, and other settlements - be more inclusive
      const filteredCities = data.filter((place: any) => {
        const type = place.type?.toLowerCase() || '';
        const category = place.category?.toLowerCase() || '';
        const osm_type = place.osm_type?.toLowerCase() || '';
        
        // Include places that are cities, towns, villages, or administrative areas
        const validCategories = ['place', 'boundary'];
        const validTypes = ['city', 'town', 'village', 'municipality', 'administrative', 'suburb', 'hamlet'];
        
        return validCategories.includes(category) || validTypes.some(validType => type.includes(validType));
      });

      // Sort by importance (if available) and take top results
      const sortedCities = filteredCities.sort((a: any, b: any) => {
        const aImportance = parseFloat(a.importance || '0');
        const bImportance = parseFloat(b.importance || '0');
        return bImportance - aImportance; // Higher importance first
      });

      setCities(sortedCities.slice(0, 8)); // Limit to top 8 results
      setShowResults(filteredCities.length > 0);
    } catch (err) {
      console.error('City search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search cities');
      setCities([]);
      setShowResults(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger search when debounced query changes
  useEffect(() => {
    searchCities(debouncedQuery);
  }, [debouncedQuery, searchCities]);

  // Generate random coordinates within city bounding box
  const generateRandomCoordinates = (boundingbox: [string, string, string, string]) => {
    const [south, north, west, east] = boundingbox.map(coord => parseFloat(coord));
    
    // Add small padding to ensure coordinates are well within the city
    const padding = 0.01; // ~1km padding
    const lat = south + padding + Math.random() * (north - south - 2 * padding);
    const lng = west + padding + Math.random() * (east - west - 2 * padding);
    
    return { latitude: lat, longitude: lng };
  };

  const handleCitySelect = (city: City) => {
    const cleanCityName = city.display_name.split(',')[0].trim(); // Take first part before comma
    setSelectedCity(cleanCityName);
    setQuery(cleanCityName);
    setShowResults(false);
    
    // Generate random coordinates within city bounds
    const coordinates = generateRandomCoordinates(city.boundingbox);
    
    console.log(`🏙️ Selected city: ${cleanCityName} at random coordinates:`, coordinates);
    
    onCitySelect({
      name: cleanCityName,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude
    });
  };

  return (
    <div className={`relative ${className}`} ref={resultsRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value !== selectedCity) {
              setSelectedCity('');
            }
          }}
          onFocus={() => {
            if (cities.length > 0) {
              setShowResults(true);
            }
          }}
          placeholder={placeholder}
          className="pl-10 pr-10"
          data-testid="city-search-input"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Results dropdown */}
      {showResults && cities.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {cities.map((city) => (
            <Button
              key={city.place_id}
              variant="ghost"
              className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-accent"
              onClick={() => handleCitySelect(city)}
              data-testid={`city-option-${city.place_id}`}
            >
              <div className="flex items-start space-x-3">
                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {city.display_name.split(',')[0]}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {city.display_name.split(',').slice(1).join(',').trim()}
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-2 text-xs text-destructive">
          ❌ {error}
        </div>
      )}

      {/* Selected city confirmation */}
      {selectedCity && (
        <div className="mt-2 text-xs text-primary">
          ✅ Selected: {selectedCity} (random location within city)
        </div>
      )}
    </div>
  );
}