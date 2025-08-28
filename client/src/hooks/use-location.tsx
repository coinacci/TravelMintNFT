import { useState, useCallback } from "react";

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = useCallback(() => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Try to get address from coordinates using reverse geocoding
          // For demo purposes, we'll use a mock address
          const address = await reverseGeocode(latitude, longitude);
          
          setLocation({
            latitude,
            longitude,
            address,
          });
        } catch (err) {
          // Still set location even if reverse geocoding fails
          setLocation({
            latitude,
            longitude,
          });
        }
        
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  }, []);

  // Mock reverse geocoding function
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    // In a real app, you would use a service like Google Maps Geocoding API
    // For demo purposes, return a mock address based on coordinates
    const mockAddresses = [
      "Paris, France",
      "Tokyo, Japan",
      "New York, USA",
      "London, UK",
      "Sydney, Australia",
      "Rome, Italy",
    ];
    
    return mockAddresses[Math.floor(Math.random() * mockAddresses.length)];
  };

  return {
    location,
    loading,
    error,
    getCurrentLocation,
  };
}
