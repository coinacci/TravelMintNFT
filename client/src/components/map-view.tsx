import { useEffect, useRef } from "react";
import L from "leaflet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import cameraMarkerImage from "@assets/IMG_4179_1756807183245.png";

interface NFT {
  id: string;
  title: string;
  description?: string;
  price: string;
  latitude: string;
  longitude: string;
  imageUrl: string;
  location: string;
  isForSale: number;
  createdAt: string;
  owner: { username: string; avatar?: string } | null;
  creator: { username: string; avatar?: string } | null;
}

interface MapViewProps {
  onNFTSelect?: (nft: NFT) => void;
}

export default function MapView({ onNFTSelect }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const queryClient = useQueryClient();

  const { data: nfts = [], isLoading: nftsLoading, isError, error, refetch } = useQuery<NFT[]>({
    queryKey: ["/api/nfts"],
    staleTime: 10 * 1000, // Cache for 10 seconds (reduced for immediate updates)
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
    refetchOnMount: true, // Allow refetch on mount to show new NFTs
    refetchOnWindowFocus: true, // Allow refetch on focus to show updates
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds for new mints
  });
  
  // Log errors for troubleshooting
  if (isError) {
    console.log('Map data fetch error:', error?.message);
  }
  
  // Log NFT count for monitoring
  useEffect(() => {
    console.log('🗺️ Map View loaded', nfts.length, 'NFTs');
  }, [nfts]);

  // Add automatic cache refresh mechanism for new mints
  useEffect(() => {
    const handleStorageChange = () => {
      console.log('🔄 Storage change detected - refreshing NFT data');
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
    };

    // Listen for storage events (when NFTs are minted in other tabs)
    window.addEventListener('storage', handleStorageChange);
    
    // Also expose a global refresh function for manual use
    (window as any).refreshMapNFTs = () => {
      console.log('🔄 Manual NFT refresh triggered');
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
      refetch();
    };

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      delete (window as any).refreshMapNFTs;
    };
  }, [queryClient, refetch]);

  const { data: stats } = useQuery<{ totalNFTs: number; totalVolume: string }>({
    queryKey: ["/api/stats"],
    staleTime: 2 * 60 * 1000, // Cache stats for 2 minutes
    gcTime: 10 * 60 * 1000, // Keep stats in cache for 10 minutes
  });

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView([20, 0], 2);
    mapInstanceRef.current = map;

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap contributors',
      noWrap: true, // Prevents world map from repeating horizontally
    }).addTo(map);

    // Custom camera marker icon
    const customIcon = L.icon({
      iconUrl: cameraMarkerImage,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add NFT markers - even if empty array for proper cleanup
    nfts.forEach((nft, index) => {
      const lat = parseFloat(nft.latitude);
      const lng = parseFloat(nft.longitude);

      // Skip NFTs with invalid coordinates (0,0 or NaN)
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
        console.warn('⚠️ Skipping NFT with invalid coordinates:', nft.title, lat, lng);
        return;
      }

      const customIcon = L.icon({
        iconUrl: cameraMarkerImage,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

      const popupContent = `
        <div class="text-center p-2 min-w-[200px]" style="font-family: Inter, system-ui, sans-serif;">
          <img src="${nft.imageUrl}" alt="${nft.title}" class="w-full h-24 object-cover rounded mb-2" 
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2296%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23ddd%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22>Image not found</text></svg>'" />
          <h3 class="font-semibold text-sm mb-1">${nft.title}</h3>
          <p class="text-xs text-gray-600 mb-2">${nft.location}</p>
          ${nft.isForSale === 1 ? `
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs text-gray-500">Price:</span>
            <span class="font-medium text-sm" style="color: hsl(33, 100%, 50%)">${parseFloat(nft.price).toFixed(0)} USDC</span>
          </div>
          ` : ''}
          <button 
            onclick="window.selectNFT('${nft.id}')"
            class="w-full bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors"
            style="background-color: hsl(199, 89%, 48%)"
          >
            View Details
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);
    });

    // Global function to handle NFT selection from popup
    (window as any).selectNFT = (nftId: string) => {
      const selectedNFT = nfts.find((nft) => nft.id === nftId);
      if (selectedNFT && onNFTSelect) {
        onNFTSelect(selectedNFT);
      }
    };
  }, [nfts, onNFTSelect]);

  return (
    <div className="relative">
      <div ref={mapRef} className="map-container" data-testid="map-container" />


      {/* Floating Stats Panel */}
      <div className="absolute bottom-4 left-4 floating-panel rounded-lg p-4 z-10">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary" data-testid="total-nfts">
            {stats?.totalNFTs || 0}
          </div>
          <div className="text-xs text-muted-foreground">NFTs Minted</div>
        </div>
      </div>
    </div>
  );
}
