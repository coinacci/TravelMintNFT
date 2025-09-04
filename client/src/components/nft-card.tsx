import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink, Share2 } from "lucide-react";
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
  showShareButton?: boolean;
}

// Simple loading placeholder
const LOADING_PLACEHOLDER = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="192" viewBox="0 0 320 192"><rect width="100%" height="100%" fill="%23f8fafc"/><rect x="30" y="30" width="260" height="132" rx="8" fill="%23e2e8f0" stroke="%23cbd5e1" stroke-width="2"/><circle cx="160" cy="96" r="20" fill="%23fbbf24"/><text x="160" y="170" text-anchor="middle" fill="%23475569" font-size="12" font-family="Inter,sans-serif">📷 Loading...</text></svg>`;

export default function NFTCard({ nft, onSelect, onPurchase, showPurchaseButton = true, showShareButton = false }: NFTCardProps) {
  const { address: connectedWallet } = useAccount();
  const { toast } = useToast();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageSrc, setImageSrc] = useState(LOADING_PLACEHOLDER);
  
  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(0);
  };
  
  // Load images from database (Object Storage) only, no IPFS fallback
  useEffect(() => {
    // Use only Object Storage URL from database
    if (nft.objectStorageUrl) {
      console.log('🖼️ Loading NFT image from database:', nft.objectStorageUrl);
      
      const img = new Image();
      
      // Set timeout for large images
      const timeoutId = setTimeout(() => {
        console.log('⏰ Database image timed out');
        setImageLoading(false);
      }, 10000);
      
      img.onload = () => {
        clearTimeout(timeoutId);
        console.log('✅ Database image loaded successfully');
        setImageSrc(nft.objectStorageUrl!);
        setImageLoading(false);
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        console.log('❌ Database image failed to load');
        setImageLoading(false);
      };
      img.src = nft.objectStorageUrl;
    } else {
      console.log('❌ No database image URL available');
      setImageLoading(false);
    }
  }, [nft.objectStorageUrl]);
  
  // Check if the connected wallet owns this NFT
  const isOwnNFT = connectedWallet && (
    (nft.ownerAddress && connectedWallet.toLowerCase() === nft.ownerAddress.toLowerCase()) ||
    (nft.owner?.id && connectedWallet.toLowerCase() === nft.owner.id.toLowerCase())
  );
  
  const handleShare = async () => {
    // Create page minimize effect and smooth Farcaster sharing
    
    // Create visual feedback - page slide down effect
    document.body.style.transform = 'translateY(20px)';
    document.body.style.transition = 'transform 0.3s ease-out';
    document.body.style.opacity = '0.7';
    
    // Create Farcaster share URL for automatic posting
    const shareText = nft.isForSale === 1 
      ? `I just listed my travel NFT "${nft.title}" from ${nft.location} on TravelMint! 🌍✨\n\nCheck it out on the marketplace 👇`
      : `Check out this amazing travel NFT "${nft.title}" from ${nft.location} on TravelMint! 🌍✨`;
    
    const appUrl = window.location.origin;
    const nftUrl = `${appUrl}/explore`;
    
    // Use only database image URL (Object Storage)
    const imageUrl = nft.objectStorageUrl || `${appUrl}/image.png`;
    
    // Create Warpcast compose URL
    const params = new URLSearchParams();
    params.append('text', shareText);
    params.append('embeds[]', nftUrl);
    params.append('embeds[]', imageUrl);
    
    const warpcastUrl = `https://warpcast.com/~/compose?${params.toString()}`;
    
    // Show toast immediately
    toast({
      title: "Creating Farcaster Post",
      description: "Opening compose window..."
    });
    
    // Delay opening to show effect
    setTimeout(() => {
      // Reset page effect
      document.body.style.transform = 'translateY(0)';
      document.body.style.opacity = '1';
      
      // Open Farcaster in same window (no new tab)
      window.location.href = warpcastUrl;
    }, 600);
  };

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
            
            {/* Share button for marketplace NFTs - only for own NFTs */}
            {showShareButton && nft.isForSale === 1 && isOwnNFT && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async (e) => {
                  e.stopPropagation();
                  handleShare();
                }}
                data-testid={`share-button-${nft.id}`}
              >
                <Share2 className="w-4 h-4" />
              </Button>
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