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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User, Clock, MapPin } from "lucide-react";

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

interface RecentTransaction {
  id: string;
  nftId: string;
  fromAddress: string | null;
  toAddress: string;
  transactionType: string;
  amount: string;
  platformFee: string;
  blockchainTxHash: string | null;
  createdAt: string;
  nft?: {
    id: string;
    title: string;
    imageUrl: string;
    location: string;
    price: string;
  };
}

interface User {
  id: string;
  username: string;
  balance: string;
}

export default function Marketplace() {
  const [nftStatus, setNftStatus] = useState("for-sale"); // NFT status filter
  const [sortBy, setSortBy] = useState("price-low");
  const [currentPurchaseNftId, setCurrentPurchaseNftId] = useState<string | null>(null);
  const [transactionStep, setTransactionStep] = useState<'idle' | 'approval' | 'seller_payment' | 'commission_payment'>('idle');
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address: walletAddress, isConnected } = useAccount();

  // Dynamic API endpoint based on NFT status filter
  const apiEndpoint = nftStatus === "all" ? "/api/nfts" : "/api/nfts/for-sale";
  
  const { data: nfts = [], isLoading } = useQuery<NFT[]>({
    queryKey: [apiEndpoint],
    staleTime: 2 * 1000, // 2 seconds for immediate updates
    gcTime: 10 * 1000, // 10 seconds cache time
    refetchInterval: 5 * 1000, // Auto-refetch every 5 seconds
  });

  // Get detailed NFT data when one is selected
  const { data: nftDetails } = useQuery<NFT & { transactions: Transaction[] }>({
    queryKey: ["/api/nfts", selectedNFT?.id],
    enabled: !!selectedNFT?.id,
    staleTime: 10 * 1000, // 10 seconds for faster updates
    gcTime: 30 * 1000, // 30 seconds cache time
  });

  // Get recent marketplace activity 
  const { data: recentTransactions = [], isLoading: isLoadingActivity } = useQuery<RecentTransaction[]>({
    queryKey: ["/api/transactions/recent"],
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 1 minute cache
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds for real-time feel
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
        
        // Calculate commission split first
        const platformCommission = priceWei * BigInt(5) / BigInt(100); // 5%
        const sellerAmount = priceWei - platformCommission; // 95%
        
        console.log("💰 Single-contract purchase:", {
          tokenId,
          priceUSDC,
          priceWei: priceWei.toString(),
          currentBalance: usdcBalance?.toString()
        });
        
        toast({
          title: "🔐 USDC Approval", 
          description: `Step 1: Approving ${priceUSDC} USDC for smart contract`,
        });

        // Smart Contract Atomic Purchase - handles USDC + NFT transfer + commission automatically
        
        console.log("💰 Smart contract purchase:", {
          tokenId: tokenId,
          totalPrice: priceUSDC,
          sellerAmount: (Number(sellerAmount) / 1000000).toString() + " USDC",
          platformCommission: (Number(platformCommission) / 1000000).toString() + " USDC"
        });

        // STEP 1: First approve USDC spending by smart contract
        setTransactionStep('approval');
        
        console.log(`💰 Approving ${priceUSDC} USDC for smart contract spending...`);
        
        writeContract({
          address: USDC_ADDRESS,
          abi: [
            {
              name: "approve",
              type: "function",
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" }
              ],
              outputs: [{ name: "", type: "bool" }],
              stateMutability: "nonpayable"
            }
          ],
          functionName: "approve",
          args: [NFT_CONTRACT_ADDRESS, priceWei]
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

  // Handle smart contract transaction confirmation  
  React.useEffect(() => {
    if (txHash && !isConfirming) {
      if (transactionStep === 'approval') {
        // STEP 1 CONFIRMED: Approval successful, now call purchaseNFT
        const callPurchaseNFT = async () => {
          try {
            console.log("✅ USDC approval confirmed, calling purchaseNFT...");
            
            const currentNFT = nfts.find(nft => nft.id === currentPurchaseNftId);
            if (!currentNFT) return;
            
            const priceWei = parseUnits(currentNFT.price, 6);
            const tokenId = currentNFT.id.includes('blockchain-') 
              ? parseInt(currentNFT.id.split('blockchain-')[1]) 
              : parseInt(currentNFT.id);
            
            toast({
              title: "🏗️ Smart Contract Purchase",
              description: `Step 2: Purchasing NFT #${tokenId} atomically`,
            });

            setTransactionStep('commission_payment');

            // STEP 2: Call smart contract purchaseNFT (atomic)
            writeContract({
              address: NFT_CONTRACT_ADDRESS,
              abi: [
                {
                  name: "purchaseNFT",
                  type: "function",
                  inputs: [
                    { name: "tokenId", type: "uint256" },
                    { name: "price", type: "uint256" }
                  ],
                  outputs: [],
                  stateMutability: "nonpayable"
                }
              ],
              functionName: "purchaseNFT",
              args: [BigInt(tokenId), priceWei]
            });
            
          } catch (error) {
            console.error("Failed to call purchaseNFT:", error);
            toast({
              title: "Purchase Failed",
              description: "Approval succeeded but purchase failed. Contact support.",
              variant: "destructive",
            });
          }
        };
        
        callPurchaseNFT();
        
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

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } catch (error) {
      return 'Unknown time';
    }
  };

  const formatWalletAddress = (address: string) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };





  // Sort NFTs
  const filteredNFTs = nfts
    .filter(nft => {
      // Filter out NFTs with invalid coordinates (0,0)
      const lat = parseFloat(nft.latitude || '0');
      const lng = parseFloat(nft.longitude || '0');
      const hasValidCoordinates = !(lat === 0 && lng === 0);
      
      return hasValidCoordinates;
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

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'pb-16' : ''}`}>
      <div className="container mx-auto px-4">
        <Tabs defaultValue="browse-nfts" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="browse-nfts" data-testid="tab-browse-nfts">Browse NFTs</TabsTrigger>
            <TabsTrigger value="recent-activity" data-testid="tab-recent-activity">Recent Activity</TabsTrigger>
          </TabsList>
          
          <TabsContent value="browse-nfts" className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Filters Sidebar */}
              <div className="lg:w-1/4">
                <Card className="bg-card border border-border">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4" data-testid="filters-title">Filters</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">NFT Status</Label>
                        <Select value={nftStatus} onValueChange={setNftStatus}>
                          <SelectTrigger className="w-full mt-2" data-testid="nft-status-select">
                            <SelectValue placeholder="All NFTs" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="for-sale">Listed</SelectItem>
                            <SelectItem value="all">All NFTs</SelectItem>
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
                      onSelect={() => handleNFTClick(nft)}
                      showPurchaseButton={Boolean(nft.isForSale)}
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
          </TabsContent>
          
          <TabsContent value="recent-activity" className="space-y-6">
            <div className="space-y-6">
              
              {isLoadingActivity ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-muted rounded-lg animate-pulse flex-shrink-0"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-32 animate-pulse"></div>
                          <div className="h-3 bg-muted rounded w-24 animate-pulse"></div>
                          <div className="h-3 bg-muted rounded w-28 animate-pulse"></div>
                        </div>
                        <div className="text-right space-y-1 flex-shrink-0">
                          <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
                          <div className="h-3 bg-muted rounded w-16 animate-pulse"></div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : recentTransactions.length > 0 ? (
                <div className="space-y-3">
                  {recentTransactions.map((transaction) => (
                    <Card key={transaction.id} className="p-4 hover:bg-muted/50 transition-colors" data-testid={`transaction-${transaction.id}`}>
                      <div className="flex items-center gap-4">
                        {/* NFT Image */}
                        {transaction.nft?.imageUrl ? (
                          <div className="flex-shrink-0">
                            <img
                              src={transaction.nft.imageUrl}
                              alt={transaction.nft.title}
                              className="w-12 h-12 object-cover rounded-lg"
                              loading="lazy"
                              data-testid={`transaction-nft-image-${transaction.id}`}
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-muted-foreground text-lg">🖼️</span>
                          </div>
                        )}
                        
                        {/* Transaction Details */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" data-testid={`transaction-nft-title-${transaction.id}`}>
                            {transaction.nft?.title || 'Unknown NFT'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate" data-testid={`transaction-location-${transaction.id}`}>
                            📍 {transaction.nft?.location || 'Unknown location'}
                          </p>
                          <p className="text-xs text-muted-foreground" data-testid={`transaction-addresses-${transaction.id}`}>
                            {transaction.fromAddress ? `${formatWalletAddress(transaction.fromAddress)} → ` : ''}
                            {formatWalletAddress(transaction.toAddress)}
                          </p>
                        </div>
                        
                        {/* Price and Time */}
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-sm text-green-600 dark:text-green-400" data-testid={`transaction-amount-${transaction.id}`}>
                            {parseFloat(transaction.amount).toFixed(2)} USDC
                          </p>
                          <p className="text-xs text-muted-foreground" data-testid={`transaction-time-${transaction.id}`}>
                            {formatTimeAgo(transaction.createdAt)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📈</span>
                  </div>
                  <h3 className="font-semibold mb-2" data-testid="no-activity-title">No Recent Activity</h3>
                  <p className="text-muted-foreground text-sm" data-testid="no-activity-message">
                    Marketplace purchases and sales will appear here
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* NFT Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span>{nftDetails?.title || selectedNFT?.title || 'NFT Details'}</span>
            </DialogTitle>
            <DialogDescription>
              Detailed information about this NFT including location, price, and ownership
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
                
                {/* Creator & Owner Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Creator</h4>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {nftDetails.creator?.username || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Owner</h4>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {nftDetails.owner?.username || 'Unknown'}
                      </span>
                    </div>
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
                
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
