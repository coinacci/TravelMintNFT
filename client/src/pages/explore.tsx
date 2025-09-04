import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MapView from "@/components/map-view";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, User, Clock } from "lucide-react";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";

// Simple modal placeholder for loading
const MODAL_PLACEHOLDER = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="320" viewBox="0 0 400 320"><rect width="100%" height="100%" fill="%23f8fafc"/><rect x="30" y="30" width="340" height="260" rx="12" fill="%23e2e8f0" stroke="%23cbd5e1" stroke-width="3"/><circle cx="200" cy="160" r="30" fill="%23fbbf24"/><text x="200" y="290" text-anchor="middle" fill="%23475569" font-size="14" font-family="Inter,sans-serif">📷 Loading...</text></svg>`;


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
  creator: { username: string; avatar?: string } | null;
  owner: { username: string; avatar?: string } | null;
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
    // Use only Object Storage URL from database
    if (nft.objectStorageUrl) {
      console.log('🖼️ Loading modal image from database:', nft.objectStorageUrl);
      setImageLoading(true);
      setImageSrc(MODAL_PLACEHOLDER);
      
      const img = new Image();
      
      // Set timeout for large images
      const timeoutId = setTimeout(() => {
        console.log('⏰ Database modal image timed out');
        setImageLoading(false);
      }, 10000);
      
      img.onload = () => {
        clearTimeout(timeoutId);
        console.log('✅ Database modal image loaded successfully');
        setImageSrc(nft.objectStorageUrl!);
        setImageLoading(false);
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        console.log('❌ Database modal image failed to load');
        setImageLoading(false);
      };
      img.src = nft.objectStorageUrl;
    } else {
      console.log('❌ No database image URL available for modal');
      setImageLoading(false);
    }
  }, [nft.objectStorageUrl]);

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
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { address: walletAddress, isConnected } = useAccount();

  const { data: nftDetails } = useQuery<NFT & { transactions: Transaction[] }>({
    queryKey: ["/api/nfts", selectedNFT?.id],
    enabled: !!selectedNFT?.id,
    staleTime: 10 * 1000, // 10 seconds for faster updates
    gcTime: 30 * 1000, // 30 seconds cache time
  });

  const { writeContract, isPending: isTransactionPending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className={`${isMobile ? 'pb-16' : ''}`}>
      <MapView onNFTSelect={handleNFTSelect} />

      {/* Floating Upload Button */}
      <Link href="/mint">
        <Button
          className="fixed bottom-4 right-4 bg-primary text-primary-foreground p-4 rounded-full shadow-lg hover:bg-primary/90 transition-all hover:scale-105 z-10"
          data-testid="upload-button"
          style={{ bottom: isMobile ? '5rem' : '1rem' }}
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </Button>
      </Link>

      {/* NFT Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {nftDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold" data-testid="modal-nft-title">
                  {nftDetails.title}
                </DialogTitle>
                <DialogDescription>
                  NFT details and purchase information for {nftDetails.title}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Image */}
                <div className="space-y-4">
                  <SimpleImage 
                    nft={nftDetails} 
                    className="w-full h-64 md:h-80 object-cover rounded-lg"
                    data-testid="modal-nft-image"
                  />
                  
                  {/* Price and Action */}
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Price</p>
                      <p className="text-2xl font-bold" data-testid="modal-nft-price">
                        {parseFloat(nftDetails.price).toFixed(0)} USDC
                      </p>
                    </div>
                    {nftDetails.isForSale === 1 && (
                      <Button 
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        data-testid="modal-buy-button"
                        onClick={handlePurchase}
                        disabled={purchaseMutation.isPending}
                      >
                        {purchaseMutation.isPending ? "Processing..." : "Buy Now"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-6">
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