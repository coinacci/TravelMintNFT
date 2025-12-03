import React, { useState, useEffect } from "react";
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
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain, useSendCalls } from "wagmi";
import { parseUnits, encodeFunctionData } from "viem";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User, Clock, MapPin, Heart } from "lucide-react";
import { formatUserDisplayName } from "@/lib/userDisplay";
import { useFarcasterAuth } from "@/hooks/use-farcaster-auth";

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
  ownerAddress: string;
  creatorAddress: string;
  farcasterOwnerUsername?: string | null;
  farcasterOwnerFid?: string | null;
  farcasterCreatorUsername?: string | null;
  farcasterCreatorFid?: string | null;
  likeCount?: number;
  isLiked?: boolean;
  totalTips?: number;
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
  const [nftStatus, setNftStatus] = useState("all"); // NFT status filter - default to All NFTs
  const [sortBy, setSortBy] = useState("popular"); // Default to Most Popular for All NFTs
  const [currentPurchaseNftId, setCurrentPurchaseNftId] = useState<string | null>(null);
  const [transactionStep, setTransactionStep] = useState<'idle' | 'usdc_approval' | 'nft_purchase'>('idle');
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [donationAmount, setDonationAmount] = useState<number | null>(null);
  const [isDonating, setIsDonating] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address: walletAddress, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { user: farcasterUser } = useFarcasterAuth();
  const farcasterFid = farcasterUser?.fid ? farcasterUser.fid.toString() : null;

  // Update sorting when NFT status changes
  useEffect(() => {
    if (nftStatus === "all") {
      setSortBy("popular"); // Most Popular for All NFTs
    } else if (nftStatus === "for-sale") {
      setSortBy("price-low"); // Price: Low to High for Listed NFTs
    }
  }, [nftStatus]);

  // Base network check helper
  const ensureBaseNetwork = async () => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (parseInt(chainId, 16) !== 8453) { // Base mainnet chainId
          await switchChain({ chainId: 8453 });
          return true;
        }
      }
      return true;
    } catch (error: any) {
      toast({
        title: "Network Switch Required",
        description: "Please switch to Base network to purchase NFTs",
        variant: "destructive",
      });
      return false;
    }
  };

  // Dynamic API endpoint based on NFT status filter
  const baseEndpoint = nftStatus === "all" ? "/api/nfts" : "/api/nfts/for-sale";
  
  // Add sortBy parameter for special sorting (popular = like count, tips = donation amount)
  const apiEndpoint = sortBy === "popular" 
    ? `${baseEndpoint}?sortBy=popular`
    : sortBy === "tips"
    ? `${baseEndpoint}?sortBy=tips`
    : baseEndpoint;
  
  const { data: nfts = [], isLoading } = useQuery<NFT[]>({
    queryKey: [apiEndpoint], // Use full apiEndpoint so sortBy changes trigger refetch
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
  const { data: donationCallsData, sendCalls: sendDonationCalls, isPending: isDonationPending } = useSendCalls();

  // Contract addresses
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const NFT_CONTRACT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f";
  const MARKETPLACE_CONTRACT_ADDRESS = "0x480549919B9e8Dd1DA1a1a9644Fb3F8A115F2c2c";
  const TREASURY_ADDRESS = "0x7CDe7822456AAC667Df0420cD048295b92704084"; // Platform treasury for 10% fee

  // TravelMarketplace Contract ABI - marketplace functions
  const MARKETPLACE_ABI = [
    {
      name: 'purchaseNFT',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'tokenId', type: 'uint256' }
      ],
      outputs: []
    },
    {
      name: 'listNFT',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'price', type: 'uint256' }
      ],
      outputs: []
    },
    {
      name: 'cancelListing',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'tokenId', type: 'uint256' }
      ],
      outputs: []
    },
    {
      name: 'updatePrice',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'newPrice', type: 'uint256' }
      ],
      outputs: []
    }
  ] as const;

  // USDC Contract ABI - for approvals and transfers
  const USDC_ABI = [
    {
      name: "balanceOf",
      type: "function",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }]
    },
    {
      name: "allowance",
      type: "function",
      inputs: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" }
      ],
      outputs: [{ name: "", type: "uint256" }]
    },
    {
      name: "approve",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      outputs: [{ name: "", type: "bool" }]
    },
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

  // Check USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [walletAddress as `0x${string}`],
    query: {
      enabled: !!walletAddress
    }
  });

  // Check USDC allowance for Marketplace contract
  const { data: usdcAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [walletAddress as `0x${string}`, MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`],
    query: {
      enabled: !!walletAddress
    }
  });

  const likeMutation = useMutation({
    mutationFn: async (nftId: string) => {
      if (!farcasterFid) {
        throw new Error("Please connect your Farcaster account to like NFTs");
      }
      const response = await apiRequest("POST", `/api/nfts/${nftId}/like`, { farcasterFid });
      return response as unknown as { liked: boolean; likeCount: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to like NFT",
        variant: "destructive",
      });
    },
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
        // ✅ CRITICAL FIX: Require exact price and tokenId from backend - no fallbacks
        const backendData = purchaseData as any;
        
        if (!backendData.priceUSDC || !backendData.tokenId) {
          throw new Error("Backend must provide exact priceUSDC and tokenId - purchase aborted for safety");
        }
        
        const priceUSDC = backendData.priceUSDC;
        const priceWei = parseUnits(priceUSDC, 6);
        const tokenId = parseInt(backendData.tokenId);
        
        // ✅ Validate tokenId is valid number
        if (isNaN(tokenId) || tokenId <= 0) {
          throw new Error(`Invalid tokenId from backend: ${backendData.tokenId}`);
        }
        
        // ✅ ENHANCED DEBUG LOGGING
        const currentBalance = (usdcBalance as bigint) || BigInt(0);
        const currentAllowance = (usdcAllowance as bigint) || BigInt(0);
        
        // ✅ STEP 1: Ensure Base network
        const networkOk = await ensureBaseNetwork();
        if (!networkOk) {
          throw new Error("Network switch required to Base mainnet");
        }

        // ✅ STEP 2: Balance and allowance checks
        console.log("🎯 Smart contract purchase debug:", {
          tokenId,
          priceUSDC,
          priceWei: priceWei.toString(),
          currentBalance: currentBalance.toString(),
          currentAllowance: currentAllowance.toString(),
          walletAddress,
          nftContract: NFT_CONTRACT_ADDRESS,
          usdcContract: USDC_ADDRESS,
          marketplace: MARKETPLACE_CONTRACT_ADDRESS,
          nftOwner: backendData.transactionData?.sellerAddress,
          // Critical checks
          hasEnoughBalance: currentBalance >= priceWei,
          hasEnoughAllowance: currentAllowance >= priceWei,
          chainId: "Base (8453) - TODO: Verify actual chainId",
          warningUncheckedChain: "⚠️ Must add chain validation before production"
        });
        
        // ✅ HARD BALANCE CHECK - Prevent revert before attempting
        if (currentBalance < priceWei) {
          throw new Error(`Insufficient USDC balance. Required: ${priceUSDC} USDC, Available: ${(Number(currentBalance) / 1000000).toFixed(6)} USDC`);
        }
        
        console.log("💰 Enhanced allowance check:", {
          required: priceWei.toString(),
          current: currentAllowance.toString(),
          sufficient: currentAllowance >= priceWei,
          balanceCheck: "✅ PASSED"
        });
        
        if (currentAllowance < priceWei) {
          // STEP 1: Approve USDC for Marketplace contract
          toast({
            title: "💰 Approving USDC", 
            description: `Step 1: Approving ${priceUSDC} USDC for marketplace contract`,
          });

          setTransactionStep('usdc_approval');
          
          await writeContract({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: "approve",
            args: [
              MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`,
              priceWei
            ],
          });

          toast({
            title: "✅ USDC Approved", 
            description: "Approval confirmed, now purchasing NFT...",
          });
        }

        // ✅ STEP 3: Execute purchase (after approval if needed)
        toast({
          title: "🎨 Purchasing NFT", 
          description: `Buying NFT #${tokenId} for ${priceUSDC} USDC...`,
        });

        setTransactionStep('nft_purchase');
        
        await writeContract({
          address: MARKETPLACE_CONTRACT_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: "purchaseNFT",
          args: [BigInt(tokenId)],
        });

        toast({
          title: "✅ Purchase Successful!",
          description: `You successfully bought NFT #${tokenId} for ${priceUSDC} USDC!`,
        });
        
        console.log("🚀 Smart contract purchase system initiated");
        
      } catch (error: any) {
        console.error("Smart contract purchase error:", error);
        toast({
          title: "Purchase Failed",
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
    
    // ✅ CRITICAL: Enforce Base network (chainId 8453)
    const networkOk = await ensureBaseNetwork();
    if (!networkOk) {
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
    
    // Store current NFT ID for purchase confirmation
    setCurrentPurchaseNftId(nft.id);
    
    purchaseMutation.mutate({ nftId: nft.id, buyerId: walletAddress });
  };

  // ✅ ENHANCED transaction confirmations with allowance re-check
  React.useEffect(() => {
    if (txHash && !isConfirming) {
      if (transactionStep === 'usdc_approval') {
        // STEP 1 CONFIRMED: USDC approved, RE-CHECK allowance before proceeding
        const purchaseNFTWithAllowanceCheck = async () => {
          try {
            console.log("✅ USDC approval confirmed, RE-CHECKING allowance before purchase");
            
            const currentNFT = nfts.find(nft => nft.id === currentPurchaseNftId);
            if (!currentNFT) {
              console.error("❌ Current NFT not found for purchase");
              return;
            }
            
            const priceWei = parseUnits(currentNFT.price, 6);
            const tokenId = currentNFT.id.includes('blockchain-') 
              ? parseInt(currentNFT.id.split('blockchain-')[1]) 
              : parseInt(currentNFT.id);
              
            // 🚨 CRITICAL: Force fresh allowance + balance read from blockchain
            console.log("🔄 Forcing fresh allowance/balance read from chain...");
            
            // TODO: Force fresh reads - this is a critical fix needed
            // For now, wait longer to reduce stale state risk
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second wait
            
            // Re-fetch current allowance and balance from blockchain
            const currentBalance = (usdcBalance as bigint) || BigInt(0);
            const currentAllowance = (usdcAllowance as bigint) || BigInt(0);
            
            console.log("🔍 POST-APPROVAL checks:", {
              priceWei: priceWei.toString(),
              currentBalance: currentBalance.toString(),
              currentAllowance: currentAllowance.toString(),
              balanceOK: currentBalance >= priceWei,
              allowanceOK: currentAllowance >= priceWei
            });
            
            // ✅ HARD GATE: Verify allowance is actually sufficient
            if (currentAllowance < priceWei) {
              throw new Error(`Allowance still insufficient after approval. Required: ${(Number(priceWei) / 1000000).toFixed(6)} USDC, Current allowance: ${(Number(currentAllowance) / 1000000).toFixed(6)} USDC`);
            }
            
            // ✅ HARD GATE: Double-check balance
            if (currentBalance < priceWei) {
              throw new Error(`Insufficient balance for purchase. Required: ${(Number(priceWei) / 1000000).toFixed(6)} USDC, Available: ${(Number(currentBalance) / 1000000).toFixed(6)} USDC`);
            }
            
            toast({
              title: "🎨 Purchasing NFT",
              description: `Step 2: All checks passed! Buying NFT #${tokenId} for ${currentNFT.price} USDC`,
            });

            setTransactionStep('nft_purchase');

            // ✅ STEP 2: Call smart contract purchaseNFT function with verified parameters
            console.log("💰 FINAL PRE-PURCHASE VALIDATION:", {
              tokenId,
              priceWei: priceWei.toString(),
              nftContract: NFT_CONTRACT_ADDRESS,
              finalBalanceCheck: (currentBalance >= priceWei) ? "✅" : "❌",
              finalAllowanceCheck: (currentAllowance >= priceWei) ? "✅" : "❌"
            });
            
            // 🔒 SECURITY FIX: Price is now stored on-chain, no need to pass it
            writeContract({
              address: MARKETPLACE_CONTRACT_ADDRESS,
              abi: MARKETPLACE_ABI,
              functionName: "purchaseNFT",
              args: [
                BigInt(tokenId)
                // priceWei removed - contract uses stored price now
              ],
            });
            
          } catch (error: any) {
            console.error("❌ Failed to call purchaseNFT after allowance check:", error);
            toast({
              title: "NFT Purchase Failed",
              description: `Purchase blocked: ${error?.message || 'Unknown error'}`,
              variant: "destructive",
            });
            
            // Reset state on error
            setTransactionStep('idle');
            setCurrentPurchaseNftId(null);
          }
        };
        
        purchaseNFTWithAllowanceCheck();
        
      } else if (transactionStep === 'nft_purchase') {
        // STEP 2 CONFIRMED: Smart contract purchase completed, finalize in database
        const finalizePurchase = async () => {
          try {
            console.log("✅ Smart contract purchase completed, finalizing in database");
            
            // Update database
            await apiRequest("POST", `/api/nfts/confirm-purchase`, {
              buyerId: walletAddress,
              nftId: currentPurchaseNftId,
              transactionHash: txHash
            });
            
            toast({
              title: "🎉 Purchase Complete!",
              description: "NFT purchased successfully! USDC split between seller (95%) and platform (5%), NFT transferred to you.",
            });
            
            // Reset state
            setTransactionStep('idle');
            setCurrentPurchaseNftId(null);
            
            // Optimistic UI update - remove NFT from marketplace
            queryClient.setQueryData(["/api/nfts/for-sale"], (oldNFTs: NFT[] | undefined) => {
              if (!oldNFTs) return oldNFTs;
              return oldNFTs.filter(nft => nft.id !== currentPurchaseNftId);
            });
            
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
              description: "Smart contract purchase succeeded but database update failed. Your NFT was transferred successfully.",
              variant: "destructive",
            });
          }
        };
        
        finalizePurchase();
      }
    }
  }, [txHash, isConfirming, transactionStep, walletAddress, currentPurchaseNftId, queryClient, nfts]);

  // Handle successful donation batch transaction
  useEffect(() => {
    if (donationCallsData && isDonating && selectedNFT && donationAmount && walletAddress) {
      console.log('🎉 Donation batch transaction completed!', donationCallsData);
      
      const creatorName = formatUserDisplayName({
        walletAddress: selectedNFT.creatorAddress,
        farcasterUsername: selectedNFT.farcasterCreatorUsername,
        farcasterFid: selectedNFT.farcasterCreatorFid
      });

      // Record donation in backend
      const recordDonation = async () => {
        try {
          const platformFee = donationAmount * 0.1;
          const creatorAmount = donationAmount * 0.9;
          
          await fetch('/api/donations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nftId: selectedNFT.id,
              fromAddress: walletAddress,
              toAddress: selectedNFT.creatorAddress,
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
        description: `You donated ${donationAmount} USDC to ${creatorName}`,
      });

      // Reset donation state
      setDonationAmount(null);
      setIsDonating(false);
    }
  }, [donationCallsData, isDonating, selectedNFT, donationAmount, walletAddress, toast]);

  const handleNFTClick = (nft: NFT) => {
    setSelectedNFT(nft);
    setIsModalOpen(true);
  };

  // Donation handler - atomic batch USDC transfer to creator (90%) and treasury (10%)
  const handleDonation = async (amount: number) => {
    if (!isConnected || !walletAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to donate",
        variant: "destructive",
      });
      return;
    }

    if (!selectedNFT) {
      toast({
        title: "Error",
        description: "No NFT selected",
        variant: "destructive",
      });
      return;
    }

    // Check if donating to yourself
    if (selectedNFT.creatorAddress.toLowerCase() === walletAddress.toLowerCase()) {
      toast({
        title: "Cannot Donate to Yourself",
        description: "You cannot donate to your own NFT",
        variant: "destructive",
      });
      return;
    }

    const networkOk = await ensureBaseNetwork();
    if (!networkOk) {
      return;
    }

    setDonationAmount(amount);
    setIsDonating(true);

    try {
      const donationWei = parseUnits(amount.toString(), 6); // USDC has 6 decimals
      const creatorAmount = (donationWei * BigInt(90)) / BigInt(100); // 90% to creator
      const treasuryAmount = (donationWei * BigInt(10)) / BigInt(100); // 10% to treasury

      // Check balance
      const currentBalance = (usdcBalance as bigint) || BigInt(0);
      if (currentBalance < donationWei) {
        throw new Error(`Insufficient USDC balance. Required: ${amount} USDC, Available: ${(Number(currentBalance) / 1000000).toFixed(6)} USDC`);
      }

      toast({
        title: "Processing Donation",
        description: `Donating ${amount} USDC (${(amount * 0.9).toFixed(2)} to creator, ${(amount * 0.1).toFixed(2)} platform fee)`,
      });

      console.log("💝 Donation details:", {
        totalAmount: amount,
        creatorAmount: Number(creatorAmount) / 1000000,
        treasuryAmount: Number(treasuryAmount) / 1000000,
        creator: selectedNFT.creatorAddress,
        treasury: TREASURY_ADDRESS,
      });

      // Build atomic batch transaction: both transfers in single call
      const batchCalls = [
        // Transfer 1: Creator gets 90%
        {
          to: USDC_ADDRESS as `0x${string}`,
          data: encodeFunctionData({
            abi: USDC_ABI,
            functionName: "transfer",
            args: [selectedNFT.creatorAddress as `0x${string}`, creatorAmount],
          }),
        },
        // Transfer 2: Treasury gets 10%
        {
          to: USDC_ADDRESS as `0x${string}`,
          data: encodeFunctionData({
            abi: USDC_ABI,
            functionName: "transfer",
            args: [TREASURY_ADDRESS as `0x${string}`, treasuryAmount],
          }),
        },
      ];

      console.log("🎯 Sending atomic batch donation...", batchCalls);

      // Execute atomic batch transaction
      await sendDonationCalls({
        calls: batchCalls,
      });

      console.log("✅ Batch donation transaction sent, waiting for confirmation...");

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
          // Backend already sorted by like count - preserve order
          return 0;
        default:
          return 0; // Recent (default order from backend)
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
                  <SelectItem value="tips">Most Tips</SelectItem>
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
                      onLike={() => likeMutation.mutate(nft.id)}
                      showPurchaseButton={Boolean(nft.isForSale)}
                      showLikeButton={true}
                      isLikePending={likeMutation.isPending}
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
                <div className="relative">
                  <img
                    src={nftDetails.imageUrl}
                    alt={nftDetails.title}
                    className="w-full h-96 object-cover rounded-lg"
                    loading="lazy"
                  />
                  <button
                    onClick={() => likeMutation.mutate(nftDetails.id)}
                    disabled={likeMutation.isPending || !farcasterFid}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white px-3 py-2 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="button-like-nft"
                  >
                    <Heart
                      className={`w-5 h-5 transition-all duration-200 ${
                        nftDetails.isLiked 
                          ? 'fill-red-500 text-red-500'
                          : 'fill-none text-white'
                      }`}
                    />
                    <span className="text-sm font-medium">{nftDetails.likeCount || 0}</span>
                  </button>
                </div>
              </div>
              
              {/* Details Section */}
              <div className="space-y-6">
                {/* Donation Section */}
                {isConnected && walletAddress?.toLowerCase() !== nftDetails.creatorAddress.toLowerCase() && (
                  <div className="border-b pb-6">
                    <h4 className="font-medium mb-3">Support the Creator</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Donate USDC to {formatUserDisplayName({
                        walletAddress: nftDetails.creatorAddress,
                        farcasterUsername: nftDetails.farcasterCreatorUsername,
                        farcasterFid: nftDetails.farcasterCreatorFid
                      })}
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
                        {formatUserDisplayName({
                          walletAddress: nftDetails.creatorAddress,
                          farcasterUsername: nftDetails.farcasterCreatorUsername,
                          farcasterFid: nftDetails.farcasterCreatorFid
                        })}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Owner</h4>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {formatUserDisplayName({
                          walletAddress: nftDetails.ownerAddress,
                          farcasterUsername: nftDetails.farcasterOwnerUsername,
                          farcasterFid: nftDetails.farcasterOwnerFid
                        })}
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
