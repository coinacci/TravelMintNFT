import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useSendCalls } from "wagmi";
import { parseUnits, encodeFunctionData } from "viem";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, User, Clock, Loader2, Heart } from "lucide-react";
import { useFarcasterAuth } from "@/hooks/use-farcaster-auth";

interface NFT {
  id: string;
  tokenId?: string;
  title: string;
  description?: string;
  imageUrl: string;
  objectStorageUrl?: string;
  location: string;
  latitude?: string;
  longitude?: string;
  price: string;
  category?: string;
  isForSale: number;
  createdAt: string;
  ownerAddress: string;
  creatorAddress: string;
  farcasterOwnerUsername?: string | null;
  farcasterOwnerFid?: string | null;
  farcasterCreatorUsername?: string | null;
  farcasterCreatorFid?: string | null;
  likeCount?: number;
  isLiked?: boolean;
  creator?: { username: string; avatar?: string } | null;
  owner?: { username: string; avatar?: string } | null;
}

const MODAL_PLACEHOLDER = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="320" viewBox="0 0 400 320"><rect width="100%" height="100%" fill="%23f8fafc"/><rect x="30" y="30" width="340" height="260" rx="12" fill="%23e2e8f0" stroke="%23cbd5e1" stroke-width="3"/><circle cx="200" cy="160" r="30" fill="%23fbbf24"/><text x="200" y="290" text-anchor="middle" fill="%23475569" font-size="14" font-family="Inter,sans-serif">📷 Loading...</text></svg>`;

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

export default function NFTDetail() {
  const [, params] = useRoute("/nft/:tokenId");
  const [, setLocation] = useLocation();
  const tokenId = params?.tokenId;
  const { toast } = useToast();
  const { address: walletAddress, isConnected } = useAccount();
  const { user: farcasterUser } = useFarcasterAuth();
  
  const [donationAmount, setDonationAmount] = useState<number | null>(null);
  const [isDonating, setIsDonating] = useState(false);
  const [imageSrc, setImageSrc] = useState(MODAL_PLACEHOLDER);
  const [imageLoading, setImageLoading] = useState(true);
  const [customTipAmount, setCustomTipAmount] = useState<string>("");

  const { data: donationCallsData, sendCalls: sendDonationCalls, isPending: isDonationPending } = useSendCalls();

  const { data: nft, isLoading, error } = useQuery<NFT>({
    queryKey: ['/api/nft/token', tokenId],
    enabled: !!tokenId,
  });

  useEffect(() => {
    if (!nft) return;
    
    const url = nft.objectStorageUrl || nft.imageUrl;
    if (!url) return;
    
    const img = new Image();
    img.onload = () => {
      setImageSrc(url);
      setImageLoading(false);
    };
    img.onerror = () => {
      setImageSrc(nft.imageUrl);
      setImageLoading(false);
    };
    img.src = url;
  }, [nft]);

  const handleCustomTip = () => {
    const amount = parseFloat(customTipAmount);
    if (isNaN(amount) || amount < 1) {
      toast({
        title: "Invalid Amount",
        description: "Minimum tip amount is 1 USDC",
        variant: "destructive",
      });
      return;
    }
    handleDonation(amount);
  };

  const handleDonation = async (amount: number) => {
    if (!isConnected || !walletAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to donate",
        variant: "destructive",
      });
      return;
    }

    if (!nft) {
      toast({
        title: "Error",
        description: "NFT not found",
        variant: "destructive",
      });
      return;
    }

    if (nft.creatorAddress.toLowerCase() === walletAddress.toLowerCase()) {
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
      const donationWei = parseUnits(amount.toString(), 6);
      const creatorAmount = (donationWei * BigInt(90)) / BigInt(100);
      const treasuryAmount = (donationWei * BigInt(10)) / BigInt(100);

      toast({
        title: "Processing Donation",
        description: `Donating ${amount} USDC (${(amount * 0.9).toFixed(2)} to creator, ${(amount * 0.1).toFixed(2)} platform fee)`,
      });

      const batchCalls = [
        {
          to: USDC_ADDRESS,
          data: encodeFunctionData({
            abi: USDC_ABI,
            functionName: "transfer",
            args: [nft.creatorAddress as `0x${string}`, creatorAmount],
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

      await sendDonationCalls({
        calls: batchCalls,
      });

      toast({
        title: "Donation Sent!",
        description: `Thank you for supporting @${nft.farcasterCreatorUsername || 'creator'}!`,
      });

    } catch (error: any) {
      console.error("Donation error:", error);
      toast({
        title: "Donation Failed",
        description: error?.message || "Transaction was cancelled or failed",
        variant: "destructive",
      });
    } finally {
      setIsDonating(false);
      setDonationAmount(null);
      setCustomTipAmount("");
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(dateString));
    } catch {
      return 'Unknown date';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading NFT...</p>
        </div>
      </div>
    );
  }

  if (error || !nft) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">NFT Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The NFT you're looking for could not be found.
          </p>
          <Button onClick={() => setLocation("/explore")} data-testid="button-back-explore">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Explore
          </Button>
        </div>
      </div>
    );
  }

  const creatorName = nft.farcasterCreatorUsername || nft.creator?.username || 
    (nft.creatorAddress ? `${nft.creatorAddress.slice(0, 6)}...${nft.creatorAddress.slice(-4)}` : 'Unknown');
  const ownerName = nft.farcasterOwnerUsername || nft.owner?.username ||
    (nft.ownerAddress ? `${nft.ownerAddress.slice(0, 6)}...${nft.ownerAddress.slice(-4)}` : 'Unknown');

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/explore")}
          className="mb-4"
          data-testid="button-back-explore"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Explore
        </Button>

        <div className="bg-card rounded-2xl overflow-hidden shadow-xl border">
          <div className="relative">
            <img
              src={imageSrc}
              alt={nft.title}
              className="w-full aspect-video object-cover"
              data-testid="img-nft-detail"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2" data-testid="text-nft-title">
                {nft.title}
              </h1>
              <div className="flex items-center text-white/80">
                <MapPin className="w-4 h-4 mr-2" />
                <span data-testid="text-nft-location">{nft.location}</span>
              </div>
            </div>
            
            {nft.likeCount !== undefined && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 text-white px-3 py-2 rounded-full">
                <Heart className={`w-5 h-5 ${nft.isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                <span className="text-sm font-medium">{nft.likeCount || 0}</span>
              </div>
            )}
          </div>

          <div className="p-6 space-y-6">
            {(!walletAddress || walletAddress.toLowerCase() !== nft.creatorAddress?.toLowerCase()) && (
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-6 rounded-xl border border-primary/20">
                <h3 className="text-xl font-bold mb-2">💰 Support the Creator</h3>
                <p className="text-muted-foreground mb-4">
                  Donate USDC to @{nft.farcasterCreatorUsername || creatorName}
                </p>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[0.1, 0.5, 1].map((amount) => (
                    <Button
                      key={amount}
                      onClick={() => handleDonation(amount)}
                      disabled={isDonating || isDonationPending || !isConnected}
                      variant={donationAmount === amount ? "default" : "outline"}
                      className="w-full text-lg py-6"
                      data-testid={`donation-button-${amount}`}
                    >
                      {(isDonating || isDonationPending) && donationAmount === amount ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {amount}
                        </span>
                      ) : (
                        `${amount} USDC`
                      )}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    placeholder="Custom amount (min 1 USDC)"
                    value={customTipAmount}
                    onChange={(e) => setCustomTipAmount(e.target.value)}
                    disabled={isDonating || isDonationPending || !isConnected}
                    className="flex-1 px-4 py-3 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    data-testid="input-custom-tip"
                  />
                  <Button
                    onClick={handleCustomTip}
                    disabled={isDonating || isDonationPending || !isConnected || !customTipAmount}
                    className="px-6 py-3"
                    data-testid="button-custom-tip"
                  >
                    {(isDonating || isDonationPending) && donationAmount === parseFloat(customTipAmount) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Tip"
                    )}
                  </Button>
                </div>
                {!isConnected && (
                  <p className="text-sm text-muted-foreground mt-3 text-center">
                    Connect your wallet to donate
                  </p>
                )}
              </div>
            )}

            {nft.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground" data-testid="text-nft-description">
                  {nft.description}
                </p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Creator</h3>
                <div className="flex items-center space-x-2">
                  {nft.creator?.avatar ? (
                    <img
                      src={nft.creator.avatar}
                      alt="Creator"
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                  <span className="text-sm" data-testid="text-creator-name">
                    @{creatorName}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Owner</h3>
                <div className="flex items-center space-x-2">
                  {nft.owner?.avatar ? (
                    <img
                      src={nft.owner.avatar}
                      alt="Owner"
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                  <span className="text-sm" data-testid="text-owner-name">
                    @{ownerName}
                  </span>
                </div>
              </div>
            </div>

            {nft.isForSale === 1 && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Price</p>
                  <p className="text-2xl font-bold" data-testid="text-nft-price">
                    {parseFloat(nft.price).toFixed(0)} USDC
                  </p>
                </div>
                <Button 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => setLocation('/marketplace')}
                  data-testid="button-view-marketplace"
                >
                  View in Marketplace
                </Button>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Created</h3>
              <div className="flex items-center text-muted-foreground">
                <Clock className="w-4 h-4 mr-2" />
                <span data-testid="text-nft-created">{formatDate(nft.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
