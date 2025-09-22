import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import NFTCard from "@/components/nft-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { WalletConnect } from "@/components/wallet-connect";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MapPin, User, Clock, Eye, Loader2, Share2, Wallet, Users } from "lucide-react";
import { parseAbi } from "viem";
import sdk from "@farcaster/frame-sdk";

interface NFT {
  id: string;
  tokenId?: string; // Blockchain token ID
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
  sourceWallet?: string; // Source wallet address for multi-wallet
  sourcePlatform?: string; // 'farcaster', 'base_app', 'manual'
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
  const [isGeneratingFrame, setIsGeneratingFrame] = useState(false);
  const [showAllWallets, setShowAllWallets] = useState(true); // Default to show all wallets
  const [farcasterUser, setFarcasterUser] = useState<{
    fid: number;
    username: string;
    displayName: string;
    pfpUrl?: string;
  } | null>(null);
  
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address, isConnected, connector } = useAccount();
  
  
  const { switchChain } = useSwitchChain();

  // NFT Contract Configuration
  const NFT_CONTRACT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f" as const;
  const TRAVEL_NFT_ABI = parseAbi([
    "function safeTransferFrom(address from, address to, uint256 tokenId)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function approve(address to, uint256 tokenId)",
    "function getApproved(uint256 tokenId) view returns (address)"
  ]);
  
  const syncedAddressRef = useRef<string | null>(null);

  // Initialize Farcaster context
  useEffect(() => {
    const getFarcasterContext = async () => {
      try {
        if (typeof window !== 'undefined' && sdk?.context) {
          const context = await Promise.resolve(sdk.context);
          if (context?.user) {
            setFarcasterUser({
              fid: context.user.fid,
              username: context.user.username || '',
              displayName: context.user.displayName || '',
              pfpUrl: context.user.pfpUrl
            });
            console.log('✅ Farcaster user loaded in My NFTs:', context.user.username || context.user.fid);
          }
        }
      } catch (error) {
        console.log('ℹ️ No Farcaster context in My NFTs - running in standard web browser');
      }
    };
    
    getFarcasterContext();
  }, []);

  // Auto-link wallet for Farcaster users
  useEffect(() => {
    const linkWallet = async () => {
      if (farcasterUser && address && isConnected && connector) {
        try {
          // Debug log connector information
          console.log(`🔍 Connector details:`, { 
            id: connector.id, 
            name: connector.name, 
            type: connector.type 
          });
          
          // Detect wallet type based on connector
          const isFarcasterWallet = connector.id === 'farcasterMiniApp' || connector.name?.includes('Farcaster');
          const platform = isFarcasterWallet ? 'farcaster' : 'base_app';
          
          console.log(`🔗 Auto-linking wallet ${address} to Farcaster FID ${farcasterUser.fid} (${platform} wallet)`);
          
          await apiRequest('POST', `/api/user/${farcasterUser.fid}/link-wallet`, {
            walletAddress: address,
            platform: platform
          });
          
          console.log(`✅ Wallet auto-linked successfully as ${platform} wallet`);
          
          // Invalidate multi-wallet query to refresh labels immediately
          queryClient.invalidateQueries({ queryKey: [`/api/user/${farcasterUser.fid}/all-nfts`] });
          
        } catch (error) {
          console.log('ℹ️ Wallet may already be linked:', error);
        }
      }
    };
    
    linkWallet();
  }, [farcasterUser, address, isConnected, connector]);

  // Single wallet query (current behavior)
  const { data: singleWalletNFTs = [], isLoading: isSingleLoading, isError: isSingleError, error: singleError } = useQuery<NFT[]>({
    queryKey: [`/api/wallet/${address}/nfts`],
    enabled: !!address && isConnected && (!farcasterUser || !showAllWallets),
    staleTime: 2_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    gcTime: 30_000,
    refetchInterval: 5_000,
  });

  // Multi-wallet query (for Farcaster users)
  const { data: multiWalletNFTs = [], isLoading: isMultiLoading, isError: isMultiError, error: multiError } = useQuery<NFT[]>({
    queryKey: [`/api/user/${farcasterUser?.fid}/all-nfts`],
    enabled: !!farcasterUser && showAllWallets,
    staleTime: 2_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    gcTime: 30_000,
    refetchInterval: 5_000,
  });

  // Determine which NFTs to display
  const nfts = (farcasterUser && showAllWallets) ? multiWalletNFTs : singleWalletNFTs;
  const isLoading = (farcasterUser && showAllWallets) ? isMultiLoading : isSingleLoading;
  const isError = (farcasterUser && showAllWallets) ? isMultiError : isSingleError;
  const error = (farcasterUser && showAllWallets) ? multiError : singleError;

  // Get detailed NFT data when one is selected
  const { data: nftDetails } = useQuery<NFT & { transactions: Transaction[] }>({
    queryKey: ["/api/nfts", selectedNFT?.id],
    enabled: !!selectedNFT?.id,
    staleTime: 10 * 1000, // 10 seconds for faster updates
    gcTime: 30 * 1000, // 30 seconds cache time
  });

  
  // Automatic blockchain sync on wallet connection
  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/sync/wallet/${address}`, {});
    },
    onSuccess: (data: any) => {
      // Silent sync - no toast notifications
      console.log('✅ Wallet sync successful:', data?.syncedNFTs || 0, 'new NFTs');
      // Only invalidate if there were actually new NFTs synced
      if (data?.syncedNFTs > 0) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: [`/api/wallet/${address}/nfts`] });
        }, 500); // Longer delay to prevent race conditions
      }
    },
    onError: (error: any) => {
      // Silent error handling for background sync
      console.log('Background sync failed:', error.message);
    },
  });


  // Only sync once per wallet connection and reset on disconnect
  React.useEffect(() => {
    if (address && isConnected && syncedAddressRef.current !== address) {
      syncedAddressRef.current = address;
      console.log('🔄 First-time sync for wallet:', address);
      // Only sync if we don't have any NFTs cached, no aggressive invalidation
      if (nfts.length === 0) {
        syncMutation.mutate();
      }
    } else if (!isConnected) {
      // Reset synced address when wallet is disconnected
      syncedAddressRef.current = null;
      console.log('❌ Wallet disconnected, clearing sync ref');
    }
  }, [address, isConnected]); // Remove nfts.length dependency to prevent loops





  // Log for troubleshooting
  if (isError) {
    console.log('NFT fetch error:', error?.message);
  }

  // Show wallet connection if not connected
  if (!isConnected) {
    return (
      <div className={`min-h-screen bg-background ${isMobile ? 'pb-16' : ''}`}>
        <div className="container mx-auto px-4">
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


  const handleNFTClick = (nft: NFT) => {
    setSelectedNFT(nft);
    setIsModalOpen(true);
  };






  const handleShareNFT = async (nft: NFT) => {
    if (!nft.tokenId) {
      toast({
        title: "Cannot Share NFT",
        description: "This NFT is not ready for sharing. Please try again later.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingFrame(true);
    try {
      // Generate frame URL
      const baseUrl = window.location.origin;
      const frameUrl = `${baseUrl}/api/frames/nft/${nft.tokenId}`;
      
      // Create share message (without location for privacy)
      const shareMessage = `Minted on TravelMint: ${nft.title}`;
      
      // Create Warpcast compose URL with embedded frame
      const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareMessage)}&embeds[]=${encodeURIComponent(frameUrl)}`;
      
      // Redirect to Warpcast in same tab (keeps Farcaster experience)
      window.location.href = warpcastUrl;
      
      toast({
        title: "Redirecting to Warpcast! 🚀",
        description: "Your NFT frame is ready to post on Farcaster!",
      });
    } catch (error) {
      // Fallback to clipboard if something goes wrong
      const baseUrl = window.location.origin;
      const frameUrl = `${baseUrl}/api/frames/nft/${nft.tokenId}`;
      
      try {
        await navigator.clipboard.writeText(frameUrl);
        toast({
          title: "Frame URL Copied! 🖼️",
          description: "Paste this URL in your Farcaster post to share your NFT as a frame!",
        });
      } catch (clipboardError) {
        toast({
          title: "Error Sharing NFT",
          description: "Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setIsGeneratingFrame(false);
    }
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
      default:
        return 0; // Recent (default order)
    }
  });
  

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'pb-16' : ''}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold" data-testid="my-nfts-title">My NFTs</h2>
            {farcasterUser && (
              <div className="flex items-center space-x-2 bg-muted/50 px-3 py-1.5 rounded-lg">
                <div className="flex items-center space-x-2">
                  {showAllWallets ? <Users className="h-4 w-4 text-primary" /> : <Wallet className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-medium">
                    {showAllWallets ? 'All Wallets' : 'Current Wallet'}
                  </span>
                </div>
                <Switch
                  checked={showAllWallets}
                  onCheckedChange={setShowAllWallets}
                  data-testid="multi-wallet-toggle"
                />
              </div>
            )}
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48" data-testid="sort-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently Created</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Travel Memory #{nft.tokenId || 'Pending'}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleNFTClick(nft); }}
                      data-testid={`open-${nft.id}`}
                      className="text-muted-foreground hover:text-foreground"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
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

      {/* NFT Transfer Modal */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Send className="h-5 w-5" />
              <span>Transfer NFT</span>
            </DialogTitle>
            <DialogDescription>
              Transfer your NFT to another wallet address. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {transferNFT && (
            <div className="space-y-6">
              {/* NFT Preview */}
              <div className="flex items-center space-x-3 p-3 bg-muted/20 rounded-lg">
                <img
                  src={transferNFT.imageUrl}
                  alt={transferNFT.title}
                  className="w-12 h-12 object-cover rounded"
                />
                <div>
                  <h4 className="font-medium">{transferNFT.title}</h4>
                  <p className="text-sm text-muted-foreground">{transferNFT.location}</p>
                </div>
              </div>
              
              {/* Recipient Address Input */}
              <div className="space-y-2">
                <Label htmlFor="recipient-address">Recipient Address</Label>
                <Input
                  id="recipient-address"
                  type="text"
                  placeholder="0x..."
                  value={transferToAddress}
                  onChange={(e) => setTransferToAddress(e.target.value)}
                  data-testid="transfer-address-input"
                  disabled={showGasEstimate}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the wallet address you want to transfer this NFT to
                </p>
              </div>
              
              {/* Gas Estimation Display */}
              {showGasEstimate && simulateData && (
                <div className="space-y-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <h4 className="font-medium flex items-center space-x-2">
                    <span>✅ Transfer Ready</span>
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated Gas:</span>
                      <span className="font-mono">{formatEther(simulateData.request.gas || BigInt(0))} ETH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Network:</span>
                      <span className="text-green-600">Base</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Gas Estimation Error */}
              {showGasEstimate && (simulateError || isSimulating) && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  {isSimulating ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Estimating gas...</span>
                    </div>
                  ) : (
                    <p className="text-sm text-red-700 dark:text-red-300">
                      ❌ Transfer simulation failed: {simulateError?.message}
                    </p>
                  )}
                </div>
              )}
              
              {/* Warning */}
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  ⚠️ This will permanently transfer ownership of your NFT. Make sure the recipient address is correct.
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsTransferModalOpen(false);
                    setShowGasEstimate(false);
                    setTransferToAddress("");
                  }}
                  className="flex-1"
                  data-testid="transfer-cancel-button"
                >
                  Cancel
                </Button>
                
                {!showGasEstimate ? (
                  <Button
                    onClick={handleEstimateGas}
                    disabled={!transferToAddress || !isAddress(transferToAddress) || isSimulating}
                    className="flex-1"
                    data-testid="transfer-estimate-button"
                  >
                    {isSimulating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      'Estimate Gas'
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleTransferSubmit}
                    disabled={!simulateData || isTransferPending || isTransferLoading || !!simulateError}
                    className="flex-1"
                    data-testid="transfer-confirm-button"
                  >
                    {isTransferPending || isTransferLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Transferring...
                      </>
                    ) : (
                      'Confirm Transfer'
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}