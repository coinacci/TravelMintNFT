import { useEffect, useRef } from "react";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";

interface NFT {
  id: string;
  title: string;
  price: string;
  latitude: string;
  longitude: string;
  imageUrl: string;
  location: string;
  owner: { username: string; avatar?: string } | null;
  creator: { username: string; avatar?: string } | null;
}

interface MapViewProps {
  onNFTSelect?: (nft: NFT) => void;
}

export default function MapView({ onNFTSelect }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const { data: nfts = [] } = useQuery<NFT[]>({
    queryKey: ["/api/nfts"],
  });

  const { data: stats } = useQuery<{ totalNFTs: number; totalVolume: string }>({
    queryKey: ["/api/stats"],
  });

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView([20, 0], 2);
    mapInstanceRef.current = map;

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Custom marker icon
    const customIcon = L.divIcon({
      className: "custom-marker",
      html: `<div class="w-8 h-8 bg-primary rounded-full border-2 border-white shadow-lg flex items-center justify-center marker-pulse">
               <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                 <path d="M10 2L3 7v11h14V7l-7-5z"/>
               </svg>
             </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !nfts.length) return;

    const map = mapInstanceRef.current;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Add NFT markers
    nfts.forEach((nft) => {
      const lat = parseFloat(nft.latitude);
      const lng = parseFloat(nft.longitude);

      if (isNaN(lat) || isNaN(lng)) return;

      const customIcon = L.divIcon({
        className: "custom-marker",
        html: `<div class="w-8 h-8 bg-primary rounded-full border-2 border-white shadow-lg flex items-center justify-center marker-pulse cursor-pointer">
                 <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                   <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                 </svg>
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

      const popupContent = `
        <div class="text-center p-2 min-w-[200px]" style="font-family: Inter, system-ui, sans-serif;">
          <img src="${nft.imageUrl}" alt="${nft.title}" class="w-full h-24 object-cover rounded mb-2" />
          <h3 class="font-semibold text-sm mb-1">${nft.title}</h3>
          <p class="text-xs text-gray-600 mb-2">${nft.location}</p>
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs text-gray-500">Price:</span>
            <span class="font-medium text-sm" style="color: hsl(33, 100%, 50%)">${parseFloat(nft.price).toFixed(0)} USDC</span>
          </div>
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

      {/* Floating Search Panel */}
      <div className="absolute top-4 left-4 right-4 md:left-auto md:w-80 floating-panel rounded-lg p-4 z-10">
        <div className="flex items-center space-x-2 mb-3">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search locations or NFTs..."
            className="flex-1 bg-transparent border-none outline-none text-sm"
            data-testid="search-input"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs hover:bg-primary/90 transition-colors" data-testid="filter-popular">
            Popular
          </button>
          <button className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs hover:bg-secondary/80 transition-colors" data-testid="filter-recent">
            Recent
          </button>
          <button className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs hover:bg-secondary/80 transition-colors" data-testid="filter-trending">
            Trending
          </button>
        </div>
      </div>

      {/* Floating Stats Panel */}
      <div className="absolute bottom-4 left-4 floating-panel rounded-lg p-4 z-10">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary" data-testid="total-nfts">
              {stats?.totalNFTs || 0}
            </div>
            <div className="text-xs text-muted-foreground">NFTs Minted</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-accent" data-testid="total-volume">
              {stats?.totalVolume || "0"}K
            </div>
            <div className="text-xs text-muted-foreground">USDC Volume</div>
          </div>
        </div>
      </div>
    </div>
  );
}
