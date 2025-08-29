import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import NFTCard from "@/components/nft-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { WalletConnect } from "@/components/wallet-connect";

interface NFT {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  location: string;
  price: string;
  category: string;
  isForSale: number;
  creator: { id: string; username: string; avatar?: string } | null;
  owner: { id: string; username: string; avatar?: string } | null;
}

interface User {
  id: string;
  username: string;
  balance: string;
}

export default function MyNFTs() {
  const [sortBy, setSortBy] = useState("recent");
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();

  const { data: nfts = [], isLoading, isError, error } = useQuery<NFT[]>({
    queryKey: [`/api/wallet/${address}/nfts`],
    enabled: !!address && isConnected,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  });
  
  // DEBUG: Console log for troubleshooting
  console.log('🔍 MY NFTs RAW DATA DEBUG:', {
    address, 
    isConnected, 
    enabled: !!address && isConnected,
    rawNftsData: nfts,
    nftsCount: nfts?.length || 0,
    isLoading,
    isError,
    error: error?.message,
    apiUrl: `/api/wallet/${address}/nfts`
  });

  // Show wallet connection if not connected
  if (!isConnected) {
    return (
      <div className={`min-h-screen bg-background ${isMobile ? 'pb-16' : ''}`}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">My NFTs</h2>
            <p className="text-muted-foreground mb-6">Connect your wallet to see your NFTs</p>
            <div className="max-w-md mx-auto">
              <WalletConnect />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const updateListingMutation = useMutation({
    mutationFn: async ({ nftId, updates }: { nftId: string; updates: any }) => {
      return apiRequest("PATCH", `/api/nfts/${nftId}`, updates);
    },
    onSuccess: () => {
      toast({
        title: "NFT Updated",
        description: "Your NFT listing has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/wallet/${address}/nfts`] });
      queryClient.invalidateQueries({ queryKey: ["/api/nfts/for-sale"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update NFT",
        variant: "destructive",
      });
    },
  });

  const handleToggleListing = (nft: NFT, price?: string) => {
    if (nft.isForSale === 1) {
      // Remove from sale
      updateListingMutation.mutate({
        nftId: nft.id,
        updates: { isForSale: 0 }
      });
    } else {
      // Add to sale
      if (!price || parseFloat(price) <= 0) {
        toast({
          title: "Invalid Price",
          description: "Please enter a valid price to list your NFT",
          variant: "destructive",
        });
        return;
      }
      updateListingMutation.mutate({
        nftId: nft.id,
        updates: { isForSale: 1, price: parseFloat(price).toFixed(6) }
      });
    }
  };

  // Sort NFTs
  const sortedNFTs = [...nfts].sort((a, b) => {
    switch (sortBy) {
      case "price-low":
        return parseFloat(a.price) - parseFloat(b.price);
      case "price-high":
        return parseFloat(b.price) - parseFloat(a.price);
      case "for-sale":
        return b.isForSale - a.isForSale;
      default:
        return 0; // Recent (default order)
    }
  });
  
  // DEBUG: Sorting debug
  console.log('📊 SORTED NFTs DEBUG:', {
    originalCount: nfts?.length || 0,
    sortedCount: sortedNFTs?.length || 0,
    sortBy,
    firstSorted: sortedNFTs?.[0]
  });

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'pb-16' : ''}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" data-testid="my-nfts-title">My NFTs</h2>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48" data-testid="sort-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently Created</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="for-sale">Listed First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-lg p-4 border border-border animate-pulse">
                <div className="bg-muted h-48 rounded mb-4"></div>
                <div className="bg-muted h-4 rounded mb-2"></div>
                <div className="bg-muted h-3 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : (sortedNFTs && sortedNFTs.length > 0) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="my-nfts-grid">
            <div className="text-xs text-blue-600 mb-2">DEBUG: Rendering {sortedNFTs.length} NFTs</div>
            {sortedNFTs.map((nft) => (
              <div key={nft.id} className="space-y-3">
                <NFTCard
                  nft={nft}
                  showPurchaseButton={false}
                />
                
                <Card className="p-3 bg-muted/20">
                  {nft.isForSale === 1 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-600">Listed for {parseFloat(nft.price).toFixed(2)} USDC</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleListing(nft)}
                          disabled={updateListingMutation.isPending}
                          data-testid={`unlist-${nft.id}`}
                        >
                          Remove from Sale
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          placeholder="Price in USDC"
                          className="flex-1"
                          id={`price-${nft.id}`}
                          data-testid={`price-input-${nft.id}`}
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            const priceInput = document.getElementById(`price-${nft.id}`) as HTMLInputElement;
                            handleToggleListing(nft, priceInput?.value);
                          }}
                          disabled={updateListingMutation.isPending}
                          data-testid={`list-${nft.id}`}
                        >
                          List for Sale
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4" data-testid="no-nfts-message">
              You don't have any NFTs yet (Debug: {sortedNFTs?.length || 0} NFTs, original: {nfts?.length || 0})
            </p>
            <Button data-testid="create-nft-button">
              <a href="/mint">Create Your First NFT</a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}