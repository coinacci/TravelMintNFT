import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Share2 } from "lucide-react";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface NFTCardProps {
  nft: {
    id: string;
    title: string;
    description?: string;
    imageUrl: string;
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

// Fast IPFS gateway alternatives for performance (ordered by reliability)
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://gateway.ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/'
];

// Cache for failed IPFS hashes to avoid repeated attempts
const failedHashes = new Set<string>();

// Extract IPFS hash from URL
const getIpfsHash = (url: string): string | null => {
  const match = url.match(/\/ipfs\/(\w+)/);
  return match ? match[1] : null;
};

// Optimize image URL for faster loading
const getOptimizedImageUrl = (originalUrl: string): string[] => {
  if (!originalUrl.includes('/ipfs/')) return [originalUrl];
  
  const ipfsHash = originalUrl.split('/ipfs/')[1];
  if (!ipfsHash) return [originalUrl];
  
  // Return multiple gateway URLs for fallback
  return IPFS_GATEWAYS.map(gateway => `${gateway}${ipfsHash}`);
};

export default function NFTCard({ nft, onSelect, onPurchase, showPurchaseButton = true, showShareButton = false }: NFTCardProps) {
  const { address: connectedWallet } = useAccount();
  const { toast } = useToast();
  const [currentImageUrl, setCurrentImageUrl] = useState(nft.imageUrl);
  const [imageLoading, setImageLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  
  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(0);
  };
  
  // Preload next gateway URL if current fails
  const tryNextGateway = () => {
    const optimizedUrls = getOptimizedImageUrl(nft.imageUrl);
    if (retryCount < optimizedUrls.length - 1) {
      const nextUrl = optimizedUrls[retryCount + 1];
      console.log(`🔄 Trying alternative gateway ${retryCount + 1}:`, nextUrl);
      setCurrentImageUrl(nextUrl);
      setRetryCount(prev => prev + 1);
      setImageLoading(true);
    } else {
      console.log('❌ All gateways failed, using fallback');
      setImageLoading(false);
    }
  };
  
  // Preload image on component mount for faster display
  useEffect(() => {
    const ipfsHash = getIpfsHash(nft.imageUrl);
    
    // Skip preloading if hash is known to be failed
    if (ipfsHash && failedHashes.has(ipfsHash)) {
      console.log('🚫 Skipping known failed hash:', ipfsHash);
      const fallbackSvg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="192" viewBox="0 0 320 192"><rect width="100%" height="100%" fill="%23f8fafc"/><rect x="30" y="30" width="260" height="132" rx="8" fill="%23e2e8f0" stroke="%23cbd5e1" stroke-width="2"/><circle cx="80" cy="70" r="12" fill="%23fbbf24"/><path d="M50 130 L90 100 L130 120 L200 80 L270 110 L270 150 L50 150 Z" fill="%23a3a3a3"/><text x="160" y="170" text-anchor="middle" fill="%23475569" font-size="12" font-family="Inter,sans-serif">📷 ${nft.title}</text></svg>`;
      setCurrentImageUrl(fallbackSvg);
      setImageLoading(false);
      return;
    }
    
    const optimizedUrls = getOptimizedImageUrl(nft.imageUrl);
    const primaryUrl = optimizedUrls[0];
    
    if (primaryUrl !== nft.imageUrl) {
      setCurrentImageUrl(primaryUrl);
    }
    
    // Aggressive preloading with timeout
    const preloadImg = new Image();
    const timeout = setTimeout(() => {
      console.log('⏰ Preload timeout, trying alternatives');
      preloadImg.src = ''; // Cancel loading
    }, 8000);
    
    preloadImg.onload = () => {
      clearTimeout(timeout);
      console.log('✅ Image preloaded:', primaryUrl);
    };
    preloadImg.onerror = () => {
      clearTimeout(timeout);
      console.log('⚠️ Primary gateway failed, will try alternatives');
    };
    preloadImg.src = primaryUrl;
    
    return () => clearTimeout(timeout);
  }, [nft.imageUrl]);
  
  // Check if the connected wallet owns this NFT
  const isOwnNFT = connectedWallet && (
    (nft.ownerAddress && connectedWallet.toLowerCase() === nft.ownerAddress.toLowerCase()) ||
    (nft.owner?.id && connectedWallet.toLowerCase() === nft.owner.id.toLowerCase())
  );
  
  // Remove debug logging for production

  return (
    <Card className="nft-card bg-card rounded-lg overflow-hidden cursor-pointer" onClick={onSelect} data-testid={`nft-card-${nft.id}`}>
      <div className="relative">
        {imageLoading && (
          <div className="w-full h-48 bg-muted animate-pulse flex items-center justify-center">
            <div className="text-xs text-muted-foreground">Loading image...</div>
          </div>
        )}
        <img
          src={currentImageUrl}
          alt={nft.title}
          className={`w-full h-48 object-cover transition-all duration-500 ${
            imageLoading ? 'opacity-0 absolute' : 'opacity-100 relative'
          }`}
          data-testid={`nft-image-${nft.id}`}
          loading="eager"
          decoding="async"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            console.log('✅ Image loaded successfully via:', currentImageUrl);
            setImageLoading(false);
            e.currentTarget.style.opacity = '1';
          }}
          onError={(e) => {
            console.log('❌ Image failed from gateway:', currentImageUrl);
            if (retryCount < IPFS_GATEWAYS.length - 1) {
              tryNextGateway();
            } else {
              console.log('❌ All gateways exhausted, using high-quality fallback');
              const fallbackSvg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="192" viewBox="0 0 320 192"><rect width="100%" height="100%" fill="%23f8fafc"/><rect x="30" y="30" width="260" height="132" rx="8" fill="%23e2e8f0" stroke="%23cbd5e1" stroke-width="2"/><circle cx="80" cy="70" r="12" fill="%23fbbf24"/><path d="M50 130 L90 100 L130 120 L200 80 L270 110 L270 150 L50 150 Z" fill="%23a3a3a3"/><text x="160" y="170" text-anchor="middle" fill="%23475569" font-size="12" font-family="Inter,sans-serif">📷 ${nft.title}</text></svg>`;
              e.currentTarget.src = fallbackSvg;
              setImageLoading(false);
            }
          }}
          onLoadStart={() => {
            console.log('🔄 Loading image from:', currentImageUrl);
          }}
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
                  
                  // Pre-load IPFS image for faster sharing
                  const preloadImage = () => {
                    return new Promise((resolve, reject) => {
                      const img = new Image();
                      img.onload = () => resolve(img.src);
                      img.onerror = () => reject('Image failed to load');
                      img.src = nft.imageUrl;
                      
                      // Timeout after 3 seconds
                      setTimeout(() => reject('Image load timeout'), 3000);
                    });
                  };

                  try {
                    // Try to preload image
                    await preloadImage();
                    console.log('✅ Image preloaded for sharing:', nft.imageUrl);
                  } catch (error) {
                    console.warn('⚠️ Image preload failed, continuing with share:', error);
                  }
                  
                  // Enhanced Farcaster share with Frame metadata
                  const shareText = `🌍 Travel NFT: "${nft.title}" from ${nft.location}\n💰 ${parseFloat(nft.price).toFixed(2)} USDC\n✨ Discover more travel memories on TravelMint!`;
                  
                  // Create a better sharing frame URL
                  const shareFrameUrl = `${window.location.origin}/api/share/frame/${nft.id}`;
                  const marketplaceUrl = `${window.location.origin}/marketplace`;
                  
                  const params = new URLSearchParams();
                  params.append('text', shareText);
                  params.append('embeds[]', shareFrameUrl); // Use frame endpoint for better image handling
                  params.append('embeds[]', marketplaceUrl);
                  
                  const warpcastUrl = `https://warpcast.com/~/compose?${params.toString()}`;
                  
                  // Open Farcaster
                  window.open(warpcastUrl, '_blank');
                  
                  toast({
                    title: "🎯 Sharing NFT",
                    description: "NFT image preloaded for faster sharing!",
                  });
                }}
                className="text-muted-foreground hover:text-foreground px-2 py-1"
                data-testid={`share-button-${nft.id}`}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            )}
            
            {/* Show buy button only if not own NFT */}
            {showPurchaseButton && nft.isForSale === 1 && !isOwnNFT && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onPurchase?.();
                }}
                className="bg-primary text-primary-foreground px-3 py-1 text-xs font-medium hover:bg-primary/90 transition-colors"
                data-testid={`buy-button-${nft.id}`}
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
