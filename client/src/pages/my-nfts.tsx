import React, { useState, useRef } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, User, Clock, Eye } from "lucide-react";

interface NFT {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  location: string;
  latitude?: string;
  longitude?: string;
  price: string;
  category: string;
  isForSale: number;
  createdAt?: string;
  creator: { id: string; username: string; avatar?: string } | null;
  owner: { id: string; username: string; avatar?: string } | null;
}

interface Transaction {
  id: string;
  transactionType: string;
  amount: string;
  createdAt: string;
  fromUserId?: string;
  toUserId: string;
}

interface User {
  id: string;
  username: string;
  balance: string;
}

export default function MyNFTs() {
  const [sortBy, setSortBy] = useState("recent");
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();

  const { data: nfts = [], isLoading, isError, error } = useQuery<NFT[]>({
    queryKey: [`/api/wallet/${address}/nfts`],
    enabled: !!address && isConnected,
    staleTime: 5_000,
    gcTime: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Get detailed NFT data when one is selected
  const { data: nftDetails } = useQuery<NFT & { transactions: Transaction[] }>({
    queryKey: ["/api/nfts", selectedNFT?.id],
    enabled: !!selectedNFT?.id,
    staleTime: 10 * 1000,
    gcTime: 30 * 1000,
  });
  
  // ⚡ SIMPLE: Background sync disabled to prevent crashes

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

  // ⚡ SIMPLE: Removed complex sync logic to prevent crashes

  // Log for troubleshooting
  if (isError) {
    console.log('NFT fetch error:', error?.message);
  }

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

  const handleNFTClick = (nft: NFT) => {
    setSelectedNFT(nft);
    setIsModalOpen(true);
  };


  const formatDate = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(dateString));
    } catch {
      return 'Unknown date';
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
            {sortedNFTs.map((nft) => (
              <div key={nft.id} className="space-y-3">
                <NFTCard
                  nft={nft}
                  showPurchaseButton={false}
                  onSelect={() => handleNFTClick(nft)}
                />
                
                <Card className="p-3 bg-muted/20">
                  {nft.isForSale === 1 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-600">Listed for {parseFloat(nft.price).toFixed(2)} USDC</span>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleNFTClick(nft); }}
                            data-testid={`open-${nft.id}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
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
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); handleNFTClick(nft); }}
                          data-testid={`open-${nft.id}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
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
              You don't have any NFTs yet
            </p>
            <Button data-testid="create-nft-button">
              <a href="/mint">Create Your First NFT</a>
            </Button>
          </div>
        )}
      </div>

      {/* NFT Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span>{nftDetails?.title || selectedNFT?.title || 'NFT Details'}</span>
            </DialogTitle>
            <DialogDescription>
              View and manage your NFT details, including listing status and ownership information
            </DialogDescription>
          </DialogHeader>
          
          {nftDetails && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Image Section */}
              <div className="space-y-4">
                <img
                  src={nftDetails.imageUrl}
                  alt={nftDetails.title}
                  className="w-full h-96 object-cover rounded-lg"
                  loading="lazy"
                />
                
              </div>
              
              {/* Details Section */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground">
                    {nftDetails.description || 'A beautiful travel memory captured on the blockchain.'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-1">Location</h4>
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{nftDetails.location}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-1">Category</h4>
                    <span className="text-sm text-muted-foreground">{nftDetails.category}</span>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-1">Price</h4>
                    <span className="text-sm font-semibold text-primary">{parseFloat(nftDetails.price).toFixed(2)} USDC</span>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-1">Status</h4>
                    <span className={`text-sm ${nftDetails.isForSale === 1 ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {nftDetails.isForSale === 1 ? 'Listed for Sale' : 'Not for Sale'}
                    </span>
                  </div>
                </div>
                
                {/* Owner Info */}
                <div>
                  <h4 className="font-medium mb-2">Owner</h4>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {nftDetails.owner?.username || 'You'}
                    </span>
                  </div>
                </div>
                
                {/* Created Date */}
                {nftDetails.createdAt && (
                  <div>
                    <h4 className="font-medium mb-1">Created</h4>
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(nftDetails.createdAt)}</span>
                    </div>
                  </div>
                )}
                
                {/* Transactions */}
                {nftDetails.transactions && nftDetails.transactions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Transaction History</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {nftDetails.transactions.map((tx, index) => (
                        <div key={tx.id || index} className="text-sm p-2 bg-muted/20 rounded">
                          <div className="flex justify-between items-center">
                            <span className="capitalize">{tx.transactionType}</span>
                            <span className="font-medium">{parseFloat(tx.amount).toFixed(2)} USDC</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(tx.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}