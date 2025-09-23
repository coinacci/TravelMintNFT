import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSimulateContract, useSwitchChain } from "wagmi";
import { parseUnits } from "viem";
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
import { MapPin, User, Clock, Send, Loader2, Share2, Wallet, Users } from "lucide-react";
import { isAddress, parseAbi, formatEther } from "viem";
import { base } from "wagmi/chains";
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
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferToAddress, setTransferToAddress] = useState("");
  const [transferNFT, setTransferNFT] = useState<NFT | null>(null);
  const [showGasEstimate, setShowGasEstimate] = useState(false);
  const [isGeneratingFrame, setIsGeneratingFrame] = useState(false);
  const [showAllWallets, setShowAllWallets] = useState(true); // Default to show all wallets
  const [farcasterUser, setFarcasterUser] = useState<{
    fid: number;
    username: string;
    displayName: string;
    pfpUrl?: string;
  } | null>(null);
  const [listingNFTId, setListingNFTId] = useState<string | null>(null);
  
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { address, isConnected, connector } = useAccount();
  const { writeContract, data: transferHash, isPending: isTransferPending, error: transferError } = useWriteContract();
  const { isLoading: isTransferLoading, isSuccess: isTransferSuccess } = useWaitForTransactionReceipt({ hash: transferHash });
  
  // Removed: NFT approval hooks - not needed for smart contract with internal _transfer()
  const { switchChain } = useSwitchChain();

  // Contract Configuration
  const NFT_CONTRACT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f" as const;
  const MARKETPLACE_CONTRACT_ADDRESS = "0x480549919B9e8Dd1DA1a1a9644Fb3F8A115F2c2c" as const;
  const PLATFORM_WALLET = "0x7CDe7822456AAC667Df0420cD048295b92704084" as const;
  
  // NFT Contract ABI - for transfers and approvals only
  const TRAVEL_NFT_ABI = parseAbi([
    "function safeTransferFrom(address from, address to, uint256 tokenId)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function approve(address to, uint256 tokenId)",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function setApprovalForAll(address operator, bool approved)"
  ]);
  
  // Marketplace Contract ABI - for marketplace operations
  const MARKETPLACE_ABI = parseAbi([
    "function listNFT(uint256 tokenId, uint256 price)",
    "function cancelListing(uint256 tokenId)",
    "function updatePrice(uint256 tokenId, uint256 newPrice)"
  ]);
  
  // Gas estimation for transfer
  const { data: simulateData, isLoading: isSimulating, error: simulateError } = useSimulateContract({
    address: NFT_CONTRACT_ADDRESS,
    abi: TRAVEL_NFT_ABI,
    functionName: 'safeTransferFrom',
    args: transferNFT && transferToAddress && address && isAddress(transferToAddress) ? 
      [address, transferToAddress as `0x${string}`, BigInt(transferNFT.tokenId || '0')] : 
      undefined,
    query: {
      enabled: !!transferNFT && !!transferToAddress && !!address && isAddress(transferToAddress) && !!transferNFT.tokenId
    }
  });
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

  const updateListingMutation = useMutation({
    mutationFn: async ({ nftId, updates }: { nftId: string; updates: any }) => {
      // 🔒 SECURITY: Include wallet address for ownership verification
      const updatesWithAuth = {
        ...updates,
        walletAddress: address
      };
      return apiRequest("PATCH", `/api/nfts/${nftId}`, updatesWithAuth);
    },
    onSuccess: () => {
      toast({
        title: "NFT Updated",
        description: "Your NFT listing has been updated successfully.",
      });
      // Invalidate both single wallet and multi-wallet queries
      queryClient.invalidateQueries({ queryKey: [`/api/wallet/${address}/nfts`] });
      if (farcasterUser) {
        queryClient.invalidateQueries({ queryKey: [`/api/user/${farcasterUser.fid}/all-nfts`] });
      }
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

  // Handle transfer success
  React.useEffect(() => {
    if (isTransferSuccess && transferHash) {
      toast({
        title: "Transfer Successful",
        description: `NFT transferred successfully! Transaction: ${transferHash}`,
      });
      setIsTransferModalOpen(false);
      setTransferToAddress("");
      setTransferNFT(null);
      // Invalidate queries and trigger sync
      queryClient.invalidateQueries({ queryKey: [`/api/wallet/${address}/nfts`] });
      queryClient.invalidateQueries({ queryKey: ["/api/nfts/for-sale"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
      // Trigger blockchain sync
      if (address) {
        apiRequest("POST", `/api/sync/wallet/${address}`, {});
      }
    }
  }, [isTransferSuccess, transferHash, toast, queryClient, address]);

  // Handle transfer error
  React.useEffect(() => {
    if (transferError) {
      toast({
        title: "Transfer Failed",
        description: transferError.message || "Failed to transfer NFT",
        variant: "destructive",
      });
    }
  }, [transferError, toast]);

  // REMOVED: All approval-related useEffect hooks - not needed for smart contract with internal _transfer()

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

  // 🔒 SECURITY FIX: Use secure on-chain listing system
  const handleToggleListing = async (nft: NFT, price?: string) => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to list NFTs",
        variant: "destructive",
      });
      return;
    }

    if (!nft.tokenId) {
      toast({
        title: "Cannot List NFT",
        description: "This NFT doesn't have a blockchain token ID and cannot be listed for sale",
        variant: "destructive",
      });
      return;
    }

    const tokenId = BigInt(nft.tokenId);
    setListingNFTId(nft.id); // Set loading state

    if (nft.isForSale === 1) {
      // 🔒 SECURITY: Cancel on-chain listing
      try {
        toast({
          title: "🗑️ Canceling Listing",
          description: "Removing your NFT from marketplace...",
        });

        // Wait for transaction confirmation
        await writeContract({
          address: MARKETPLACE_CONTRACT_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: 'cancelListing',
          args: [tokenId],
        });

        toast({
          title: "✅ Transaction Confirmed",
          description: "NFT successfully removed from marketplace",
        });

        // Update database after successful on-chain transaction
        updateListingMutation.mutate({
          nftId: nft.id,
          updates: { isForSale: 0 }
        });

      } catch (error: any) {
        console.error("Cancel listing error:", error);
        
        // Check if user rejected transaction
        if (error.message?.includes('User rejected') || error.message?.includes('denied')) {
          toast({
            title: "Transaction Cancelled",
            description: "You cancelled the transaction",
            variant: "default",
          });
        } else {
          toast({
            title: "Cancel Failed",
            description: error.message || "Failed to cancel NFT listing",
            variant: "destructive",
          });
        }
      } finally {
        setListingNFTId(null);
      }
    } else {
      // 🔒 SECURITY: Create on-chain listing
      if (!price || parseFloat(price) <= 0) {
        toast({
          title: "Invalid Price",
          description: "Please enter a valid price to list your NFT",
          variant: "destructive",
        });
        return;
      }

      try {
        const priceWei = parseUnits(price, 6); // USDC has 6 decimals

        const platformFee = parseFloat(price) * 0.05; // 5% platform fee
        const sellerAmount = parseFloat(price) - platformFee;

        toast({
          title: "📝 Creating Listing",
          description: `Listing NFT #${nft.tokenId} for ${price} USDC. You'll receive ${sellerAmount.toFixed(2)} USDC after 5% platform fee.`,
        });

        // First ensure NFT is approved for marketplace
        await writeContract({
          address: NFT_CONTRACT_ADDRESS,
          abi: TRAVEL_NFT_ABI,
          functionName: 'setApprovalForAll',
          args: [MARKETPLACE_CONTRACT_ADDRESS, true],
        });

        toast({
          title: "🔐 Approval Confirmed",
          description: "Now listing your NFT on marketplace...",
        });
        
        // Then list the NFT on marketplace
        await writeContract({
          address: MARKETPLACE_CONTRACT_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: 'listNFT',
          args: [tokenId, priceWei],
        });

        toast({
          title: "✅ NFT Listed Successfully!",
          description: `Your NFT is now for sale at ${price} USDC (you'll receive ${sellerAmount.toFixed(2)} USDC)`,
        });

        // Update database after successful on-chain transaction
        updateListingMutation.mutate({
          nftId: nft.id,
          updates: { isForSale: 1, price: parseFloat(price).toFixed(2) }
        });

      } catch (error: any) {
        console.error("List NFT error:", error);
        
        // Check if user rejected transaction
        if (error.message?.includes('User rejected') || error.message?.includes('denied')) {
          toast({
            title: "Transaction Cancelled",
            description: "You cancelled the listing transaction",
            variant: "default",
          });
        } else {
          toast({
            title: "Listing Failed",
            description: error.message || "Failed to list NFT for sale",
            variant: "destructive",
          });
        }
      } finally {
        setListingNFTId(null);
      }
    }
  };

  const handleNFTClick = (nft: NFT) => {
    setSelectedNFT(nft);
    setIsModalOpen(true);
  };


  const handleTransferClick = (nft: NFT) => {
    // Check if NFT has tokenId before allowing transfer
    if (!nft.tokenId) {
      toast({
        title: "Cannot Transfer NFT",
        description: "This NFT is not ready for transfer. Please try again later.",
        variant: "destructive",
      });
      return;
    }
    setTransferNFT(nft);
    setTransferToAddress("");
    setShowGasEstimate(false);
    setIsTransferModalOpen(true);
  };

  const handleNetworkCheck = async () => {
    // Check if on Base network
    const chainId = await window.ethereum?.request({ method: 'eth_chainId' });
    if (chainId !== base.id.toString(16)) {
      try {
        await switchChain({ chainId: base.id });
      } catch (error: any) {
        toast({
          title: "Network Switch Required",
          description: "Please switch to Base network to transfer NFTs",
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleEstimateGas = async () => {
    if (!transferNFT || !transferToAddress || !address) {
      toast({
        title: "Invalid Transfer",
        description: "Please check all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate recipient address
    if (!isAddress(transferToAddress)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Ethereum address",
        variant: "destructive",
      });
      return;
    }

    // Prevent self-transfer
    if (transferToAddress.toLowerCase() === address.toLowerCase()) {
      toast({
        title: "Invalid Transfer",
        description: "Cannot transfer to your own address",
        variant: "destructive",
      });
      return;
    }

    // Check network
    const networkOk = await handleNetworkCheck();
    if (!networkOk) return;

    setShowGasEstimate(true);
  };

  const handleTransferSubmit = async () => {
    if (!transferNFT || !transferToAddress || !address || !transferNFT.tokenId) {
      return;
    }

    try {
      await writeContract({
        address: NFT_CONTRACT_ADDRESS,
        abi: TRAVEL_NFT_ABI,
        functionName: 'safeTransferFrom',
        args: [address, transferToAddress as `0x${string}`, BigInt(transferNFT.tokenId)],
      });
    } catch (error: any) {
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to initiate transfer",
        variant: "destructive",
      });
    }
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
      case "for-sale":
        return b.isForSale - a.isForSale;
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
                        <div className="flex items-center space-x-2">
                          {/* Share button temporarily hidden
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleShareNFT(nft); }}
                            disabled={isGeneratingFrame}
                            data-testid={`share-${nft.id}`}
                            className="text-muted-foreground hover:text-foreground"
                            title="Share as Frame"
                          >
                            {isGeneratingFrame ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </Button>
                          */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleTransferClick(nft); }}
                            data-testid={`transfer-${nft.id}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Send className="w-4 h-4" />
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {/* Share button temporarily hidden
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleShareNFT(nft); }}
                            disabled={isGeneratingFrame}
                            data-testid={`share-${nft.id}`}
                            className="text-muted-foreground hover:text-foreground"
                            title="Share as Frame"
                          >
                            {isGeneratingFrame ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </Button>
                          */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleTransferClick(nft); }}
                            data-testid={`transfer-${nft.id}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Price input and List button */}
                      <div className="flex items-center space-x-2">
                        <Input
                          id={`price-${nft.id}`}
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Enter price in USDC"
                          className="flex-1"
                          data-testid={`price-input-${nft.id}`}
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            const priceInput = document.getElementById(`price-${nft.id}`) as HTMLInputElement;
                            handleToggleListing(nft, priceInput?.value);
                          }}
                          disabled={
                            updateListingMutation.isPending || 
                            listingNFTId === nft.id
                          }
                          data-testid={`list-${nft.id}`}
                        >
                          {listingNFTId === nft.id ? (
                            "📝 Listing..."
                          ) : (
                            "List for Sale"
                          )}
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