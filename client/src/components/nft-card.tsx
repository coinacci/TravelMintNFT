import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink } from "lucide-react";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import alohomoraCamera from "@assets/alohomora-camera.jpg";

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

// Use only reliable Pinata gateway to prevent mobile app hanging
const RELIABLE_IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

export default function NFTCard({ nft, onSelect, onPurchase, showPurchaseButton = true }: NFTCardProps) {
  const { address: connectedWallet } = useAccount();
  const { toast } = useToast();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageSrc, setImageSrc] = useState(LOADING_PLACEHOLDER);
  
  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(0);
  };
  
  // Simple & reliable: IPFS first, Object Storage as fallback
  useEffect(() => {
    // Debug: Log all NFT properties for Alohomora
    if (nft.title.includes('Alohomora')) {
      console.log(`🔍 NFT DEBUG:`, { id: nft.id, title: nft.title, imageUrl: nft.imageUrl?.substring(0, 60) });
    }
    
    // Special case: Alohomora59 NFTs (Token 37 & 38) use custom camera image
    if (nft.title === 'Alohomora59' && (nft.id === 'blockchain-37' || nft.id === 'blockchain-38')) {
      console.log(`🎯 Using custom camera image for ${nft.title} (${nft.id})`);
      console.log(`📷 Camera image path:`, alohomoraCamera);
      setImageSrc(alohomoraCamera);
      setImageLoading(false);
      return;
    }
    
    if (nft.imageUrl) {
      // Primary: Always try IPFS first (reliable!)
      loadImage(nft.imageUrl, nft.objectStorageUrl ? 
        (nft.objectStorageUrl.startsWith('/') ? `${window.location.origin}${nft.objectStorageUrl}` : nft.objectStorageUrl) 
        : undefined);
    } else if (nft.objectStorageUrl) {
      // Fallback: Object Storage only if no IPFS
      const objectStorageUrl = nft.objectStorageUrl.startsWith('/') ? `${window.location.origin}${nft.objectStorageUrl}` : nft.objectStorageUrl;
      loadImage(objectStorageUrl);
    } else {
      // No image available
      setImageSrc(ERROR_PLACEHOLDER);
      setImageLoading(false);
    }
    
  }, [nft.objectStorageUrl, nft.imageUrl, nft.title, nft.id]);

  const loadImage = (primaryUrl: string, fallbackUrl?: string) => {
    if (!primaryUrl) {
      console.log('❌ No image URL available for NFT:', nft.id);
      setImageSrc(ERROR_PLACEHOLDER);
      setImageLoading(false);
      return;
    }
    
    console.log(`🖼️ NFTCard loading ${nft.title} from:`, primaryUrl.substring(0, 80) + '...');
    
    const img = new Image();
    
    img.onload = () => {
      console.log(`✅ NFTCard loaded ${nft.title} successfully`);
      setImageSrc(primaryUrl);
      setImageLoading(false);
    };
    
    img.onerror = () => {
      console.log(`❌ NFTCard failed ${nft.title}, trying fallback...`);
      
      // If URL uses unreliable gateway, switch to Pinata
      if (primaryUrl.includes('ipfs.io/ipfs/') || primaryUrl.includes('cloudflare-ipfs.com/ipfs/')) {
        const ipfsHash = primaryUrl.split('/ipfs/')[1];
        const pinataUrl = `${RELIABLE_IPFS_GATEWAY}${ipfsHash}`;
        console.log(`🔄 Switching to reliable gateway: ${pinataUrl}`);
        loadImage(pinataUrl, fallbackUrl);
        return;
      }
      
      if (fallbackUrl && fallbackUrl !== primaryUrl) {
        loadImage(fallbackUrl);
      } else {
        setImageSrc(ERROR_PLACEHOLDER);
        setImageLoading(false);
      }
    };
    
    img.src = primaryUrl;
  };
  
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