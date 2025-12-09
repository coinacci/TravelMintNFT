import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MapView from "@/components/map-view";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, User, Clock, Upload, Heart, Shield } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useFarcasterAuth } from "@/hooks/use-farcaster-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSendCalls, useChainId, useCapabilities } from "wagmi";
import { parseUnits, encodeFunctionData } from "viem";
import sdk from "@farcaster/frame-sdk";

// Simple modal placeholder for loading
const MODAL_PLACEHOLDER = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="320" viewBox="0 0 400 320"><rect width="100%" height="100%" fill="%23f8fafc"/><rect x="30" y="30" width="340" height="260" rx="12" fill="%23e2e8f0" stroke="%23cbd5e1" stroke-width="3"/><circle cx="200" cy="160" r="30" fill="%23fbbf24"/><text x="200" y="290" text-anchor="middle" fill="%23475569" font-size="14" font-family="Inter,sans-serif">📷 Loading...</text></svg>`;


interface Stats {
  totalNFTs: number;
  totalVolume: string;
  totalHolders: number;
}

interface NFT {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  objectStorageUrl?: string;
  location: string;
  latitude: string;
  longitude: string;
  price: string;
  isForSale: number;
  createdAt: string;
  likeCount?: number;
  isLiked?: boolean;
  creator: { username: string; avatar?: string } | null;
  owner: { username: string; avatar?: string } | null;
  creatorAddress: string;
  ownerAddress: string;
  farcasterCreatorUsername?: string | null;
  farcasterCreatorFid?: string | null;
  farcasterOwnerUsername?: string | null;
  farcasterOwnerFid?: string | null;
}

interface Transaction {
  id: string;
  transactionType: string;
  amount: string;
  createdAt: string;
  fromUserId?: string;
  toUserId: string;
}

// Smart Image Component - Object Storage priority with IPFS fallback
const SimpleImage = ({ nft, className, ...props }: { nft: { imageUrl: string; objectStorageUrl?: string; title: string }; className: string; [key: string]: any }) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageSrc, setImageSrc] = useState(MODAL_PLACEHOLDER);

  useEffect(() => {
    // Expand IPFS URLs to multiple gateways for modal redundancy
    const expandIPFSUrl = (url: string): string[] => {
      if (!url) return [];
      
      let cid: string | null = null;
      
      // Handle ipfs:// protocol URLs (e.g., ipfs://QmXxx or ipfs://ipfs/QmXxx)
      if (url.startsWith('ipfs://')) {
        const path = url.slice(7);
        cid = path.startsWith('ipfs/') ? path.slice(5) : path;
        cid = cid.split('?')[0].split('/')[0];
      }
      // Handle gateway URLs with /ipfs/ path
      else if (url.includes('/ipfs/')) {
        const hash = url.split('/ipfs/')[1];
        if (hash) {
          cid = hash.split('?')[0].split('/')[0];
        }
      }
      
      // If we found a CID, create gateway fallbacks
      if (cid && cid.length > 10) {
        return [
          `https://ipfs.io/ipfs/${cid}`,
          `https://cloudflare-ipfs.com/ipfs/${cid}`,
          `https://dweb.link/ipfs/${cid}`,
          `https://4everland.io/ipfs/${cid}`
        ];
      }
      
      return [url];
    };

    // Smart image loading with robust IPFS gateway fallbacks for modal
    const tryUrls: string[] = [];
    
    // 1. Object Storage URL (preferred for speed)
    if (nft.objectStorageUrl) {
      tryUrls.push(nft.objectStorageUrl);
    }
    
    // 2. IPFS URL with multiple gateway fallbacks
    if (nft.imageUrl && !tryUrls.includes(nft.imageUrl)) {
      const ipfsUrls = expandIPFSUrl(nft.imageUrl);
      // Add all IPFS gateway options
      ipfsUrls.forEach(url => {
        if (!tryUrls.includes(url)) {
          tryUrls.push(url);
        }
      });
    }
    
    if (tryUrls.length === 0) {
      console.log('❌ No image URLs available for modal');
      setImageLoading(false);
      return;
    }
    
    console.log('🖼️ Loading modal image with URLs:', tryUrls);
    setImageLoading(true);
    setImageSrc(MODAL_PLACEHOLDER);
    
    let currentIndex = 0;
    let isCompleted = false;
    
    const tryNextUrl = () => {
      if (currentIndex >= tryUrls.length || isCompleted) {
        if (!isCompleted) {
          console.log('❌ All modal image URLs failed');
          setImageLoading(false);
        }
        return;
      }
      
      const currentUrl = tryUrls[currentIndex];
      console.log(`🔄 Trying modal URL ${currentIndex + 1}/${tryUrls.length}:`, currentUrl);
      
      const img = new Image();
      
      // Progressive timeout for modal: longer timeouts for better full-size image loading
      const isObjectStorage = currentUrl.includes('/objects/');
      const isFirstIPFS = currentIndex === 1; // First IPFS gateway (after object storage)
      const timeout = isObjectStorage ? 3000 : (isFirstIPFS ? 10000 : 15000);
      
      const timeoutId = setTimeout(() => {
        if (!isCompleted) {
          console.log(`⏰ Modal URL ${currentIndex + 1} timed out, trying next...`);
          currentIndex++;
          tryNextUrl();
        }
      }, timeout);
      
      img.onload = () => {
        if (!isCompleted) {
          clearTimeout(timeoutId);
          console.log('✅ Modal image loaded successfully from:', currentUrl);
          setImageSrc(currentUrl);
          setImageLoading(false);
          isCompleted = true;
        }
      };
      img.onerror = () => {
        if (!isCompleted) {
          clearTimeout(timeoutId);
          console.log(`❌ Modal URL ${currentIndex + 1} failed, trying next...`);
          currentIndex++;
          tryNextUrl();
        }
      };
      img.src = currentUrl;
    };
    
    tryNextUrl();
    
    // Cleanup function
    return () => {
      isCompleted = true;
    };
  }, [nft.objectStorageUrl, nft.imageUrl]);

  return (
    <div className="relative">
      {imageLoading && (
        <div className="absolute inset-0 bg-muted rounded-lg flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      )}
      <img
        src={imageSrc}
        alt={nft.title}
        className={`${className} transition-opacity duration-300 ${
          imageLoading ? 'opacity-0' : 'opacity-100'
        }`}
        loading="eager"
        {...props}
      />
    </div>
  );
};

export default function Explore() {
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [addMiniAppPrompted, setAddMiniAppPrompted] = useState(false);
  const [donationAmount, setDonationAmount] = useState<number | null>(null);
  const [isDonating, setIsDonating] = useState(false);
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { address: walletAddress, isConnected } = useAccount();
  const { user: farcasterUser } = useFarcasterAuth();
  const farcasterFid = farcasterUser?.fid ? farcasterUser.fid.toString() : null;

  // Fetch stats for welcome dialog
  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: nftDetails } = useQuery<NFT & { transactions: Transaction[] }>({
    queryKey: ["/api/nfts", selectedNFT?.id, farcasterFid],
    queryFn: async () => {
      if (!selectedNFT?.id) return null;
      const url = farcasterFid 
        ? `/api/nfts/${selectedNFT.id}?farcasterFid=${farcasterFid}`
        : `/api/nfts/${selectedNFT.id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch NFT details');
      return response.json();
    },
    enabled: !!selectedNFT?.id,
    staleTime: 10 * 1000,
    gcTime: 30 * 1000,
  });

  const { writeContract, writeContractAsync, isPending: isTransactionPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const { data: donationCallsData, sendCalls: sendDonationCalls, isPending: isDonationPending } = useSendCalls();
  
  // EIP-5792 capability detection for batch transactions
  const chainId = useChainId();
  const { data: capabilities } = useCapabilities();
  const supportsBatchCalls = React.useMemo(() => {
    if (!capabilities || !chainId) return false;
    const chainCapabilities = capabilities[chainId];
    return chainCapabilities?.atomic?.status === "supported" || 
           chainCapabilities?.atomic?.status === "ready";
  }, [capabilities, chainId]);

  // Contract addresses and ABIs
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
  const TREASURY_ADDRESS = "0x7CDe7822456AAC667Df0420cD048295b92704084" as `0x${string}`;
  
  const USDC_ABI = [
    {
      name: "transfer",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      outputs: [{ name: "", type: "bool" }]
    }
  ] as const;

  const likeMutation = useMutation({
    mutationFn: async (nftId: string) => {
      // Allow like with either Farcaster FID or wallet address
      if (!farcasterFid && !walletAddress) {
        throw new Error("Please connect your wallet or Farcaster account to like NFTs");
      }
      const payload = farcasterFid 
        ? { farcasterFid } 
        : { walletAddress };
      const response = await apiRequest("POST", `/api/nfts/${nftId}/like`, payload);
      return response as unknown as { liked: boolean; likeCount: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nfts", selectedNFT?.id, farcasterFid] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to like NFT",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async ({ nftId, buyerId }: { nftId: string; buyerId: string }) => {
      // First, prepare the purchase transaction
      const response = await apiRequest("POST", `/api/nfts/${nftId}/purchase`, { buyerId }) as any;
      
      if (!response.requiresOnchainPayment) {
        throw new Error("Expected onchain payment requirement");
      }
      
      return response;
    },
    onSuccess: async (purchaseData) => {
      try {
        toast({
          title: "Processing Purchase...",
          description: "Please approve the USDC payment in your wallet.",
        });
        
        // Execute USDC payment transaction
        writeContract({
          address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, // USDC address
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
          args: [
            (purchaseData as any).buyer,
            (purchaseData as any).seller,
            parseUnits("1.0", 6) // 1 USDC with 6 decimals
          ],
        });
        
      } catch (error: any) {
        toast({
          title: "Transaction Failed",
          description: error.message || "Failed to process USDC payment",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to purchase NFT",
        variant: "destructive",
      });
    },
  });

  // Show welcome dialog every time user visits Explore page
  useEffect(() => {
    setIsWelcomeOpen(true);
  }, []);

  // Prompt user to add Mini App (Base App)
  useEffect(() => {
    const promptAddMiniApp = async () => {
      // Check if we're in a Farcaster/Base App environment
      if (typeof window === 'undefined' || !sdk?.actions?.addMiniApp) {
        return;
      }

      // Check if user has already been prompted (this session)
      if (addMiniAppPrompted) {
        return;
      }

      // Check localStorage to avoid re-prompting on every load
      const hasSeenPrompt = localStorage.getItem('travelmint_miniapp_prompted');
      if (hasSeenPrompt === 'true') {
        return;
      }

      try {
        console.log('🎯 Prompting user to add TravelMint Mini App...');
        
        // Show the "Add Mini App" pop-up
        const response = await sdk.actions.addMiniApp();
        
        if (response.notificationDetails) {
          console.log('✅ Mini App added with notifications enabled!');
        } else {
          console.log('✅ Mini App added without notifications');
        }

        // Mark as prompted to avoid showing again
        localStorage.setItem('travelmint_miniapp_prompted', 'true');
        setAddMiniAppPrompted(true);
      } catch (error) {
        console.log('⚠️ Add Mini App prompt error (user may have skipped):', error);
        // Still mark as prompted even if user skipped
        localStorage.setItem('travelmint_miniapp_prompted', 'true');
        setAddMiniAppPrompted(true);
      }
    };

    // Delay slightly to ensure SDK is ready
    const timer = setTimeout(promptAddMiniApp, 500);
    return () => clearTimeout(timer);
  }, [addMiniAppPrompted]);

  const handleWelcomeClose = () => {
    setIsWelcomeOpen(false);
  };

  const handleMintClick = () => {
    setIsWelcomeOpen(false);
    setLocation('/mint');
  };

  const handleNFTSelect = (nft: NFT) => {
    setSelectedNFT(nft);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedNFT(null);
  };

  const handlePurchase = () => {
    if (!nftDetails) return;
    
    if (!isConnected || !walletAddress) {
      toast({
        title: "Error",
        description: "Please connect your wallet to purchase NFTs",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Preparing Purchase...",
      description: "Setting up onchain payment transaction",
    });
    
    purchaseMutation.mutate({ nftId: nftDetails.id, buyerId: walletAddress });
  };

  // Handle transaction confirmation
  React.useEffect(() => {
    if (txHash && !isConfirming && nftDetails) {
      // Transaction confirmed, update database
      const confirmPurchase = async () => {
        try {
          await apiRequest("POST", `/api/nfts/${nftDetails.id}/confirm-purchase`, {
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
          
          setIsModalOpen(false);
          setSelectedNFT(null);
          
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
  }, [txHash, isConfirming, walletAddress, queryClient, toast, nftDetails, setIsModalOpen, setSelectedNFT]);

  // Donation handler - atomic batch USDC transfer to creator (90%) and treasury (10%)
  // Falls back to sequential transfers for wallets that don't support EIP-5792
  const handleDonation = async (amount: number) => {
    if (!isConnected || !walletAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to donate",
        variant: "destructive",
      });
      return;
    }

    if (!nftDetails) {
      toast({
        title: "Error",
        description: "No NFT selected",
        variant: "destructive",
      });
      return;
    }

    // Check if donating to yourself
    if (nftDetails.creatorAddress.toLowerCase() === walletAddress.toLowerCase()) {
      toast({
        title: "Cannot Donate to Yourself",
        description: "You cannot donate to your own NFT",
        variant: "destructive",
      });
      return;
    }

    setDonationAmount(amount);
    setIsDonating(true);

    try {
      const donationWei = parseUnits(amount.toString(), 6); // USDC has 6 decimals
      const creatorAmount = (donationWei * BigInt(90)) / BigInt(100); // 90% to creator
      const treasuryAmount = (donationWei * BigInt(10)) / BigInt(100); // 10% to treasury

      toast({
        title: "Processing Donation",
        description: `Donating ${amount} USDC (${(amount * 0.9).toFixed(2)} to creator, ${(amount * 0.1).toFixed(2)} platform fee)`,
      });

      console.log("💝 Donation details:", {
        totalAmount: amount,
        creatorAmount: Number(creatorAmount) / 1000000,
        treasuryAmount: Number(treasuryAmount) / 1000000,
        creator: nftDetails.creatorAddress,
        treasury: TREASURY_ADDRESS,
        supportsBatchCalls,
      });

      if (supportsBatchCalls) {
        // Use atomic batch transaction for Smart Wallets (EIP-5792)
        const batchCalls = [
          {
            to: USDC_ADDRESS,
            data: encodeFunctionData({
              abi: USDC_ABI,
              functionName: "transfer",
              args: [nftDetails.creatorAddress as `0x${string}`, creatorAmount],
            }),
          },
          {
            to: USDC_ADDRESS,
            data: encodeFunctionData({
              abi: USDC_ABI,
              functionName: "transfer",
              args: [TREASURY_ADDRESS, treasuryAmount],
            }),
          },
        ];

        console.log("🎯 Sending atomic batch donation (EIP-5792)...", batchCalls);
        await sendDonationCalls({ calls: batchCalls });
        console.log("✅ Batch donation transaction sent, waiting for confirmation...");
      } else {
        // Fallback: Sequential transfers for standard wallets (MetaMask, etc.)
        console.log("🔄 Using sequential transfers (wallet doesn't support EIP-5792)...");
        
        toast({
          title: "Step 1 of 2",
          description: "Please approve the first transfer to the creator",
        });

        // First transfer: Creator gets 90%
        const creatorTxHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "transfer",
          args: [nftDetails.creatorAddress as `0x${string}`, creatorAmount],
        });
        console.log("✅ Creator transfer sent:", creatorTxHash);

        toast({
          title: "Step 2 of 2",
          description: "Please approve the platform fee transfer",
        });

        // Second transfer: Treasury gets 10%
        const treasuryTxHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "transfer",
          args: [TREASURY_ADDRESS, treasuryAmount],
        });
        console.log("✅ Treasury transfer sent:", treasuryTxHash);

        // Record donation for sequential path
        const creatorName = nftDetails.creator?.username || 
                           nftDetails.farcasterCreatorUsername || 
                           `${nftDetails.creatorAddress.slice(0, 6)}...${nftDetails.creatorAddress.slice(-4)}`;

        try {
          await fetch('/api/donations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nftId: nftDetails.id,
              fromAddress: walletAddress,
              toAddress: nftDetails.creatorAddress,
              amount: (amount * 0.9).toString(),
              platformFee: (amount * 0.1).toString(),
              blockchainTxHash: creatorTxHash,
            }),
          });
          console.log('💝 Donation recorded in database');
        } catch (dbError) {
          console.error('Failed to record donation:', dbError);
        }

        toast({
          title: "Donation Sent!",
          description: `Thank you for supporting ${creatorName}!`,
        });

        setIsDonating(false);
        setDonationAmount(null);
      }

    } catch (error: any) {
      console.error("Donation error:", error);
      toast({
        title: "Donation Failed",
        description: error.message || "Could not process donation",
        variant: "destructive",
      });
      setDonationAmount(null);
      setIsDonating(false);
    }
  };

  // Handle successful donation batch transaction
  React.useEffect(() => {
    if (donationCallsData && isDonating && nftDetails && donationAmount && walletAddress) {
      console.log('🎉 Donation batch transaction completed!', donationCallsData);
      
      const creatorName = nftDetails.creator?.username || 
                         nftDetails.farcasterCreatorUsername || 
                         `${nftDetails.creatorAddress.slice(0, 6)}...${nftDetails.creatorAddress.slice(-4)}`;

      // Record donation in backend
      const recordDonation = async () => {
        try {
          const platformFee = donationAmount * 0.1;
          const creatorAmount = donationAmount * 0.9;
          
          await fetch('/api/donations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nftId: nftDetails.id,
              fromAddress: walletAddress,
              toAddress: nftDetails.creatorAddress,
              amount: creatorAmount.toString(),
              platformFee: platformFee.toString(),
              blockchainTxHash: typeof donationCallsData === 'string' ? donationCallsData : donationCallsData.id || `donation-${Date.now()}`,
            }),
          });
          console.log('💝 Donation recorded in database');
        } catch (error) {
          console.error('Failed to record donation:', error);
        }
      };
      recordDonation();

      toast({
        title: "Donation Successful!",
        description: `You donated ${donationAmount} USDC to @${creatorName}`,
      });

      // Reset donation state
      setDonationAmount(null);
      setIsDonating(false);
    }
  }, [donationCallsData, isDonating, nftDetails, donationAmount, walletAddress, toast]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="bg-white">
      <MapView onNFTSelect={handleNFTSelect} />

      {/* Welcome Dialog */}
      <Dialog open={isWelcomeOpen} onOpenChange={handleWelcomeClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl md:text-4xl font-bold text-center" style={{ color: '#0000ff' }}>
              TravelMint
            </DialogTitle>
            <DialogDescription className="text-center">
              Mint your travel photography as NFTs, pin them to locations worldwide, and trade with fellow explorers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Statistics */}
            <div className="grid grid-cols-2 gap-6 py-4">
              <div className="text-center">
                <div className="text-xl md:text-3xl font-bold text-primary mb-1" data-testid="welcome-stats-nfts">
                  {stats?.totalNFTs || 0}
                </div>
                <div className="text-xs text-muted-foreground">NFTs Minted</div>
              </div>
              
              <div className="text-center">
                <div className="text-xl md:text-3xl font-bold text-accent mb-1" data-testid="welcome-stats-holders">
                  {stats?.totalHolders || 0}
                </div>
                <div className="text-xs text-muted-foreground">Holders</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <Button 
                size="default" 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2"
                data-testid="welcome-mint-button"
                onClick={handleMintClick}
              >
                <Upload className="w-4 h-4 mr-2" />
                Mint your Memory
              </Button>
              <Button 
                variant="outline" 
                size="default" 
                className="w-full px-6 py-2"
                data-testid="welcome-explore-button"
                onClick={handleWelcomeClose}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Explore Map
              </Button>
              <Button 
                size="default" 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-2"
                data-testid="welcome-neynar-score-button"
                onClick={() => {
                  handleWelcomeClose();
                  setLocation('/my-nfts');
                }}
              >
                <Shield className="w-4 h-4 mr-2" />
                Check your Neynar Score
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* NFT Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {nftDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-foreground" data-testid="modal-nft-title">
                  {nftDetails.title}
                </DialogTitle>
                <DialogDescription>
                  NFT details and purchase information for {nftDetails.title}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Image */}
                <div className="space-y-4">
                  <div className="relative">
                    <SimpleImage 
                      nft={nftDetails} 
                      className="w-full h-64 md:h-80 object-cover rounded-lg"
                      data-testid="modal-nft-image"
                    />
                    <button
                      onClick={() => likeMutation.mutate(nftDetails.id)}
                      disabled={likeMutation.isPending || (!farcasterFid && !walletAddress)}
                      className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white px-3 py-2 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-like-nft"
                    >
                      <Heart
                        className={`w-5 h-5 transition-all duration-200 ${
                          nftDetails.isLiked 
                            ? 'fill-red-500 text-red-500' 
                            : 'fill-transparent text-white hover:scale-110'
                        }`}
                      />
                      <span className="text-sm font-medium">
                        {nftDetails.likeCount || 0}
                      </span>
                    </button>
                  </div>
                  
                  {/* Buy Button (if for sale) */}
                  {nftDetails.isForSale === 1 && (
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Price</p>
                        <p className="text-2xl font-bold" data-testid="modal-nft-price">
                          {parseFloat(nftDetails.price).toFixed(0)} USDC
                        </p>
                      </div>
                      <Button 
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        data-testid="modal-buy-button"
                        onClick={handlePurchase}
                        disabled={purchaseMutation.isPending}
                      >
                        {purchaseMutation.isPending ? "Processing..." : "Buy Now"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-6">
                  {/* Donation Section - show for all NFTs except your own */}
                  {nftDetails && (!walletAddress || walletAddress.toLowerCase() !== nftDetails.creatorAddress?.toLowerCase()) && (
                    <div className="border-b pb-6">
                      <h4 className="font-semibold mb-3">Support the Creator</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Donate USDC to @{nftDetails.creator?.username || nftDetails.farcasterCreatorUsername || 'creator'}
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {[0.1, 0.5, 1].map((amount) => (
                          <Button
                            key={amount}
                            onClick={() => handleDonation(amount)}
                            disabled={isDonating || isDonationPending}
                            variant={donationAmount === amount ? "default" : "outline"}
                            className="w-full"
                            data-testid={`donation-button-${amount}`}
                          >
                            {(isDonating || isDonationPending) && donationAmount === amount ? (
                              <span className="flex items-center gap-2">
                                <span className="animate-spin">⏳</span>
                                {amount}
                              </span>
                            ) : (
                              `${amount} USDC`
                            )}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {nftDetails.description && (
                    <div>
                      <h3 className="font-semibold mb-2">Description</h3>
                      <p className="text-muted-foreground" data-testid="modal-nft-description">
                        {nftDetails.description}
                      </p>
                    </div>
                  )}

                  {/* Location */}
                  <div>
                    <h3 className="font-semibold mb-2">Location</h3>
                    <div className="flex items-center text-muted-foreground">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span data-testid="modal-nft-location">{nftDetails.location}</span>
                    </div>
                  </div>

                  {/* Creator & Owner */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold mb-2">Creator</h3>
                      <div className="flex items-center space-x-2">
                        {nftDetails.creator?.avatar ? (
                          <img
                            src={nftDetails.creator.avatar}
                            alt="Creator"
                            className="w-8 h-8 rounded-full"
                            data-testid="modal-creator-avatar"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                        <span className="text-sm" data-testid="modal-creator-username">
                          @{nftDetails.creator?.username || 'unknown'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Owner</h3>
                      <div className="flex items-center space-x-2">
                        {nftDetails.owner?.avatar ? (
                          <img
                            src={nftDetails.owner.avatar}
                            alt="Owner"
                            className="w-8 h-8 rounded-full"
                            data-testid="modal-owner-avatar"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                        <span className="text-sm" data-testid="modal-owner-username">
                          @{nftDetails.owner?.username || 'unknown'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Created Date */}
                  <div>
                    <h3 className="font-semibold mb-2">Created</h3>
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="w-4 h-4 mr-2" />
                      <span data-testid="modal-nft-created">{formatDate(nftDetails.createdAt)}</span>
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}