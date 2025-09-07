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

// Travel-themed placeholder with multiple IPFS gateways
const LOADING_PLACEHOLDER = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="192" viewBox="0 0 320 192"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23fef3c7"/><stop offset="100%" stop-color="%23fed7aa"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23bg)"/><rect x="25" y="25" width="270" height="142" rx="12" fill="%23ffffff" fill-opacity="0.9" stroke="%23f59e0b" stroke-width="2"/><circle cx="160" cy="80" r="18" fill="%23f59e0b"/><path d="M150 75 L160 85 L170 75" stroke="%23ffffff" stroke-width="2" fill="none"/><text x="160" y="110" text-anchor="middle" fill="%23d97706" font-size="11" font-family="Inter,sans-serif" font-weight="600">✈️ Loading Travel Photo</text><text x="160" y="128" text-anchor="middle" fill="%23b45309" font-size="9" font-family="Inter,sans-serif">Connecting to IPFS...</text></svg>`;

// Error placeholder when all URLs fail
const ERROR_PLACEHOLDER = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="192" viewBox="0 0 320 192"><defs><linearGradient id="errorBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23fee2e2"/><stop offset="100%" stop-color="%23fecaca"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23errorBg)"/><rect x="25" y="25" width="270" height="142" rx="12" fill="%23ffffff" fill-opacity="0.9" stroke="%23f87171" stroke-width="2" stroke-dasharray="5,5"/><circle cx="160" cy="75" r="20" fill="%23ef4444"/><text x="160" y="82" text-anchor="middle" fill="%23ffffff" font-size="20" font-family="Inter,sans-serif">!</text><text x="160" y="110" text-anchor="middle" fill="%23dc2626" font-size="11" font-family="Inter,sans-serif" font-weight="600">🌍 Image Not Found</text><text x="160" y="128" text-anchor="middle" fill="%23b91c1c" font-size="9" font-family="Inter,sans-serif">Photo temporarily unavailable</text><text x="160" y="145" text-anchor="middle" fill="%23b91c1c" font-size="8" font-family="Inter,sans-serif">Try refreshing the page</text></svg>`;

// Multiple IPFS gateways for maximum reliability  
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',  
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
  'https://4everland.io/ipfs/',
  'https://cf-ipfs.com/ipfs/',
  'https://w3s.link/ipfs/',
  'https://nftstorage.link/ipfs/'
];

export default function NFTCard({ nft, onSelect, onPurchase, showPurchaseButton = true }: NFTCardProps) {
  const { address: connectedWallet } = useAccount();
  const { toast } = useToast();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageSrc, setImageSrc] = useState(LOADING_PLACEHOLDER);
  
  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(0);
  };
  
  // Multi-gateway reliable image loading system
  useEffect(() => {
    const tryUrls: string[] = [];
    
    // 1. Object Storage URL (highest priority)
    if (nft.objectStorageUrl) {
      tryUrls.push(nft.objectStorageUrl);
    }
    
    // 2. Multiple IPFS gateways for maximum reliability
    if (nft.imageUrl) {
      // Extract IPFS hash from any IPFS URL format
      const ipfsHash = nft.imageUrl.match(/\/ipfs\/([a-zA-Z0-9]+)/)?.[1] || 
                       nft.imageUrl.match(/^ipfs:\/\/([a-zA-Z0-9]+)/)?.[1];
      
      if (ipfsHash) {
        // Add all gateway variants for this hash
        IPFS_GATEWAYS.forEach(gateway => {
          const gatewayUrl = gateway + ipfsHash;
          if (!tryUrls.includes(gatewayUrl)) {
            tryUrls.push(gatewayUrl);
          }
        });
      } else if (!tryUrls.includes(nft.imageUrl)) {
        // Direct URL fallback
        tryUrls.push(nft.imageUrl);
      }
    }
    
    if (tryUrls.length === 0) {
      console.log('❌ No image URLs available for NFT:', nft.id);
      setImageLoading(false);
      return;
    }
    
    console.log(`🖼️ Loading ${nft.title} image with ${tryUrls.length} URLs:`, tryUrls.slice(0, 3));
    
    let currentIndex = 0;
    let isDestroyed = false;
    
    const tryNextUrl = () => {
      if (isDestroyed || currentIndex >= tryUrls.length) {
        if (!isDestroyed) {
          console.log(`❌ All ${tryUrls.length} image URLs failed for:`, nft.title);
          setImageSrc(ERROR_PLACEHOLDER); // Show error placeholder
          setImageLoading(false);
        }
        return;
      }
      
      const currentUrl = tryUrls[currentIndex];
      console.log(`🔄 Trying URL ${currentIndex + 1}/${tryUrls.length}:`, currentUrl.slice(0, 80) + '...');
      
      const img = new Image();
      
      // Optimized timeout - faster for better UX
      const timeoutId = setTimeout(() => {
        if (!isDestroyed) {
          console.log(`⏰ URL ${currentIndex + 1} timed out, trying next...`);
          currentIndex++;
          tryNextUrl();
        }
      }, 1200); // Reduced from 1500ms to 1200ms
      
      img.onload = () => {
        clearTimeout(timeoutId);
        if (!isDestroyed) {
          console.log('✅ Image loaded successfully from:', currentUrl.includes('ipfs') ? 'IPFS gateway' : 'storage');
          setImageSrc(currentUrl);
          setImageLoading(false);
        }
      };
      
      img.onerror = () => {
        clearTimeout(timeoutId);
        if (!isDestroyed) {
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
      isDestroyed = true;
    };
  }, [nft.objectStorageUrl, nft.imageUrl, nft.id, nft.title]);
  
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