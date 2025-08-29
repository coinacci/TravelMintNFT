import { useState, useCallback } from "react";

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
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
          // Get city name from coordinates using reverse geocoding
          const cityName = await reverseGeocode(latitude, longitude);
          
          setLocation({
            latitude,
            longitude,
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            city: cityName,
          });
        } catch (err) {
          // If reverse geocoding fails, still set coordinates
          setLocation({
            latitude,
            longitude,
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            city: "Unknown City",
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


  // Function to convert Turkish characters to English equivalents
  const turkishToEnglish = (text: string): string => {
    const turkishChars: { [key: string]: string } = {
      'ç': 'c', 'Ç': 'C',
      'ğ': 'g', 'Ğ': 'G', 
      'ı': 'i', 'I': 'I',
      'İ': 'I', 'i': 'i',
      'ö': 'o', 'Ö': 'O',
      'ş': 's', 'Ş': 'S',
      'ü': 'u', 'Ü': 'U'
    };
    
    return text.replace(/[çÇğĞıIİiöÖşŞüÜ]/g, (char) => turkishChars[char] || char);
  };

  // Reverse geocoding function using OpenStreetMap Nominatim API
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1&accept-language=en`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }
      
      const data = await response.json();
      
      // Extract city name from the response
      const address = data.address;
      let city = address?.city || 
                 address?.town || 
                 address?.village || 
                 address?.municipality || 
                 address?.county || 
                 address?.state || 
                 "Unknown Location";
      
      // Convert Turkish characters to English for blockchain compatibility
      city = turkishToEnglish(city);
      
      return city;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return "Unknown City";
    }
  };

  return {
    location,
    loading,
    error,
    getCurrentLocation,
  };
}
