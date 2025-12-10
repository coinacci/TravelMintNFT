import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Filter, X, User } from "lucide-react";
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
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const queryClient = useQueryClient();
  const [showBrandOnly, setShowBrandOnly] = useState(false);
  const [showOnlyYours, setShowOnlyYours] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
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

  // Filter NFTs by brand category, owner, and selected creator
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
    
    // Selected Creator filter - show only NFTs by selected creator
    const matchesCreator = selectedCreator
      ? nft.creatorAddress?.toLowerCase() === selectedCreator.toLowerCase()
      : true;
    
    return matchesBrand && matchesOwner && matchesCreator;
  });
  
  // Get selected creator info for display
  const selectedCreatorInfo = selectedCreator ? nfts.find(nft => 
    nft.creatorAddress?.toLowerCase() === selectedCreator.toLowerCase()
  ) : null;
  
  const selectedCreatorName = selectedCreatorInfo ? formatUserDisplayName({
    walletAddress: selectedCreatorInfo.creatorAddress,
    farcasterUsername: selectedCreatorInfo.farcasterCreatorUsername,
    farcasterFid: selectedCreatorInfo.farcasterCreatorFid
  }) : null;
  
  const selectedCreatorNFTCount = selectedCreator ? nfts.filter(nft => 
    nft.creatorAddress?.toLowerCase() === selectedCreator.toLowerCase()
  ).length : 0;
  
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

    // Clear creator filter when clicking on empty map area
    map.on('click', () => {
      // Use global function to check and clear filter
      if ((window as any).clearCreatorFilter) {
        (window as any).clearCreatorFilter();
      }
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

    // Clear existing cluster group
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
    }

    // Create cluster group with custom icon function
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60, // Cluster markers within 60px
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        // Scale emoji size based on count
        let fontSize = 32;
        let iconSize = 40;
        if (count >= 50) {
          fontSize = 52;
          iconSize = 60;
        } else if (count >= 20) {
          fontSize = 44;
          iconSize = 52;
        } else if (count >= 10) {
          fontSize = 40;
          iconSize = 48;
        } else if (count >= 5) {
          fontSize = 36;
          iconSize = 44;
        }
        
        return L.divIcon({
          html: `<div class="cluster-emoji-container">
            <span style="font-size: ${fontSize}px; line-height: 1;">📍</span>
            <span class="cluster-count">${count}</span>
          </div>`,
          className: 'emoji-marker cluster-marker',
          iconSize: [iconSize, iconSize],
          iconAnchor: [iconSize / 2, iconSize - 8],
        });
      }
    });

    clusterGroupRef.current = clusterGroup;

    // Add individual markers to cluster group
    filteredNfts.forEach((nft) => {
      // Parse coordinates safely with fallbacks
      const lat = typeof nft.latitude === 'string' ? parseFloat(nft.latitude) : (nft.latitude || 0);
      const lng = typeof nft.longitude === 'string' ? parseFloat(nft.longitude) : (nft.longitude || 0);

      // Only skip NFTs with truly invalid coordinates
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('⚠️ Skipping NFT with NaN coordinates:', nft.title);
        return;
      }

      // Create individual marker with emoji icon
      const customIcon = L.divIcon({
        html: '<span style="font-size: 28px; line-height: 1;">📍</span>',
        className: `emoji-marker${nft.category?.toLowerCase() === 'brand' ? ' brand-marker' : ''}`,
        iconSize: [32, 32],
        iconAnchor: [16, 28],
        popupAnchor: [0, -24],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

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

      // Format creator display name
      const creatorDisplay = formatUserDisplayName({
        walletAddress: nft.creatorAddress,
        farcasterUsername: nft.farcasterCreatorUsername,
        farcasterFid: nft.farcasterCreatorFid
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
          <p class="text-xs text-gray-500 mb-2">By: ${creatorDisplay}</p>
          ${nft.isForSale === 1 ? `
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs text-gray-500">Price:</span>
            <span class="font-medium text-sm" style="color: hsl(33, 100%, 50%)">${parseFloat(nft.price).toFixed(0)} USDC</span>
          </div>
          ` : ''}
          <div class="flex gap-1">
            <button 
              onclick="window.filterByCreator('${nft.creatorAddress}')"
              class="flex-1 bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-300 transition-colors"
            >
              All by Creator
            </button>
            <button 
              onclick="window.selectNFT('${nft.id}')"
              class="flex-1 bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors"
              style="background-color: hsl(199, 89%, 48%)"
            >
              Details
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      clusterGroup.addLayer(marker);
    });

    // Add cluster group to map
    map.addLayer(clusterGroup);

    // Remove existing polyline and arrow markers if any
    if (polylineRef.current) {
      // Remove all arrow markers if exist
      if ((polylineRef.current as any)._arrowMarkers) {
        (polylineRef.current as any)._arrowMarkers.forEach((marker: L.Marker) => {
          map.removeLayer(marker);
        });
      }
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // Draw travel route polyline when creator filter is active
    if (selectedCreator && filteredNfts.length > 1) {
      // Sort NFTs by creation date (oldest first) to show travel route
      const sortedNfts = [...filteredNfts].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB;
      });

      // Create coordinates array for polyline
      const coordinates: L.LatLngExpression[] = sortedNfts
        .map(nft => {
          const lat = typeof nft.latitude === 'string' ? parseFloat(nft.latitude) : (nft.latitude || 0);
          const lng = typeof nft.longitude === 'string' ? parseFloat(nft.longitude) : (nft.longitude || 0);
          if (isNaN(lat) || isNaN(lng)) return null;
          return [lat, lng] as L.LatLngExpression;
        })
        .filter((coord): coord is L.LatLngExpression => coord !== null);

      if (coordinates.length > 1) {
        // Create styled polyline - travel route from first mint to last mint
        const polyline = L.polyline(coordinates, {
          color: '#0000FF', // Pure blue
          weight: 2, // Thinner line
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round'
        });

        polyline.addTo(map);
        polylineRef.current = polyline;

        // Add arrow markers between each segment (1→2, 2→3, etc.)
        const arrowMarkers: L.Marker[] = [];
        
        for (let i = 0; i < coordinates.length - 1; i++) {
          const fromCoord = coordinates[i] as [number, number];
          const toCoord = coordinates[i + 1] as [number, number];
          
          // Calculate angle for arrow direction
          const angle = Math.atan2(
            toCoord[0] - fromCoord[0],
            toCoord[1] - fromCoord[1]
          ) * (180 / Math.PI);

          // Place arrow 75% along the way (before reaching destination)
          const arrowLat = fromCoord[0] + (toCoord[0] - fromCoord[0]) * 0.75;
          const arrowLng = fromCoord[1] + (toCoord[1] - fromCoord[1]) * 0.75;

          const arrowIcon = L.divIcon({
            html: `<div style="
              font-size: 16px;
              color: #0000FF;
              transform: rotate(${180 - angle}deg);
              text-shadow: 0 0 2px white, 0 0 2px white;
            ">▼</div>`,
            className: 'arrow-marker',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });

          // Place arrow before destination to indicate direction
          const arrowMarker = L.marker([arrowLat, arrowLng], { icon: arrowIcon, interactive: false });
          arrowMarker.addTo(map);
          arrowMarkers.push(arrowMarker);
        }

        // Store arrows with polyline for cleanup
        (polylineRef.current as any)._arrowMarkers = arrowMarkers;
      }
    }

    // Global function to handle NFT selection from popup
    (window as any).selectNFT = (nftId: string) => {
      const selectedNFT = nfts.find((nft) => nft.id === nftId);
      if (selectedNFT && onNFTSelect) {
        onNFTSelect(selectedNFT);
      }
    };
    
    // Global function to filter by creator address
    (window as any).filterByCreator = (creatorAddress: string) => {
      setSelectedCreator(creatorAddress);
      // Close any open popups
      map.closePopup();
    };
    
    // Global function to clear creator filter
    (window as any).clearCreatorFilter = () => {
      setSelectedCreator(null);
    };
  }, [filteredNfts, nfts, onNFTSelect, setSelectedCreator, selectedCreator]);

  return (
    <div className="relative">
      <div ref={mapRef} className="map-container" data-testid="map-container" />

      {/* Selected Creator Banner */}
      {selectedCreator && selectedCreatorName && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 max-w-[280px] md:max-w-sm">
          <div className="bg-primary text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
            <User className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs opacity-80">Showing NFTs by</p>
              <p className="font-semibold text-sm truncate">{selectedCreatorName}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-lg font-bold">{selectedCreatorNFTCount}</span>
              <span className="text-xs opacity-80 ml-1">NFTs</span>
            </div>
            <button
              onClick={() => setSelectedCreator(null)}
              className="p-1 hover:bg-white/20 rounded transition-colors flex-shrink-0"
              data-testid="button-clear-creator-filter"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-center text-xs text-gray-600 mt-1 bg-white/80 rounded px-2 py-0.5">
            Tap empty area to show all
          </p>
        </div>
      )}

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
