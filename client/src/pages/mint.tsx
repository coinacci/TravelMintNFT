import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useFeeData, useEstimateGas } from "wagmi";
import { parseEther, formatGwei } from "viem";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "@/hooks/use-location";
import { MapPin, Upload, Wallet, Eye } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { WalletConnect } from "@/components/wallet-connect";

// USDC Contract on Base mainnet
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const USDC_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'approve',
    type: 'function', 
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

// TravelNFT Contract ABI - exact match with deployed contract  
const NFT_ABI = [
  {
    name: 'mintTravelNFT',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'location', type: 'string' },
      { name: 'latitude', type: 'string' },
      { name: 'longitude', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'tokenURI', type: 'string' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

// Real TravelNFT contract deployed on Base mainnet
const NFT_CONTRACT_ADDRESS = '0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f' as const;

export default function Mint() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [enableListing, setEnableListing] = useState(false);
  const [salePrice, setSalePrice] = useState("");
  const [featuredPlacement, setFeaturedPlacement] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mintingStep, setMintingStep] = useState<'idle' | 'approving' | 'minting'>('idle');
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { location, loading: locationLoading, error: locationError, getCurrentLocation } = useLocation();
  const { address, isConnected } = useAccount();
  
  // Blockchain minting hooks
  const { data: hash, error: contractError, isPending: isContractPending, writeContract, reset: resetWriteContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });
  
  // Get current gas fee data from Base network
  const { data: feeData, isLoading: isFeeDataLoading } = useFeeData({
    chainId: 8453, // Base mainnet chain ID
  });
  
  // USDC amount: 1 USDC = 1,000,000 (6 decimals)
  const USDC_MINT_AMOUNT = BigInt(1000000);
  
  

  // Automatically get location when component mounts
  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  // Handle USDC approval confirmation
  useEffect(() => {
    if (isConfirmed && hash && mintingStep === 'approving' && !approvalHash) {
      console.log('✅ USDC approval confirmed:', hash);
      setApprovalHash(hash);
      
      toast({
        title: "USDC Approved",
        description: "Now please confirm NFT minting transaction",
      });
      
      // Move to minting step without delay
      setMintingStep('minting');
    }
  }, [isConfirmed, hash, mintingStep, approvalHash]);
  
  // Handle NFT minting step
  useEffect(() => {
    if (mintingStep === 'minting' && approvalHash && !isContractPending) {
      console.log('🎯 Starting NFT mint transaction...');
      
      // Create metadata URI
      const metadataUri = `data:application/json;base64,${btoa(JSON.stringify({
        name: title,
        description: description || "Travel NFT minted on TravelMint",
        image: imagePreview,
        attributes: [
          { trait_type: "Category", value: category },
          { trait_type: "Location", value: location!.city || "Unknown City" },
          { trait_type: "Minted Date", value: new Date().toISOString() }
        ]
      }))}`;
      
      // Mint NFT with proper error handling
      try {
        writeContract({
          address: NFT_CONTRACT_ADDRESS,
          abi: NFT_ABI,
          functionName: 'mintTravelNFT',
          args: [
            address!, // to
            location!.city || `${location!.latitude.toFixed(4)}, ${location!.longitude.toFixed(4)}`, // location
            location!.latitude.toString(), // latitude
            location!.longitude.toString(), // longitude
            category, // category
            metadataUri // tokenURI
          ],
          gas: BigInt(500000),
        });
      } catch (error) {
        console.error('Failed to start NFT mint:', error);
        setMintingStep('idle');
        setApprovalHash(null);
      }
    }
  }, [mintingStep, approvalHash, isContractPending, writeContract]);
  
  // Handle NFT minting confirmation
  useEffect(() => {
    if (isConfirmed && hash && mintingStep === 'minting' && hash !== approvalHash) {
      console.log('✅ NFT minting confirmed:', hash);
      
      const actualImageUrl = imagePreview || `https://images.unsplash.com/photo-${Date.now()}?w=600&h=400&fit=crop`;
      
      const nftData = {
        walletAddress: address!,
        title,
        description,
        imageUrl: actualImageUrl,
        location: location!.city || `${location!.latitude.toFixed(4)}, ${location!.longitude.toFixed(4)}`,
        latitude: location!.latitude.toString(),
        longitude: location!.longitude.toString(),
        category,
        price: enableListing ? salePrice : "0",
        isForSale: enableListing ? 1 : 0,
        mintPrice: "1.000000",
        royaltyPercentage: "5.00",
        transactionHash: hash,
        metadata: {
          featured: featuredPlacement,
          originalFilename: imageFile!.name,
        },
      };
      
      mintMutation.mutate(nftData);
      setMintingStep('idle');
      setApprovalHash(null);
    }
  }, [isConfirmed, hash, mintingStep, approvalHash]);
  
  // Handle contract errors
  useEffect(() => {
    if (contractError) {
      console.error('Contract error:', contractError);
      toast({
        title: "Transaction Failed",
        description: contractError.message || "Transaction rejected",
        variant: "destructive",
      });
      setMintingStep('idle'); // Reset state on error
    }
  }, [contractError]);

  const mintMutation = useMutation({
    mutationFn: async (nftData: any) => {
      return apiRequest("POST", "/api/nfts", nftData);
    },
    onSuccess: () => {
      toast({
        title: "NFT Minted Successfully!",
        description: "Your travel photo has been minted as an NFT.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/nfts"] });
      queryClient.invalidateQueries({ queryKey: [`/api/wallet/${address}/nfts`] });
      // Reset form
      setTitle("");
      setDescription("");
      setCategory("");
      setImageFile(null);
      setImagePreview(null);
      setEnableListing(false);
      setSalePrice("");
      setFeaturedPlacement(false);
    },
    onError: (error: any) => {
      toast({
        title: "Minting Failed",
        description: error.message || "Failed to mint NFT",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file (JPEG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Try to get location from EXIF (mock for demo)
    // Location is automatically obtained on page load, no need to call again
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleMint = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to mint NFTs",
        variant: "destructive",
      });
      return;
    }

    if (!title || !category || !imageFile || !location) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and ensure location is detected",
        variant: "destructive",
      });
      return;
    }

    // Now using real NFT contract on Base mainnet

    try {
      // Start blockchain transaction
      toast({
        title: "Preparing Transaction",
        description: "Please confirm the transaction in your wallet. If you see a safety warning, you can proceed - this is our official contract.",
      });
      
      // Use USDC for minting (1 USDC = $1 fixed price)
      const gasPrice = feeData?.gasPrice;
      const maxFeePerGas = feeData?.maxFeePerGas;
      const maxPriorityFeePerGas = feeData?.maxPriorityFeePerGas;
      
      setMintingStep('approving');
      
      // First step: Approve USDC spending to NFT contract
      writeContract({
        address: USDC_CONTRACT_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [NFT_CONTRACT_ADDRESS, USDC_MINT_AMOUNT], // Approve 1 USDC
        gasPrice: gasPrice,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
      });
      
    } catch (error: any) {
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to initiate transaction",
        variant: "destructive",
      });
      setMintingStep('idle');
    }
  };

  const categories = ["Landscape", "Architecture", "Street Photography", "Cultural", "Wildlife", "Adventure"];

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'pb-16' : ''}`}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4" data-testid="mint-title">Mint Your Travel NFT</h1>
          <p className="text-muted-foreground">Transform your travel memories into unique location-based NFTs</p>
          
          {!isConnected && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center justify-center space-x-3">
                <Wallet className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <span className="text-yellow-800 dark:text-yellow-200 font-medium">Connect your wallet to mint NFTs</span>
                <WalletConnect />
              </div>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <Card className="bg-card border border-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Upload Photo</h3>
              
              <div
                className={`upload-dropzone rounded-lg p-8 text-center mb-4 cursor-pointer ${
                  isDragging ? 'dragover' : ''
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => document.getElementById('file-input')?.click()}
                data-testid="upload-dropzone"
              >
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">Drop your photo here or click to browse</p>
                <p className="text-xs text-muted-foreground">Supports JPEG, PNG. Max size: 10MB</p>
                <input
                  id="file-input"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  data-testid="file-input"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="title" className="block text-sm font-medium mb-2">Title *</Label>
                  <Input
                    id="title"
                    type="text"
                    placeholder="Give your NFT a memorable title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    data-testid="title-input"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="block text-sm font-medium mb-2">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Tell the story behind this moment..."
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    data-testid="description-input"
                  />
                </div>

                <div>
                  <Label className="block text-sm font-medium mb-2">Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger data-testid="category-select">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview & Location Section */}
          <Card className="bg-card border border-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Preview & Location</h3>
              
              {/* Photo Preview */}
              <div className="bg-muted rounded-lg aspect-square mb-4 flex items-center justify-center overflow-hidden" data-testid="photo-preview">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Upload className="w-12 h-12 mx-auto mb-2" />
                    <p>Photo preview will appear here</p>
                  </div>
                )}
              </div>

              {/* Location Info */}
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="mb-2">
                    <span className="text-sm font-medium">Current Location</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span data-testid="detected-location">
                      {locationLoading ? "Getting your location..." :
                       location ? (location.city || "Unknown City") : 
                       locationError ? "Location access required - please allow location access in browser" : "Detecting location..."}
                    </span>
                  </div>
                  {location && (
                    <div className="text-xs text-muted-foreground mt-1" data-testid="coordinates">
                      City-based location for privacy
                    </div>
                  )}
                  {locationError && (
                    <div className="text-xs text-destructive mt-1">
                      Location permission needed for NFT minting
                    </div>
                  )}
                </div>

                {/* Pricing */}
                <div className="bg-primary/10 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Mint Price</span>
                    <span className="text-xl font-bold text-primary" data-testid="mint-price">
                      1 USDC
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Current Gas Price</span>
                    <span className="text-muted-foreground">
                      {isFeeDataLoading ? 'Loading...' : 
                       feeData?.gasPrice ? `${formatGwei(feeData.gasPrice)} gwei` : 'N/A'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fixed $1 price in USDC + Base Network gas fees
                  </p>
                  <div className="text-xs text-blue-600 mt-1">
                    🛡️ Contract: 0x8c12...558f (Official TravelMint)
                  </div>
                  {hash && (
                    <div className="text-xs text-primary mt-2 break-all">
                      Transaction: {hash.slice(0, 10)}...{hash.slice(-8)}
                    </div>
                  )}
                  {isConfirming && (
                    <div className="text-xs text-yellow-600 mt-1">
                      ⏳ {mintingStep === 'approving' ? 'Approving USDC...' : 
                          mintingStep === 'minting' ? 'Minting NFT...' : 
                          'Processing...'}
                    </div>
                  )}
                  {isConfirmed && mintingStep === 'idle' && (
                    <div className="text-xs text-green-600 mt-1">
                      ✅ NFT minted successfully!
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button
                    className="w-full bg-primary text-primary-foreground py-3 font-medium hover:bg-primary/90 transition-colors"
                    onClick={handleMint}
                    disabled={isContractPending || isConfirming || mintMutation.isPending || !isConnected || !title || !category || !imageFile || !location || locationLoading || mintingStep !== 'idle'}
                    data-testid="mint-button"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {isContractPending ? "Confirm in wallet..." :
                     isConfirming && mintingStep === 'approving' ? "Approving USDC..." :
                     isConfirming && mintingStep === 'minting' ? "Minting NFT..." :
                     mintMutation.isPending ? "Saving to marketplace..." :
                     !isConnected ? "Connect wallet to mint" :
                     locationLoading ? "Getting location..." :
                     !location ? "Location required" :
                     !title || !category || !imageFile ? "Fill all fields" :
                     "Mint NFT for 1 USDC"}
                  </Button>
                  
                  <Button
                    variant="secondary"
                    className="w-full py-2 font-medium hover:bg-secondary/80 transition-colors"
                    disabled={!location}
                    data-testid="preview-button"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview on Map
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Options */}
        <Card className="mt-8 bg-card border border-border">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Advanced Options</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enable-listing"
                    checked={enableListing}
                    onCheckedChange={(checked) => setEnableListing(!!checked)}
                    data-testid="enable-listing-checkbox"
                  />
                  <Label htmlFor="enable-listing" className="text-sm">Enable immediate listing for sale</Label>
                </div>
                {enableListing && (
                  <div className="ml-6 mt-2">
                    <Input
                      type="number"
                      placeholder="Sale price in USDC"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      data-testid="sale-price-input"
                    />
                  </div>
                )}
              </div>
              
              <div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="featured-placement"
                    checked={featuredPlacement}
                    onCheckedChange={(checked) => setFeaturedPlacement(!!checked)}
                    data-testid="featured-placement-checkbox"
                  />
                  <Label htmlFor="featured-placement" className="text-sm">Add to featured locations</Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Additional 0.5 USDC fee for premium placement
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
