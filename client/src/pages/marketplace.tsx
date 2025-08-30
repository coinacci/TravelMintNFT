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
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
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
  const [currentPurchaseNftId, setCurrentPurchaseNftId] = useState<string | null>(null);
  const [transactionStep, setTransactionStep] = useState<'idle' | 'seller_payment' | 'commission_payment'>('idle');
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address: walletAddress, isConnected } = useAccount();

  const { data: nfts = [], isLoading } = useQuery<NFT[]>({
    queryKey: ["/api/nfts/for-sale"],
    staleTime: 2 * 1000, // 2 seconds for immediate updates
    gcTime: 10 * 1000, // 10 seconds cache time
    refetchInterval: 5 * 1000, // Auto-refetch every 5 seconds
  });

  const { writeContract, isPending: isTransactionPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Contract addresses
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const NFT_CONTRACT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";

  // TravelNFT Contract ABI - includes purchaseNFT function for single-transaction purchases
  const NFT_ABI = [
    {
      name: 'purchaseNFT',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'price', type: 'uint256' }
      ],
      outputs: []
    }
  ] as const;

  // Check USDC balance (for direct transfers)
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        inputs: [
          { name: "account", type: "address" }
        ],
        outputs: [{ name: "", type: "uint256" }]
      }
    ],
    functionName: "balanceOf",
    args: [walletAddress as `0x${string}`],
    query: {
      enabled: !!walletAddress
    }
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ nftId, buyerId }: { nftId: string; buyerId: string }) => {
      console.log("🚀 Single-transaction purchase for NFT:", nftId, "buyer:", buyerId);
      
      // Get NFT data for purchase
      const response = await apiRequest("POST", `/api/nfts/${nftId}/purchase`, { buyerId });
      const data = await response.json();
      
      console.log("✅ Purchase API response:", data);
      
      // Check for ownership error
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
        const priceUSDC = (purchaseData as any).priceUSDC || "3.0";
        const priceWei = parseUnits(priceUSDC, 6);
        const nftId = (purchaseData as any).nftId;
        
        // Extract numeric tokenId from blockchain ID (e.g., "blockchain-4" -> 4)
        const tokenId = nftId.includes('blockchain-') 
          ? parseInt(nftId.split('blockchain-')[1]) 
          : parseInt(nftId);
        
        console.log("💰 Single-contract purchase:", {
          tokenId,
          priceUSDC,
          priceWei: priceWei.toString(),
          currentBalance: usdcBalance?.toString()
        });
        
        toast({
          title: "💰 Sending Payment", 
          description: "Step 1: Paying seller 1.90 USDC (95%)",
        });

        // BACK TO WORKING SYSTEM: Direct USDC transfers
        // Calculate commission split  
        const platformCommission = priceWei * BigInt(5) / BigInt(100); // 5%
        const sellerAmount = priceWei - platformCommission; // 95%
        
        console.log("💰 Payment breakdown:", {
          totalPrice: priceUSDC,
          sellerAmount: (Number(sellerAmount) / 1000000).toString() + " USDC",
          platformCommission: (Number(platformCommission) / 1000000).toString() + " USDC"
        });

        // STEP 1: Pay seller directly (95%)
        setTransactionStep('seller_payment');
        
        writeContract({
          address: USDC_ADDRESS,
          abi: [
            {
              name: "transfer",
              type: "function",
              inputs: [
                { name: "to", type: "address" },
                { name: "amount", type: "uint256" }
              ],
              outputs: [{ name: "", type: "bool" }]
            }
          ],
          functionName: "transfer",
          args: [
            (purchaseData as any).transactionData.sellerAddress as `0x${string}`,
            sellerAmount // 95% to seller
          ],
        });
        
        console.log("🚀 Reliable dual-payment system initiated");
        
        // Optimistic UI update
        const currentNFTId = (purchaseData as any).nftId;
        queryClient.setQueryData(["/api/nfts/for-sale"], (oldNFTs: NFT[] | undefined) => {
          if (!oldNFTs) return oldNFTs;
          return oldNFTs.filter(nft => nft.id !== currentNFTId);
        });
        
      } catch (error: any) {
        console.error("Contract purchase error:", error);
        toast({
          title: "Contract Purchase Failed",
          description: error.message || "Could not execute purchase transaction",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("Purchase mutation error:", error);
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
      seller: nft.owner?.id
    });

    toast({
      title: "Preparing Purchase...",
      description: "Setting up onchain payment transaction",
    });
    
    // Store current NFT ID for purchase confirmation
    setCurrentPurchaseNftId(nft.id);
    
    purchaseMutation.mutate({ nftId: nft.id, buyerId: walletAddress });
  };

  // Handle dual transaction confirmations
  React.useEffect(() => {
    if (txHash && !isConfirming) {
      if (transactionStep === 'seller_payment') {
        // STEP 1 CONFIRMED: Seller payment done, now send commission
        const sendCommission = async () => {
          try {
            console.log("✅ Seller payment confirmed, sending platform commission");
            
            const currentNFT = nfts.find(nft => nft.id === currentPurchaseNftId);
            if (!currentNFT) return;
            
            const priceWei = parseUnits(currentNFT.price, 6);
            const platformCommission = priceWei * BigInt(5) / BigInt(100); // 5%
            
            toast({
              title: "💰 Sending Commission",
              description: `Step 2: Platform commission ${(Number(platformCommission)/1000000).toFixed(2)} USDC`,
            });

            setTransactionStep('commission_payment');

            // STEP 2: Send platform commission
            writeContract({
              address: USDC_ADDRESS,
              abi: [
                {
                  name: "transfer",
                  type: "function",
                  inputs: [
                    { name: "to", type: "address" },
                    { name: "amount", type: "uint256" }
                  ],
                  outputs: [{ name: "", type: "bool" }]
                }
              ],
              functionName: "transfer",
              args: [
                "0x7CDe7822456AAC667Df0420cD048295b92704084" as `0x${string}`,
                platformCommission
              ],
            });
            
          } catch (error) {
            console.error("Failed to send commission:", error);
            toast({
              title: "Commission Transfer Failed",
              description: "Seller payment succeeded but commission failed. Contact support.",
              variant: "destructive",
            });
          }
        };
        
        sendCommission();
        
      } else if (transactionStep === 'commission_payment') {
        // STEP 2 CONFIRMED: Commission sent, finalize purchase
        const finalizePurchase = async () => {
          try {
            console.log("✅ Commission payment confirmed, finalizing purchase");
            
            // Update database
            await apiRequest("POST", `/api/nfts/confirm-purchase`, {
              buyerId: walletAddress,
              nftId: currentPurchaseNftId,
              transactionHash: txHash
            });
            
            toast({
              title: "🎉 Purchase Complete!",
              description: "NFT purchased! Seller paid, platform commission collected.",
            });
            
            // Reset state
            setTransactionStep('idle');
            setCurrentPurchaseNftId(null);
            
            // Refresh all data
            queryClient.invalidateQueries({ queryKey: ["/api/nfts/for-sale"] });
            queryClient.invalidateQueries({ queryKey: [`/api/wallet/${walletAddress}/nfts`] });
            queryClient.invalidateQueries({ queryKey: ["/api/user/balance"] });
            queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
            queryClient.refetchQueries();
            
          } catch (error) {
            console.error("Failed to finalize purchase:", error);
            toast({
              title: "Purchase Finalization Failed",
              description: "Payments succeeded but database update failed. Contact support.",
              variant: "destructive",
            });
          }
        };
        
        finalizePurchase();
      }
    }
  }, [txHash, isConfirming, transactionStep, walletAddress, currentPurchaseNftId, queryClient, nfts]);


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
