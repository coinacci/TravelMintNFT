import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Filter, X, User, MapPin, Navigation, Loader2, Check, Search } from "lucide-react";
import { formatUserDisplayName } from "@/lib/userDisplay";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { encodeFunctionData, parseEther } from "viem";
import { useToast } from "@/hooks/use-toast";
import { useFarcasterAuth } from "@/hooks/use-farcaster-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

const QUEST_MANAGER_ADDRESS = "0xC280030c2d15EF42C207a35CcF7a63A4760d8967" as `0x${string}`;
const CHECK_IN_QUEST_ID = 2;
const CHECK_IN_FEE = "0.00005"; // ETH

const QUEST_ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "questId", "type": "uint256" }],
    "name": "completeQuest",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

interface POI {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  lat: number;
  lon: number;
  address?: string;
  distance?: number;
}

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
  const poiLayerRef = useRef<L.LayerGroup | null>(null);
  const userCircleRef = useRef<L.Circle | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userCheckinsLayerRef = useRef<L.LayerGroup | null>(null);
  const queryClientHook = useQueryClient();
  const { toast } = useToast();
  const { user: farcasterUser } = useFarcasterAuth();
  const [showBrandOnly, setShowBrandOnly] = useState(false);
  const [showOnlyYours, setShowOnlyYours] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const { address: walletAddress } = useAccount();
  
  // Check-in state
  const [checkInDrawerOpen, setCheckInDrawerOpen] = useState(false);
  const [checkInStep, setCheckInStep] = useState<'list' | 'confirm'>('list');
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [pendingCheckInPOI, setPendingCheckInPOI] = useState<POI | null>(null);
  const [checkInComment, setCheckInComment] = useState("");
  const [placeDetailsPOI, setPlaceDetailsPOI] = useState<POI | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<POI[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const checkInRadius = 500; // 500 meters
  
  // Blockchain transaction for check-in
  const { sendTransaction, data: txHash, isPending: isTxPending, reset: resetTx } = useSendTransaction();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  
  // Reset "Only Yours" filter when wallet disconnects
  useEffect(() => {
    if (!walletAddress && showOnlyYours) {
      setShowOnlyYours(false);
    }
  }, [walletAddress, showOnlyYours]);

  // Fetch nearby POIs when drawer is open and have location
  const { data: nearbyPOIs = [], isLoading: poisLoading, refetch: refetchPOIs } = useQuery<POI[]>({
    queryKey: ["/api/places/nearby", userLocation?.lat, userLocation?.lon, checkInRadius],
    queryFn: async () => {
      if (!userLocation) return [];
      const response = await fetch(
        `/api/places/nearby?lat=${userLocation.lat}&lon=${userLocation.lon}&radius=${checkInRadius}`
      );
      if (!response.ok) throw new Error("Failed to fetch nearby places");
      const data = await response.json();
      return data.pois || [];
    },
    enabled: checkInDrawerOpen && !!userLocation,
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch user's check-ins to display on explore mode
  const { data: userCheckins = [] } = useQuery<{
    osm_id: string;
    place_name: string;
    place_category: string;
    latitude: string;
    longitude: string;
    comment?: string;
    created_at: string;
  }[]>({
    queryKey: ["/api/checkins/user", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      const response = await fetch(`/api/checkins/user/${walletAddress}?limit=100`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.checkins || [];
    },
    enabled: !!walletAddress,
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch check-ins for a specific place
  const { data: placeCheckins = [], isLoading: placeCheckinsLoading } = useQuery<{
    wallet_address: string;
    farcaster_username?: string;
    comment?: string;
    created_at: string;
    points_earned: number;
  }[]>({
    queryKey: ["/api/checkins/place", placeDetailsPOI?.id],
    queryFn: async () => {
      if (!placeDetailsPOI) return [];
      const response = await fetch(`/api/checkins/place/${encodeURIComponent(placeDetailsPOI.id)}`);
      if (!response.ok) throw new Error("Failed to fetch place check-ins");
      const data = await response.json();
      return data.checkins || [];
    },
    enabled: !!placeDetailsPOI,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Check-in mutation (stores location data in DB after blockchain tx confirms)
  const checkInMutation = useMutation({
    mutationFn: async ({ poi, comment }: { poi: POI; comment: string }) => {
      if (!walletAddress) throw new Error("Wallet not connected");
      
      const payload = {
        walletAddress,
        farcasterFid: farcasterUser?.fid?.toString() || null,
        farcasterUsername: farcasterUser?.username || null,
        osmId: poi.id,
        placeName: poi.name,
        placeCategory: poi.category,
        placeSubcategory: poi.subcategory || null,
        latitude: poi.lat,
        longitude: poi.lon,
        txHash: txHash || null, // Include tx hash for reference
        comment: comment.trim() || null, // Add user comment
      };
      
      const response = await apiRequest("POST", "/api/checkins", payload);
      return { response, osmId: poi.id };
    },
    onSuccess: (data) => {
      // Invalidate all check-in related queries for immediate refresh
      queryClient.invalidateQueries({ queryKey: ["/api/checkins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/checkins/place", data.osmId] });
      queryClient.invalidateQueries({ queryKey: ["/api/checkins/user", walletAddress] });
      // Clear comment after successful submission
      setCheckInComment("");
    },
  });
  
  // Handle blockchain transaction success - store check-in data and show success
  useEffect(() => {
    if (isTxSuccess && pendingCheckInPOI) {
      // Store check-in data in database with comment
      checkInMutation.mutate({ poi: pendingCheckInPOI, comment: checkInComment });
      
      toast({
        title: "Check-in Successful! ✓",
        description: `You checked in at ${pendingCheckInPOI.name}. +10 points earned on-chain!`,
      });
      
      // Reset state and close drawer
      setCheckInDrawerOpen(false);
      setCheckInStep('list');
      setSelectedPOI(null);
      setPendingCheckInPOI(null);
      setCheckInComment("");
      resetTx();
    }
  }, [isTxSuccess, pendingCheckInPOI]);
  
  // Function to initiate on-chain check-in
  const initiateCheckIn = useCallback((poi: POI) => {
    if (!walletAddress) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to check in.",
        variant: "destructive"
      });
      return;
    }
    
    console.log("Initiating check-in for POI:", poi.name);
    setPendingCheckInPOI(poi);
    
    const data = encodeFunctionData({
      abi: QUEST_ABI,
      functionName: 'completeQuest',
      args: [BigInt(CHECK_IN_QUEST_ID)]
    });
    
    console.log("Sending transaction to QuestManager...");
    sendTransaction({
      to: QUEST_MANAGER_ADDRESS,
      value: parseEther(CHECK_IN_FEE),
      data
    });
  }, [walletAddress, sendTransaction, toast]);

  // Get user location
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location services");
      return;
    }
    
    setLocationLoading(true);
    setLocationError(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setUserLocation(loc);
        setLocationLoading(false);
        
        // Pan and zoom map to user location (zoom 19 for maximum street detail)
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([loc.lat, loc.lon], 19);
        }
      },
      (error) => {
        setLocationLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission denied. Please enable location access in your browser/app settings.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location unavailable");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out");
            break;
          default:
            setLocationError("Unable to get location");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Open check-in drawer and get location
  const openCheckInDrawer = useCallback(() => {
    setCheckInDrawerOpen(true);
    setCheckInStep('list');
    getUserLocation();
  }, [getUserLocation]);

  // Handle drawer close
  const handleDrawerClose = useCallback((open: boolean) => {
    if (!open && !isTxPending && !isTxConfirming) {
      setCheckInDrawerOpen(false);
      setCheckInStep('list');
      setSelectedPOI(null);
      setPendingCheckInPOI(null);
      setCheckInComment("");
      setSearchQuery("");
      setSearchResults([]);
      resetTx();
    }
  }, [isTxPending, isTxConfirming, resetTx]);

  // Search places by name using Nominatim
  const searchPlaces = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      // Use Nominatim for search, with viewbox if user location is available
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1`;
      
      // If user has location, prioritize nearby results
      if (userLocation) {
        const delta = 0.1; // ~10km box
        url += `&viewbox=${userLocation.lon - delta},${userLocation.lat + delta},${userLocation.lon + delta},${userLocation.lat - delta}&bounded=0`;
      }
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'TravelMint/1.0' }
      });
      
      if (!response.ok) throw new Error("Search failed");
      
      const data = await response.json();
      
      const results: POI[] = data.map((item: any) => {
        // Calculate distance if user location available
        let distance: number | undefined;
        if (userLocation) {
          const R = 6371000; // Earth radius in meters
          const dLat = (parseFloat(item.lat) - userLocation.lat) * Math.PI / 180;
          const dLon = (parseFloat(item.lon) - userLocation.lon) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(parseFloat(item.lat) * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distance = R * c;
        }
        
        return {
          id: item.osm_id?.toString() || item.place_id?.toString() || `search-${Date.now()}`,
          name: item.display_name?.split(',')[0] || item.name || query,
          category: item.type || item.class || 'Place',
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          address: item.display_name,
          distance
        };
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [userLocation]);

  // Select a POI for check-in
  const selectPOIForCheckIn = useCallback((poi: POI) => {
    setSelectedPOI(poi);
    setCheckInStep('confirm');
  }, []);

  // Category emoji mapping
  const getCategoryEmoji = (category: string): string => {
    const emojiMap: Record<string, string> = {
      'Kafe': '☕',
      'Restoran': '🍽️',
      'Bar': '🍺',
      'Müze': '🏛️',
      'Park': '🌳',
      'Alışveriş': '🛍️',
      'Otel': '🏨',
      'Hastane': '🏥',
      'Eczane': '💊',
      'Banka': '🏦',
      'Market': '🛒',
      'Benzinlik': '⛽',
      'Cami': '🕌',
      'Kilise': '⛪',
      'Okul': '🏫',
      'Üniversite': '🎓',
      'Kütüphane': '📚',
      'Spor': '⚽',
      'Sinema': '🎬',
      'Tiyatro': '🎭',
      'Havalimanı': '✈️',
      'Tren İstasyonu': '🚆',
      'Otobüs Durağı': '🚌',
      'Metro': '🚇',
      'Plaj': '🏖️',
      'Dağ': '⛰️',
    };
    return emojiMap[category] || '📍';
  };

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
    // Default maxZoom is 13 for privacy (NFT locations hidden at street level)
    // When check-in mode is active, maxZoom increases to 19 for street-level accuracy
    const map = L.map(mapRef.current, {
      maxBounds: [[-89, -179.9], [89, 179.9]], // Single world only - strict bounds
      maxBoundsViscosity: 1.0, // Strong bounds enforcement  
      minZoom: 1, // Prevent zooming out too far
      maxZoom: 13, // Default: restricted for NFT owner privacy
      zoomControl: false // Disable default zoom control to reposition it
    }).setView([20, 0], 1);
    mapInstanceRef.current = map;

    // Add zoom control with custom position below header
    L.control.zoom({
      position: 'topleft'
    }).addTo(map);

    // RELIABLE TILE SERVICE: OpenStreetMap with consistent availability
    // Tiles support up to zoom 19, but map maxZoom controls actual limit
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap contributors',
      noWrap: true, // PREVENT repetition
      bounds: [[-89, -179.9], [89, 179.9]], // Strict single world
      maxZoom: 19 // Tiles available up to 19, map maxZoom controls actual limit
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

    // Remove existing polyline if any
    if (polylineRef.current) {
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
          weight: 1.5, // Thin line
          opacity: 0.8,
          dashArray: '8, 6', // Dashed line pattern
          lineCap: 'round',
          lineJoin: 'round'
        });

        polyline.addTo(map);
        polylineRef.current = polyline;
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

  // User check-ins layer effect - show user's check-ins on explore mode (when not in check-in mode)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear existing user checkins layer
    if (userCheckinsLayerRef.current) {
      map.removeLayer(userCheckinsLayerRef.current);
      userCheckinsLayerRef.current = null;
    }

    // Only show user check-ins if user has check-ins
    if (userCheckins.length === 0) return;

    const checkinsLayer = L.layerGroup();

    userCheckins.forEach((checkin) => {
      const lat = parseFloat(checkin.latitude);
      const lon = parseFloat(checkin.longitude);
      if (isNaN(lat) || isNaN(lon)) return;

      const checkinIcon = L.divIcon({
        html: `<div class="checkin-marker"><span style="font-size: 18px;">🔹</span></div>`,
        className: 'checkin-marker-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -20],
      });

      const marker = L.marker([lat, lon], { icon: checkinIcon });
      
      const popupContent = `
        <div class="text-center p-2 min-w-[160px]" style="font-family: Inter, system-ui, sans-serif;">
          <div class="text-xl mb-1">🔹</div>
          <h3 class="font-semibold text-sm mb-1" style="color: #000">${checkin.place_name}</h3>
          <p class="text-xs text-gray-600 mb-1">${checkin.place_category}</p>
          ${checkin.comment ? `<p class="text-xs text-gray-500 italic mt-1">"${checkin.comment}"</p>` : ''}
          <p class="text-xs text-blue-600 mt-2">${new Date(checkin.created_at).toLocaleDateString()}</p>
        </div>
      `;

      marker.bindPopup(popupContent);
      checkinsLayer.addLayer(marker);
    });

    checkinsLayer.addTo(map);
    userCheckinsLayerRef.current = checkinsLayer;
  }, [userCheckins]);

  // User location marker effect - show user location when drawer is open
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear existing user marker and circle
    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }
    if (userCircleRef.current) {
      map.removeLayer(userCircleRef.current);
      userCircleRef.current = null;
    }

    // Only show user location when drawer is open with valid location
    if (!checkInDrawerOpen || !userLocation) return;

    // Create user location marker
    const userIcon = L.divIcon({
      html: '<div class="user-location-marker"><span style="font-size: 24px;">📍</span></div>',
      className: 'user-marker-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });

    const userMarker = L.marker([userLocation.lat, userLocation.lon], { icon: userIcon });
    userMarker.bindPopup('<div class="text-center p-2"><strong>Your Location</strong></div>');
    userMarker.addTo(map);
    userMarkerRef.current = userMarker;

    // Create radius circle (blue)
    const circle = L.circle([userLocation.lat, userLocation.lon], {
      radius: checkInRadius,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 2,
      dashArray: '5, 5',
    });
    circle.addTo(map);
    userCircleRef.current = circle;

    // Pan map to user location
    map.setView([userLocation.lat, userLocation.lon], 17);
  }, [checkInDrawerOpen, userLocation, checkInRadius]);

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

      {/* Check-in Button */}
      <div className="absolute top-16 md:top-32 right-4 z-10">
        <Button
          onClick={openCheckInDrawer}
          disabled={locationLoading}
          className="px-4 py-2 rounded-full shadow-lg flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-800 border border-gray-200"
          data-testid="button-checkin-toggle"
        >
          <Navigation className="w-4 h-4" />
          <span>Check-in</span>
        </Button>
      </div>

      {/* Check-in Drawer (Bottom Sheet) */}
      <Drawer open={checkInDrawerOpen} onOpenChange={handleDrawerClose}>
        <DrawerContent className="max-h-[85vh]">
          {checkInStep === 'list' ? (
            <>
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-blue-500" />
                  Check-in
                </DrawerTitle>
                <DrawerDescription>
                  Select a nearby place to check in and earn 10 points
                </DrawerDescription>
              </DrawerHeader>

              <div className="px-4 pb-4">
                {/* Search Input */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (e.target.value.length >= 2) {
                          searchPlaces(e.target.value);
                        } else {
                          setSearchResults([]);
                        }
                      }}
                      placeholder="Search for a place..."
                      className="w-full px-4 py-2 pl-10 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      data-testid="input-search-place"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>
                </div>

                {/* Search Results */}
                {searchQuery.length >= 2 && searchResults.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Search results</p>
                    <ScrollArea className="h-[30vh]">
                      <div className="space-y-2 pr-4">
                        {searchResults.map((poi) => (
                          <button
                            key={poi.id}
                            onClick={() => selectPOIForCheckIn(poi)}
                            className="w-full text-left bg-blue-900 hover:bg-blue-800 border border-blue-700 hover:border-blue-500 rounded-lg p-3 transition-colors"
                            data-testid={`search-result-${poi.id}`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">{getCategoryEmoji(poi.category)}</span>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate text-white">{poi.name}</h4>
                                {poi.distance && (
                                  <p className="text-xs text-blue-400 mt-1">
                                    {poi.distance > 1000 
                                      ? `${(poi.distance / 1000).toFixed(1)}km away`
                                      : `${Math.round(poi.distance)}m away`
                                    }
                                  </p>
                                )}
                              </div>
                              <Check className="w-4 h-4 text-blue-400" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Location status */}
                {locationLoading && (
                  <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Getting your location...</span>
                  </div>
                )}

                {locationError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-700">{locationError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={getUserLocation}
                      className="mt-2"
                      data-testid="button-retry-location"
                    >
                      Try Again
                    </Button>
                  </div>
                )}

                {/* Nearby POI List */}
                {userLocation && !locationLoading && !searchQuery && (
                  <>
                    {poisLoading ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Finding nearby places...</span>
                      </div>
                    ) : nearbyPOIs.length === 0 ? (
                      <div className="text-center py-8">
                        <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No places found within 500m</p>
                        <p className="text-gray-400 text-sm mt-1">Use the search above to find a place</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[40vh]">
                        <div className="space-y-2 pr-4">
                          <p className="text-xs text-gray-500 mb-3">
                            {nearbyPOIs.length} places within 500m
                          </p>
                          {nearbyPOIs.map((poi) => (
                            <button
                              key={poi.id}
                              onClick={() => selectPOIForCheckIn(poi)}
                              className="w-full text-left bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-lg p-3 transition-colors"
                              data-testid={`poi-item-${poi.id}`}
                            >
                              <div className="flex items-start gap-3">
                                <span className="text-2xl">{getCategoryEmoji(poi.category)}</span>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate text-white">{poi.name}</h4>
                                  {poi.distance && (
                                    <p className="text-xs text-blue-400 mt-1">
                                      {Math.round(poi.distance)}m away
                                    </p>
                                  )}
                                </div>
                                <Check className="w-4 h-4 text-gray-500" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </>
                )}
              </div>

              <DrawerFooter>
                <Button
                  variant="outline"
                  onClick={() => setCheckInDrawerOpen(false)}
                  data-testid="button-close-checkin-drawer"
                >
                  Close
                </Button>
              </DrawerFooter>
            </>
          ) : (
            <>
              {/* Confirm Step */}
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2">
                  <span className="text-2xl">{selectedPOI ? getCategoryEmoji(selectedPOI.category) : '📍'}</span>
                  Confirm Check-in
                </DrawerTitle>
                <DrawerDescription>
                  Earn 10 points (on-chain, {CHECK_IN_FEE} ETH gas)
                </DrawerDescription>
              </DrawerHeader>

              <div className="px-4 pb-4">
                {selectedPOI && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h3 className="font-semibold text-lg">{selectedPOI.name}</h3>
                      <p className="text-sm text-gray-600">{selectedPOI.category}</p>
                      {selectedPOI.distance && (
                        <p className="text-sm text-blue-600 mt-1">
                          {Math.round(selectedPOI.distance)}m away
                        </p>
                      )}
                    </div>

                    {/* Comment textarea */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Add a note (optional)
                      </label>
                      <textarea
                        value={checkInComment}
                        onChange={(e) => setCheckInComment(e.target.value)}
                        placeholder="Share your experience at this place..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={3}
                        maxLength={500}
                        disabled={isTxPending || isTxConfirming}
                        data-testid="input-checkin-comment"
                      />
                      <p className="text-xs text-gray-400 text-right mt-1">{checkInComment.length}/500</p>
                    </div>

                    {!walletAddress && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-yellow-800">
                          Please connect your wallet to check in.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <DrawerFooter className="flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCheckInStep('list');
                    setSelectedPOI(null);
                    setCheckInComment("");
                    resetTx();
                  }}
                  disabled={isTxPending || isTxConfirming}
                  className="flex-1"
                  data-testid="button-back-to-list"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (selectedPOI) initiateCheckIn(selectedPOI);
                  }}
                  disabled={!walletAddress || isTxPending || isTxConfirming}
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                  data-testid="button-checkin-confirm"
                >
                  {isTxPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Confirm in wallet...
                    </>
                  ) : isTxConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Check-in ({CHECK_IN_FEE} ETH)
                    </>
                  )}
                </Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
