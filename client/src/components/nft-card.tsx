import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink } from "lucide-react";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface NFTCardProps {
  nft: {
    id: string;
    title: string;
    description?: string;
    imageUrl: string;
    objectStorageUrl?: string;
    location: string;
    price: string;
    isForSale: number;
    ownerAddress?: string;
    creator: { username: string; avatar?: string } | null;
    owner: { id?: string; username: string; avatar?: string } | null;
  };
  onSelect?: () => void;
  onPurchase?: () => void;
  showPurchaseButton?: boolean;
}

// Simple loading placeholder
const LOADING_PLACEHOLDER = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="192" viewBox="0 0 320 192"><rect width="100%" height="100%" fill="%23f8fafc"/><rect x="30" y="30" width="260" height="132" rx="8" fill="%23e2e8f0" stroke="%23cbd5e1" stroke-width="2"/><circle cx="160" cy="96" r="20" fill="%23fbbf24"/><text x="160" y="170" text-anchor="middle" fill="%23475569" font-size="12" font-family="Inter,sans-serif">📷 Loading...</text></svg>`;

export default function NFTCard({ nft, onSelect, onPurchase, showPurchaseButton = true }: NFTCardProps) {
  const { address: connectedWallet } = useAccount();
  const { toast } = useToast();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageSrc, setImageSrc] = useState(LOADING_PLACEHOLDER);
  
  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(0);
  };
  
  // Smart image loading with robust IPFS gateway fallbacks and improved timeouts
  useEffect(() => {
    // Expand IPFS URLs to multiple gateways for redundancy
    const expandIPFSUrl = (url: string): string[] => {
      if (!url) return [];
      
      // If already an IPFS gateway URL, extract hash and create fallbacks
      if (url.includes('/ipfs/')) {
        const hash = url.split('/ipfs/')[1];
        if (hash) {
          const cleanHash = hash.split('?')[0]; // Remove query params
          return [
            url, // Keep original first
            `https://ipfs.io/ipfs/${cleanHash}`,              // Most reliable public gateway
            `https://cloudflare-ipfs.com/ipfs/${cleanHash}`,  // Fast CDN
            `https://dweb.link/ipfs/${cleanHash}`,            // Protocol Labs
            `https://4everland.io/ipfs/${cleanHash}`          // Alternative gateway
          ];
        }
      }
      
      return [url];
    };
    
    // Priority order: Object Storage -> IPFS with multiple gateway fallbacks
    const tryUrls: string[] = [];
    
    // 1. Object Storage URL (preferred for speed)
    if (nft.objectStorageUrl) {
      tryUrls.push(nft.objectStorageUrl);
    }
    
    // 2. IPFS URL with multiple gateway fallbacks
    if (nft.imageUrl && !tryUrls.includes(nft.imageUrl)) {
      const ipfsUrls = expandIPFSUrl(nft.imageUrl);
      // Add all IPFS gateway options
      ipfsUrls.forEach(url => {
        if (!tryUrls.includes(url)) {
          tryUrls.push(url);
        }
      });
    }
    
    if (tryUrls.length === 0) {
      console.log('❌ No image URLs available');
      setImageLoading(false);
      return;
    }
    
    console.log('🖼️ Loading NFT image with URLs:', tryUrls);
    
    let currentIndex = 0;
    let isCompleted = false;
    
    const tryNextUrl = () => {
      if (currentIndex >= tryUrls.length || isCompleted) {
        if (!isCompleted) {
          console.log('❌ All image URLs failed');
          setImageLoading(false);
        }
        return;
      }
      
      const currentUrl = tryUrls[currentIndex];
      console.log(`🔄 Trying URL ${currentIndex + 1}/${tryUrls.length}:`, currentUrl);
      
      const img = new Image();
      
      // Progressive timeout: faster for object storage, longer for IPFS gateways
      const isObjectStorage = currentUrl.includes('/objects/');
      const isFirstIPFS = currentIndex === 1; // First IPFS gateway (after object storage)
      const timeout = isObjectStorage ? 2000 : (isFirstIPFS ? 8000 : 12000);
      
      const timeoutId = setTimeout(() => {
        if (!isCompleted) {
          console.log(`⏰ URL ${currentIndex + 1} timed out, trying next...`);
          currentIndex++;
          tryNextUrl();
        }
      }, timeout);
      
      img.onload = () => {
        if (!isCompleted) {
          clearTimeout(timeoutId);
          console.log('✅ Image loaded successfully from:', currentUrl);
          setImageSrc(currentUrl);
          setImageLoading(false);
          isCompleted = true;
        }
      };
      img.onerror = () => {
        if (!isCompleted) {
          clearTimeout(timeoutId);
          console.log(`❌ URL ${currentIndex + 1} failed, trying next...`);
          currentIndex++;
          tryNextUrl();
        }
      };
      img.src = currentUrl;
    };
    
    tryNextUrl();
    
    // Cleanup function
    return () => {
      isCompleted = true;
    };
  }, [nft.objectStorageUrl, nft.imageUrl]);
  
  // Check if the connected wallet owns this NFT
  const isOwnNFT = connectedWallet && (
    (nft.ownerAddress && connectedWallet.toLowerCase() === nft.ownerAddress.toLowerCase()) ||
    (nft.owner?.id && connectedWallet.toLowerCase() === nft.owner.id.toLowerCase())
  );
  

  return (
    <Card 
      className="group cursor-pointer hover:shadow-lg transition-all duration-200 bg-card border-border/40 overflow-hidden"
      onClick={onSelect}
      data-testid={`nft-card-${nft.id}`}
    >
      <div className="relative h-48 overflow-hidden bg-muted">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        )}
        
        <img
          src={imageSrc}
          alt={nft.title}
          className={`w-full h-48 object-cover transition-opacity duration-300 ${
            imageLoading ? 'opacity-0' : 'opacity-100'
          }`}
          data-testid={`nft-image-${nft.id}`}
        />
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm" data-testid={`nft-title-${nft.id}`}>
            {nft.title}
          </h3>
        </div>
        
        <div className="flex items-center text-xs text-muted-foreground mb-3">
          <MapPin className="w-3 h-3 mr-1" />
          <span data-testid={`nft-location-${nft.id}`}>{nft.location}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {nft.owner?.avatar && (
              <img
                src={nft.owner.avatar}
                alt="Owner profile"
                className="w-6 h-6 rounded-full"
                data-testid={`owner-avatar-${nft.id}`}
              />
            )}
            <span className="text-xs text-muted-foreground" data-testid={`owner-username-${nft.id}`}>
              Owner: {nft.owner?.username || 'unknown'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Always show price for NFTs for sale */}
            {nft.isForSale === 1 && (
              <span className="text-sm font-semibold text-primary" data-testid={`nft-price-${nft.id}`}>
                {formatPrice(nft.price)} USDC
              </span>
            )}
            
            
            {/* Purchase button for NFTs owned by others */}
            {showPurchaseButton && nft.isForSale === 1 && !isOwnNFT && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onPurchase?.();
                }}
                data-testid={`purchase-button-${nft.id}`}
              >
                Buy
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}