import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

interface NFTCardProps {
  nft: {
    id: string;
    title: string;
    description?: string;
    imageUrl: string;
    location: string;
    price: string;
    isForSale: number;
    creator: { username: string; avatar?: string } | null;
    owner: { username: string; avatar?: string } | null;
  };
  onSelect?: () => void;
  onPurchase?: () => void;
  showPurchaseButton?: boolean;
}

export default function NFTCard({ nft, onSelect, onPurchase, showPurchaseButton = true }: NFTCardProps) {
  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(0);
  };

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
        <div className="absolute top-2 right-2 price-tag text-white px-2 py-1 rounded text-xs font-medium">
          <span data-testid={`nft-price-${nft.id}`}>{formatPrice(nft.price)} USDC</span>
        </div>
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
          
          {showPurchaseButton && nft.isForSale === 1 && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onPurchase?.();
              }}
              className="bg-primary text-primary-foreground px-3 py-1 text-xs font-medium hover:bg-primary/90 transition-colors"
              data-testid={`buy-button-${nft.id}`}
            >
              Buy Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
