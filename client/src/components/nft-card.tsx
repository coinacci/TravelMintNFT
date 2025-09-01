import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Share2 } from "lucide-react";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";

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

export default function NFTCard({ nft, onSelect, onPurchase, showPurchaseButton = true, showShareButton = false }: NFTCardProps) {
  const { address: connectedWallet } = useAccount();
  const { toast } = useToast();
  
  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(0);
  };
  
  // Check if the connected wallet owns this NFT
  const isOwnNFT = connectedWallet && (
    (nft.ownerAddress && connectedWallet.toLowerCase() === nft.ownerAddress.toLowerCase()) ||
    (nft.owner?.id && connectedWallet.toLowerCase() === nft.owner.id.toLowerCase())
  );
  
  // Remove debug logging for production

  return (
    <Card className="nft-card bg-card rounded-lg overflow-hidden cursor-pointer" onClick={onSelect} data-testid={`nft-card-${nft.id}`}>
      <div className="relative">
        <img
          src={nft.imageUrl}
          alt={nft.title}
          className="w-full h-48 object-cover"
          data-testid={`nft-image-${nft.id}`}
          loading="lazy"
          decoding="async"
          onLoad={() => console.log('✅ Card image loaded:', nft.title, nft.imageUrl)}
          onError={(e) => {
            console.error('❌ Card image failed:', nft.imageUrl);
            const fallbackSvg = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="192"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23374151" font-size="14" font-family="Inter,sans-serif">Travel Photo</text></svg>';
            e.currentTarget.src = fallbackSvg;
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
            
            {/* Share button for marketplace NFTs */}
            {showShareButton && nft.isForSale === 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  
                  // Create Farcaster share URL with buy button
                  const shareText = `Check out this travel NFT "${nft.title}" from ${nft.location} for ${parseFloat(nft.price).toFixed(2)} USDC! 🌍 ✨`;
                  const nftUrl = `${window.location.origin}/marketplace`;
                  
                  const params = new URLSearchParams();
                  params.append('text', shareText);
                  params.append('embeds[]', nftUrl);
                  params.append('embeds[]', nft.imageUrl);
                  
                  const warpcastUrl = `https://warpcast.com/~/compose?${params.toString()}`;
                  
                  // Open Farcaster
                  window.open(warpcastUrl, '_blank');
                  
                  toast({
                    title: "Opening Farcaster",
                    description: "NFT ready to share with buy link!",
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
