import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import cameraMarkerImage from "@assets/IMG_4179_1756807183245.png";
import { Search, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatUserDisplayName } from "@/lib/userDisplay";
import { useAccount } from "wagmi";

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
  ownerAddress: string;
  creatorAddress: string;
  farcasterOwnerUsername?: string | null;
  farcasterOwnerFid?: string | null;
  farcasterCreatorUsername?: string | null;
  farcasterCreatorFid?: string | null;
  country?: string;
  category?: string;
}

interface MapViewProps {
  onNFTSelect?: (nft: NFT) => void;
}

export default function MapView({ onNFTSelect }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const queryClient = useQueryClient();
  const [showBrandOnly, setShowBrandOnly] = useState(false);
  const [showOnlyYours, setShowOnlyYours] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { address: walletAddress } = useAccount();
  
  // Reset "Only Yours" filter when wallet disconnects
  useEffect(() => {
    if (!walletAddress && showOnlyYours) {
      setShowOnlyYours(false);
    }
  }, [walletAddress, showOnlyYours]);

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

  // Filter NFTs by brand category and owner
  const filteredNfts = nfts.filter(nft => {
    // Brand filter - exclude "Zora $10" from Brand filter display (handles emojis and extra characters)
    // Match only titles that start with "zora $10 " (with space) or are exactly "zora $10"
    const normalizedTitle = nft.title.trim().toLowerCase();
    const isZora10 = normalizedTitle === 'zora $10' || normalizedTitle.startsWith('zora $10 ');
    const matchesBrand = showBrandOnly
      ? (nft.category?.toLowerCase() === 'brand' && !isZora10)
      : true;
    
    // Only Yours filter - show only NFTs owned by current user
    const matchesOwner = showOnlyYours && walletAddress
      ? nft.ownerAddress?.toLowerCase() === walletAddress.toLowerCase()
      : true;
    
    return matchesBrand && matchesOwner;
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


  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize Leaflet map with strict single-world enforcement
    const map = L.map(mapRef.current, {
      maxBounds: [[-89, -179.9], [89, 179.9]], // Single world only - strict bounds
      maxBoundsViscosity: 1.0, // Strong bounds enforcement  
      minZoom: 1, // Prevent zooming out too far
      maxZoom: 13, // Reduced to ensure tile availability
      zoomControl: false // Disable default zoom control to reposition it
    }).setView([20, 0], 1);
    mapInstanceRef.current = map;

    // Add zoom control with custom position below header
    L.control.zoom({
      position: 'topleft'
    }).addTo(map);

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
    
    filteredNfts.forEach((nft) => {
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

        // Add blue halo effect for Brand category NFTs
        if (nft.category?.toLowerCase() === 'brand') {
          const markerElement = marker.getElement();
          if (markerElement) {
            markerElement.style.filter = 'drop-shadow(0 0 12px rgba(60, 138, 255, 0.8))';
          }
        }

        // Smart image URL selection: Object Storage first, then IPFS fallback
        const imageUrl = (nft as any).objectStorageUrl || (nft.imageUrl.includes('gateway.pinata.cloud') 
          ? nft.imageUrl.replace('gateway.pinata.cloud', 'ipfs.io')
          : nft.imageUrl);
        
        const fallbackUrl = nft.imageUrl.includes('gateway.pinata.cloud') 
          ? nft.imageUrl.replace('gateway.pinata.cloud', 'ipfs.io')
          : nft.imageUrl;

        // Format owner display name
        const ownerDisplay = formatUserDisplayName({
          walletAddress: nft.ownerAddress,
          farcasterUsername: nft.farcasterOwnerUsername,
          farcasterFid: nft.farcasterOwnerFid
        });

        const popupContent = `
          <div class="text-center p-2 min-w-[200px]" style="font-family: Inter, system-ui, sans-serif;">
            <img src="${imageUrl}" alt="${nft.title}" class="w-full h-24 object-cover rounded mb-2" 
                 onerror="
                   this.onerror=null;
                   this.src='${fallbackUrl}';
                   this.onerror=function(){this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2296%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23ddd%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22>Image not found</text></svg>'};
                 " />
            <h3 class="font-semibold text-sm mb-1" style="color: #000">${nft.title}</h3>
            <p class="text-xs text-gray-600 mb-1">${nft.location}</p>
            <p class="text-xs text-gray-500 mb-2">Owner: ${ownerDisplay}</p>
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

        // Add double halo effect if any NFT in cluster is Brand category
        // Inner orange ring + outer blue ring for Brand clusters
        const hasBrandNFT = locationNFTs.some(nft => nft.category?.toLowerCase() === 'brand');
        if (hasBrandNFT) {
          const markerElement = marker.getElement();
          if (markerElement) {
            // Sharp dual-ring: tight orange + outer blue with minimal blur
            markerElement.style.filter = 'drop-shadow(0 0 3px rgba(255, 138, 60, 1)) drop-shadow(0 0 3px rgba(255, 138, 60, 0.8)) drop-shadow(0 0 12px rgba(60, 138, 255, 1)) drop-shadow(0 0 16px rgba(60, 138, 255, 0.6))';
          }
        }

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
              
              // Format owner display name
              const clusterOwnerDisplay = formatUserDisplayName({
                walletAddress: nft.ownerAddress,
                farcasterUsername: nft.farcasterOwnerUsername,
                farcasterFid: nft.farcasterOwnerFid
              });
                
              return `
              <div class="border rounded mb-2 p-2 bg-gray-50">
                <img src="${clusterImageUrl}" alt="${nft.title}" class="w-full h-16 object-cover rounded mb-1" 
                     onerror="
                       this.onerror=null;
                       this.src='${clusterFallbackUrl}';
                       this.onerror=function(){this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2264%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23ddd%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22>Image not found</text></svg>'};
                     " />
                <h4 class="font-medium text-xs mb-1" style="color: #000">${nft.title}</h4>
                <p class="text-xs text-gray-500 mb-1">Owner: ${clusterOwnerDisplay}</p>
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
  }, [filteredNfts, nfts, onNFTSelect]);

  return (
    <div className="relative">
      <div ref={mapRef} className="map-container" data-testid="map-container" />

      {/* Filters Dropdown */}
      <div className="absolute top-4 md:top-20 right-4 z-10 w-48 md:w-56">
        <div className="bg-background/95 backdrop-blur shadow-lg rounded overflow-hidden">
          {/* Filters Header Button */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-100/50 transition-colors"
            data-testid="button-filters-toggle"
          >
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-black" />
              <span className="text-sm font-medium text-black">Filters</span>
              {(showBrandOnly || showOnlyYours) && (
                <span className="bg-primary text-white text-xs px-1.5 py-0.5 rounded-full">
                  {(showBrandOnly ? 1 : 0) + (showOnlyYours ? 1 : 0)}
                </span>
              )}
            </div>
            {filtersOpen ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
          
          {/* Filter Options */}
          {filtersOpen && (
            <div className="border-t border-gray-200 px-3 py-2 space-y-2">
              {/* Brand Filter Checkbox */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBrandOnly}
                  onChange={(e) => setShowBrandOnly(e.target.checked)}
                  className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  data-testid="checkbox-brand-filter"
                />
                <span className="text-sm text-black">Show Brand NFTs Only</span>
              </label>
              
              {/* Only Yours Filter Checkbox */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyYours}
                  onChange={(e) => setShowOnlyYours(e.target.checked)}
                  disabled={!walletAddress}
                  className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                  data-testid="checkbox-only-yours-filter"
                />
                <span className={`text-sm ${walletAddress ? 'text-black' : 'text-gray-400'}`}>Only Yours</span>
              </label>
              
              {/* Filter Count */}
              {(showBrandOnly || showOnlyYours) && (
                <div className="text-xs text-muted-foreground text-right pt-1 border-t border-gray-100">
                  {filteredNfts.length} NFT{filteredNfts.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
