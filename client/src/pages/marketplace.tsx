import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import NFTCard from "@/components/nft-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";

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

export default function Marketplace() {
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address: walletAddress, isConnected } = useAccount();

  const { data: nfts = [], isLoading } = useQuery<NFT[]>({
    queryKey: ["/api/nfts/for-sale"],
    staleTime: 10 * 1000, // 10 seconds for faster updates
    gcTime: 30 * 1000, // 30 seconds cache time
  });

  const { writeContract, isPending: isTransactionPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ nftId, buyerId }: { nftId: string; buyerId: string }) => {
      console.log("🚀 Starting purchase for NFT:", nftId, "buyer:", buyerId);
      
      // First, prepare the purchase transaction
      const response = await apiRequest("POST", `/api/nfts/${nftId}/purchase`, { buyerId });
      const data = await response.json();
      
      console.log("✅ Purchase API response:", data);
      
      // Check if this is an ownership error
      if (data.message && data.message.includes("cannot buy your own NFT")) {
        throw new Error("You cannot buy your own NFT");
      }
      
      // Check for API errors
      if (data.message && !data.requiresOnchainPayment) {
        throw new Error(data.message || "Purchase failed");
      }
      
      if (!data.requiresOnchainPayment) {
        throw new Error("Purchase transaction could not be prepared");
      }
      
      return data;
    },
    onSuccess: async (purchaseData) => {
      try {
        // Backend returns transaction data that the frontend should execute
        const transactionData = (purchaseData as any).transactionData;
        const priceUSDC = (purchaseData as any).priceUSDC || "1.0";
        
        if (!transactionData || !transactionData.transactions) {
          throw new Error("Invalid transaction data received from backend");
        }
        
        toast({
          title: "Processing Purchase...",
          description: `Please approve ${priceUSDC} USDC payment in your wallet.`,
        });
        
        // Use the first transaction (USDC transfer) from backend response
        const usdcTransfer = transactionData.transactions.find((tx: any) => tx.type === "USDC_TRANSFER");
        
        if (!usdcTransfer) {
          throw new Error("USDC transfer transaction not found");
        }
        
        // Execute the prepared USDC transfer transaction
        writeContract({
          address: usdcTransfer.to as `0x${string}`,
          abi: [
            {
              name: "transferFrom",
              type: "function",
              inputs: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "amount", type: "uint256" }
              ],
              outputs: [{ name: "", type: "bool" }]
            }
          ],
          functionName: "transferFrom",
          // Decode the prepared transaction data
          args: [
            (purchaseData as any).buyer,
            (purchaseData as any).seller,
            parseUnits(priceUSDC, 6)
          ],
        });
        
      } catch (error: any) {
        console.error("Purchase transaction error:", error);
        toast({
          title: "Wallet Transaction Failed",
          description: error.message || "Could not open wallet for payment approval",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("Purchase mutation error:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response,
        status: error.status,
        data: error.data
      });
      
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to purchase NFT",
        variant: "destructive",
      });
    },
  });

  const handlePurchase = async (nft: NFT) => {
    if (!isConnected || !walletAddress) {
      toast({
        title: "Error",
        description: "Please connect your wallet to purchase NFTs",
        variant: "destructive",
      });
      return;
    }

    console.log("💳 Purchase attempt:", {
      nftId: nft.id,
      price: nft.price,
      buyer: walletAddress,
      seller: nft.ownerAddress
    });

    toast({
      title: "Preparing Purchase...",
      description: "Setting up onchain payment transaction",
    });
    
    purchaseMutation.mutate({ nftId: nft.id, buyerId: walletAddress });
  };

  // Handle transaction confirmation
  React.useEffect(() => {
    if (txHash && !isConfirming) {
      // Transaction confirmed, update database
      const confirmPurchase = async () => {
        try {
          await apiRequest("POST", `/api/nfts/confirm-purchase`, {
            buyerId: walletAddress,
            transactionHash: txHash
          });
          
          toast({
            title: "Purchase Successful!",
            description: "You have successfully purchased the NFT with USDC!",
          });
          
          // Immediate cache invalidation for faster updates
          queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
          queryClient.invalidateQueries({ queryKey: ["/api/nfts/for-sale"] });
          queryClient.refetchQueries({ queryKey: ["/api/nfts"] });
          
        } catch (error) {
          console.error("Failed to confirm purchase:", error);
          toast({
            title: "Purchase Confirmation Failed",
            description: "Payment succeeded but database update failed. Contact support.",
            variant: "destructive",
          });
        }
      };
      
      confirmPurchase();
    }
  }, [txHash, isConfirming, walletAddress, queryClient, toast]);


  // Filter and sort NFTs
  const filteredNFTs = nfts
    .filter(nft => {
      const price = parseFloat(nft.price);
      const minPrice = priceMin ? parseFloat(priceMin) : 0;
      const maxPrice = priceMax ? parseFloat(priceMax) : Infinity;
      
      return (
        price >= minPrice &&
        price <= maxPrice &&
        (selectedLocation === "all" || nft.location.toLowerCase().includes(selectedLocation.toLowerCase()))
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return parseFloat(a.price) - parseFloat(b.price);
        case "price-high":
          return parseFloat(b.price) - parseFloat(a.price);
        case "popular":
          return b.title.localeCompare(a.title); // Placeholder sort
        default:
          return 0; // Recent (default order)
      }
    });

  const locations = ["Europe", "Asia", "Americas", "Africa", "Oceania"];

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'pb-16' : ''}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="lg:w-1/4">
            <Card className="bg-card border border-border">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4" data-testid="filters-title">Filters</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Price Range (USDC)</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={priceMin}
                        onChange={(e) => setPriceMin(e.target.value)}
                        className="w-full"
                        data-testid="price-min-input"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={priceMax}
                        onChange={(e) => setPriceMax(e.target.value)}
                        className="w-full"
                        data-testid="price-max-input"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Location</Label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger className="w-full mt-2" data-testid="location-select">
                        <SelectValue placeholder="All Locations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {locations.map(location => (
                          <SelectItem key={location} value={location}>{location}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                </div>
              </CardContent>
            </Card>
          </div>

          {/* NFT Grid */}
          <div className="lg:w-3/4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold" data-testid="marketplace-title">Browse NFTs</h2>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48" data-testid="sort-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recently Listed</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
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
            ) : filteredNFTs.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="nft-grid">
                  {filteredNFTs.map((nft) => (
                    <NFTCard
                      key={nft.id}
                      nft={nft}
                      onPurchase={() => handlePurchase(nft)}
                      showPurchaseButton={true}
                    />
                  ))}
                </div>

                {/* Load More Button */}
                <div className="text-center mt-8">
                  <Button
                    variant="secondary"
                    className="px-6 py-3"
                    data-testid="load-more-button"
                  >
                    Load More NFTs
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground" data-testid="no-nfts-message">No NFTs found matching your criteria</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
