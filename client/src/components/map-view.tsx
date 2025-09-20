import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import cameraMarkerImage from "@assets/IMG_4179_1756807183245.png";
import { Link } from "wouter";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  isPreview?: boolean; // Preview mode for home page - no interactions
}

export default function MapView({ onNFTSelect, isPreview = false }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const queryClient = useQueryClient();

  const { data: nfts = [], isLoading: nftsLoading, isError, error, refetch } = useQuery<NFT[]>({
    queryKey: ["/api/nfts"],
    staleTime: 1 * 1000, // Cache for 1 second only - faster updates for new mints
    gcTime: 30 * 1000, // Keep in cache for 30 seconds
    refetchOnMount: true, // Allow refetch on mount to show new NFTs
    refetchOnWindowFocus: true, // Allow refetch on focus to show updates
    refetchInterval: 5 * 1000, // Auto-refetch every 5 seconds for immediate mint visibility
    retry: 3, // Retry failed requests
    retryDelay: 500, // Wait 0.5 seconds between retries (faster)
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

    // Initialize Leaflet map with strict single-world enforcement
    const map = L.map(mapRef.current, {
      maxBounds: [[-89, -179.9], [89, 179.9]], // Single world only - strict bounds
      maxBoundsViscosity: 1.0, // Strong bounds enforcement  
      minZoom: 1, // Prevent zooming out too far
      maxZoom: 13 // Reduced to ensure tile availability
    }).setView([20, 0], 1);
    mapInstanceRef.current = map;

    // RELIABLE TILE SERVICE: OpenStreetMap with consistent availability
    // Clean, reliable tiles with good zoom support up to level 19
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap contributors',
      noWrap: true, // PREVENT repetition
      bounds: [[-89, -179.9], [89, 179.9]], // Strict single world
      maxZoom: 13 // Match map maxZoom to prevent missing tiles
    }).addTo(map);

    console.log('🗺️ Reliable OpenStreetMap tiles - no missing data at zoom levels');

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

    // Clear existing markers (Leaflet style)
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Group NFTs by location for clustering support
    const nftsByLocation = new Map<string, NFT[]>();
    
    nfts.forEach((nft) => {
      // Parse coordinates safely with fallbacks
      const lat = typeof nft.latitude === 'string' ? parseFloat(nft.latitude) : (nft.latitude || 0);
      const lng = typeof nft.longitude === 'string' ? parseFloat(nft.longitude) : (nft.longitude || 0);

      // Only skip NFTs with truly invalid coordinates
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('⚠️ Skipping NFT with NaN coordinates:', nft.title, { lat: nft.latitude, lng: nft.longitude, parsed: { lat, lng } });
        return;
      }
      
      // Allow (0,0) coordinates for now but log them for debugging
      if (lat === 0 && lng === 0) {
        console.warn('⚠️ NFT has (0,0) coordinates but showing anyway:', nft.title, { lat: nft.latitude, lng: nft.longitude });
      }

      // Create location key for 1 km² clustering (2 decimal precision ≈ 1 km² grid)
      const locationKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
      
      if (!nftsByLocation.has(locationKey)) {
        nftsByLocation.set(locationKey, []);
      }
      nftsByLocation.get(locationKey)!.push(nft);
    });

    // Add markers for each location group
    nftsByLocation.forEach((locationNFTs, locationKey) => {
      const [lat, lng] = locationKey.split(',').map(Number);
      
      if (locationNFTs.length === 1) {
        // Single NFT - create Leaflet marker with custom icon  
        const nft = locationNFTs[0];
        
        const customIcon = L.icon({
          iconUrl: cameraMarkerImage,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        // Smart image URL selection: Object Storage first, then IPFS fallback
        const imageUrl = (nft as any).objectStorageUrl || (nft.imageUrl.includes('gateway.pinata.cloud') 
          ? nft.imageUrl.replace('gateway.pinata.cloud', 'ipfs.io')
          : nft.imageUrl);
        
        const fallbackUrl = nft.imageUrl.includes('gateway.pinata.cloud') 
          ? nft.imageUrl.replace('gateway.pinata.cloud', 'ipfs.io')
          : nft.imageUrl;

        const popupContent = `
          <div class="text-center p-2 min-w-[200px]" style="font-family: Inter, system-ui, sans-serif;">
            <img src="${imageUrl}" alt="${nft.title}" class="w-full h-24 object-cover rounded mb-2" 
                 onerror="
                   this.onerror=null;
                   this.src='${fallbackUrl}';
                   this.onerror=function(){this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2296%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23ddd%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22>Image not found</text></svg>'};
                 " />
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
      } else {
        // Multiple NFTs at same location - create cluster marker with special popup
        const clusterIcon = L.icon({
          iconUrl: cameraMarkerImage,
          iconSize: [40, 40], // Slightly larger for cluster
          iconAnchor: [20, 20],
          popupAnchor: [0, -20],
          className: 'cluster-marker' // For special styling
        });

        const marker = L.marker([lat, lng], { icon: clusterIcon }).addTo(map);

        // Create multi-NFT popup content
        const multiPopupContent = `
          <div class="text-center p-3 min-w-[240px]" style="font-family: Inter, system-ui, sans-serif;">
            <div class="text-sm font-semibold mb-3 text-center" style="color: hsl(33, 100%, 50%)">
              ${locationNFTs.length} NFTs at ${locationNFTs[0].location}
            </div>
            ${locationNFTs.map(nft => {
              const clusterImageUrl = (nft as any).objectStorageUrl || (nft.imageUrl.includes('gateway.pinata.cloud') 
                ? nft.imageUrl.replace('gateway.pinata.cloud', 'ipfs.io')
                : nft.imageUrl);
              
              const clusterFallbackUrl = nft.imageUrl.includes('gateway.pinata.cloud') 
                ? nft.imageUrl.replace('gateway.pinata.cloud', 'ipfs.io')
                : nft.imageUrl;
                
              return `
              <div class="border rounded mb-2 p-2 bg-gray-50">
                <img src="${clusterImageUrl}" alt="${nft.title}" class="w-full h-16 object-cover rounded mb-1" 
                     onerror="
                       this.onerror=null;
                       this.src='${clusterFallbackUrl}';
                       this.onerror=function(){this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2264%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23ddd%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22>Image not found</text></svg>'};
                     " />
                <h4 class="font-medium text-xs mb-1">${nft.title}</h4>
                ${nft.isForSale === 1 ? `
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs text-gray-500">Price:</span>
                  <span class="font-medium text-xs" style="color: hsl(33, 100%, 50%)">${parseFloat(nft.price).toFixed(0)} USDC</span>
                </div>
                ` : ''}
                <button 
                  onclick="window.selectNFT('${nft.id}')"
                  class="w-full bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors"
                  style="background-color: hsl(199, 89%, 48%)"
                >
                  View Details
                </button>
              </div>
            `;
            }).join('')}
          </div>
        `;

        marker.bindPopup(multiPopupContent);
      }
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
      {!isPreview && (
        <div className="absolute bottom-24 left-4 floating-panel rounded-lg p-3 z-10">
        <div className="text-center">
          <div className="text-xl font-bold text-primary" data-testid="total-nfts">
            {stats?.totalNFTs || 0}
          </div>
          <div className="text-xs text-muted-foreground">NFTs Minted</div>
        </div>
      </div>
      )}

      {/* Floating Mint Button */}
      {!isPreview && (
        <div className="absolute bottom-24 right-4 z-10">
        <Link href="/mint">
          <Button 
            size="sm" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg w-12 h-12 rounded-full p-0"
            data-testid="mint-memory-fab"
          >
            <Upload className="w-5 h-5" />
          </Button>
        </Link>
      </div>
      )}
    </div>
  );
}
