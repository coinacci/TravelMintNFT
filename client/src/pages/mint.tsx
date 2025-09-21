import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useFeeData, useEstimateGas, useSendCalls } from "wagmi";
import { parseEther, formatGwei, encodeFunctionData } from "viem";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "@/hooks/use-location";
import { MapPin, Upload, Wallet, Eye, CheckCircle, Share2 } from "lucide-react";
import CitySearchInput from "@/components/city-search-input";
import { useIsMobile } from "@/hooks/use-mobile";
import { WalletConnect } from "@/components/wallet-connect";
import { ipfsClient } from "@/lib/ipfs";
import { createNFTMetadata, createIPFSUrl } from "@shared/ipfs";
import ComposeCastButton from "@/components/ComposeCastButton";
import L from "leaflet";
import sdk from "@farcaster/frame-sdk";

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
  },
  {
    name: 'name',
    type: 'function', 
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'MINT_PRICE', 
    type: 'function',
    stateMutability: 'view', 
    inputs: [],
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
  const [imageIpfsUrl, setImageIpfsUrl] = useState<string | null>(null);
  const [imageObjectStorageUrl, setImageObjectStorageUrl] = useState<string | null>(null);
  const [metadataIpfsUrl, setMetadataIpfsUrl] = useState<string | null>(null);
  const [enableListing, setEnableListing] = useState(false);
  const [salePrice, setSalePrice] = useState("");
  const [featuredPlacement, setFeaturedPlacement] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mintingStep, setMintingStep] = useState<'idle' | 'uploading-image' | 'uploading-metadata' | 'approving' | 'minting'>('idle');
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  // Farcaster user context
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  // Force GPS only mode - manual location disabled
  const [useManualLocation, setUseManualLocation] = useState(false); // Force GPS only
  const [manualLocation, setManualLocation] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<{lat: number, lng: number} | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { location, loading: locationLoading, error: locationError, getCurrentLocation } = useLocation();
  const { address, isConnected, connector } = useAccount();
  
  // ⚡ REAL BLOCKCHAIN TRANSACTIONS - Enabled for production
  const { data: hash, error: contractError, isPending: isContractPending, writeContract, reset: resetWriteContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  const { data: sendCallsData, sendCalls, error: batchError, isPending: isBatchPending } = useSendCalls();
  
  // REMOVED: Blockchain debug - causing re-render loop
  
  // TEMPORARILY DISABLED - testing HMR loop
  // const { data: feeData, isLoading: isFeeDataLoading } = useFeeData({
  //   chainId: 8453,
  // });
  
  // USDC amount: 1 USDC = 1,000,000 (6 decimals)
  const USDC_MINT_AMOUNT = BigInt(1000000);

  // Get Farcaster user context
  useEffect(() => {
    const getFarcasterContext = async () => {
      try {
        if (typeof window !== 'undefined' && sdk?.context) {
          const context = await Promise.resolve(sdk.context);
          if (context?.user) {
            setFarcasterUser({
              fid: context.user.fid,
              username: context.user.username,
              displayName: context.user.displayName,
              pfpUrl: context.user.pfpUrl
            });
            console.log('✅ Farcaster user loaded:', context.user.username);
          }
        }
      } catch (error) {
        console.log('ℹ️ No Farcaster context - running in standard web browser');
      }
    };

    getFarcasterContext();
  }, []);
  
  

  // Auto-get location when page loads (only if not using manual location)
  useEffect(() => {
    if (!useManualLocation) {
      console.log('🎬 MINT PAGE LOADED - Getting location...');
      getCurrentLocation();
    }
  }, [getCurrentLocation, useManualLocation]);

  // Handle successful batch transaction (sendCalls) - MAIN SUCCESS HANDLER
  useEffect(() => {
    if (sendCallsData && mintingStep === 'approving') {
      console.log('🎉 Batch transaction completed! Saving to backend...', sendCallsData);
      
      const saveNFTToBackend = async () => {
        try {
          // Prevent duplicate saves by immediately changing state
          setMintingStep('idle');
          const nftData = {
            title,
            description: description || "Travel NFT minted on TravelMint",
            imageUrl: imageIpfsUrl || imageObjectStorageUrl, // Use IPFS URL or Object Storage as fallback
            objectStorageUrl: imageObjectStorageUrl, // Always save object storage URL if available
            location: useManualLocation ? manualLocation : (location?.city || "Unknown City"),
            latitude: useManualLocation ? (selectedCoords?.lat.toString() || "0") : (location?.latitude.toString() || "0"),
            longitude: useManualLocation ? (selectedCoords?.lng.toString() || "0") : (location?.longitude.toString() || "0"),
            category,
            price: enableListing ? (salePrice || "1") : "1",
            isForSale: enableListing ? 1 : 0,
            mintPrice: "1",
            royaltyPercentage: "5",
            contractAddress: NFT_CONTRACT_ADDRESS,
            transactionHash: sendCallsData, // Batch transaction ID
            // Farcaster user information
            farcasterCreatorUsername: farcasterUser?.username || null,
            farcasterCreatorFid: farcasterUser?.fid?.toString() || null,
            farcasterOwnerUsername: farcasterUser?.username || null,
            farcasterOwnerFid: farcasterUser?.fid?.toString() || null,
            metadata: {
              name: title,
              description: description || "Travel NFT minted on TravelMint",
              image: imageIpfsUrl,
              attributes: [
                { trait_type: "Category", value: category },
                { trait_type: "Location", value: useManualLocation ? manualLocation : (location?.city || "Unknown City") },
                { trait_type: "Latitude", value: useManualLocation ? (selectedCoords?.lat.toString() || "0") : (location?.latitude.toString() || "0") },
                { trait_type: "Longitude", value: useManualLocation ? (selectedCoords?.lng.toString() || "0") : (location?.longitude.toString() || "0") },
                { trait_type: "Minted Date", value: new Date().toISOString() },
                { trait_type: "Platform", value: "TravelMint" }
              ]
            }
          };

          const response = await fetch('/api/nfts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: address, ...nftData }),
          });

          if (response.ok) {
            console.log('✅ NFT saved to marketplace with batch transaction!');
            toast({
              title: "🎉 NFT Successfully Minted!",
              description: `"${title}" has been minted on blockchain and added to marketplace`,
              variant: "default",
            });
            
            // Refresh data and reset form - clear both client and server cache
            await fetch('/api/cache/clear', { method: 'POST' }).catch(console.warn); // Force server cache refresh
            queryClient.invalidateQueries({ queryKey: ['/api/nfts'] });
            queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
            queryClient.invalidateQueries({ queryKey: [`/api/wallet/${address}/nfts`] });
            queryClient.invalidateQueries({ queryKey: ['/api/nfts/for-sale'] });
            
            // Reset form
            setTitle('');
            setDescription('');
            setCategory('');
            setImageFile(null);
            setImagePreview(null);
            setImageIpfsUrl(null);
            setMetadataIpfsUrl(null);
            setEnableListing(false);
            setSalePrice('');
            setFeaturedPlacement(false);
          }
        } catch (error) {
          console.error('❌ Error saving to backend:', error);
          
          // Safe error handling - don't crash the app
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toast({
            title: "⚠️ Partial Success",
            description: "NFT minted successfully on blockchain! Refreshing marketplace...",
            variant: "default",
          });
          
          // Force cache refresh even if save failed
          fetch('/api/cache/clear', { method: 'POST' }).catch(() => {});
          queryClient.invalidateQueries({ queryKey: ['/api/nfts'] });
        }
      };

      saveNFTToBackend();
    }
  }, [sendCallsData, mintingStep, title, description, imageIpfsUrl, location, category, enableListing, salePrice, address, queryClient, toast, useManualLocation, manualLocation]);

  // Manual location map disabled - GPS only mode

  // Handle successful individual transaction (writeContract) - backup method
  useEffect(() => {
    if (isConfirmed && hash && mintingStep !== 'idle') {
      console.log('🎉 Individual transaction confirmed! Saving to backend...', hash);
      
      const saveNFTToBackend = async () => {
        try {
          const nftData = {
            title,
            description: description || "Travel NFT minted on TravelMint",
            imageUrl: imageIpfsUrl,
            location: useManualLocation ? manualLocation : (location?.city || "Unknown City"),
            latitude: useManualLocation ? (selectedCoords?.lat.toString() || "0") : (location?.latitude.toString() || "0"),
            longitude: useManualLocation ? (selectedCoords?.lng.toString() || "0") : (location?.longitude.toString() || "0"),
            category,
            price: enableListing ? (salePrice || "1") : "1",
            isForSale: enableListing ? 1 : 0,
            mintPrice: "1",
            royaltyPercentage: "5",
            contractAddress: NFT_CONTRACT_ADDRESS,
            transactionHash: hash,
            metadata: {
              name: title,
              description: description || "Travel NFT minted on TravelMint",
              image: imageIpfsUrl,
              attributes: [
                { trait_type: "Category", value: category },
                { trait_type: "Location", value: useManualLocation ? manualLocation : (location?.city || "Unknown City") },
                { trait_type: "Latitude", value: useManualLocation ? (selectedCoords?.lat.toString() || "0") : (location?.latitude.toString() || "0") },
                { trait_type: "Longitude", value: useManualLocation ? (selectedCoords?.lng.toString() || "0") : (location?.longitude.toString() || "0") },
                { trait_type: "Minted Date", value: new Date().toISOString() },
                { trait_type: "Platform", value: "TravelMint" }
              ]
            }
          };

          const response = await fetch('/api/nfts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: address, ...nftData }),
          });

          if (response.ok) {
            console.log('✅ NFT saved to marketplace with individual transaction!');
            toast({
              title: "🎉 NFT Successfully Minted!",
              description: `"${title}" has been minted on blockchain and added to marketplace`,
              variant: "default",
            });
            
            // Refresh data and reset form
            queryClient.invalidateQueries({ queryKey: ['/api/nfts'] });
            queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
            queryClient.invalidateQueries({ queryKey: [`/api/wallet/${address}/nfts`] });
            queryClient.invalidateQueries({ queryKey: ['/api/nfts/for-sale'] });
            
            // Reset form
            setTitle('');
            setDescription('');
            setCategory('');
            setImageFile(null);
            setImagePreview(null);
            setImageIpfsUrl(null);
            setMetadataIpfsUrl(null);
            setEnableListing(false);
            setSalePrice('');
            setFeaturedPlacement(false);
          }
        } catch (error) {
          console.error('❌ Error saving to backend:', error);
        } finally {
          setMintingStep('idle');
        }
      };

      saveNFTToBackend();
    }
  }, [isConfirmed, hash, mintingStep, title, description, imageIpfsUrl, location, category, enableListing, salePrice, address, queryClient, toast]);

  // REMOVED: State debug - causing infinite loop

  // REMOVED: Old two-step approval process - now using batch transactions
  
  // REMOVED: Old two-step minting process - now using batch transactions
  
  // REMOVED: Old NFT confirmation process - now using batch transactions
  
  // Handle batch and contract errors
  useEffect(() => {
    if (batchError) {
      console.error('Batch transaction error:', batchError);
      const errorMsg = batchError.message.includes('413') 
        ? "Transaction too large - please use smaller image" 
        : batchError.message.includes('User rejected')
        ? "Transaction cancelled by user"
        : "Transaction failed - please try again";
      
      toast({
        title: "Transaction Failed", 
        description: errorMsg, 
        variant: "destructive",
      });
      setMintingStep('idle');
    }
    
    if (contractError) {
      console.error('Contract error:', contractError);
      toast({
        title: "Transaction Failed", 
        description: contractError.message || "Transaction rejected", 
        variant: "destructive",
      });
      setMintingStep('idle');
    }
  }, [batchError, contractError, toast]);

  const mintMutation = useMutation({
    mutationFn: async (nftData: any) => {
      return apiRequest("POST", "/api/nfts", nftData);
    },
    onSuccess: () => {
      // NFT success toast removed for cleaner UX
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

  const handleFileSelect = async (file: File) => {
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

    // Clear previous states when new file is selected
    setImageFile(file);
    setImageIpfsUrl(null);
    setImageObjectStorageUrl(null);
    setMetadataIpfsUrl(null);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to both IPFS and Object Storage simultaneously
    try {
      setMintingStep('uploading-image');
      setUploadProgress('Uploading image to IPFS and Object Storage...');
      
      console.log('📤 Starting dual upload (IPFS + Object Storage)...');
      
      // Prepare form data for Object Storage
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('mimeType', file.type);
      
      // Upload to both services in parallel
      const [ipfsUrl, objectStorageResult] = await Promise.all([
        ipfsClient.uploadImage(file),
        fetch('/api/object-storage/upload', {
          method: 'POST',
          body: formData
        }).then(res => res.json())
      ]);
      
      setImageIpfsUrl(ipfsUrl);
      setImageObjectStorageUrl(objectStorageResult.objectUrl);
      
      console.log('✅ Image uploaded to IPFS:', ipfsUrl);
      console.log('✅ Image uploaded to Object Storage:', objectStorageResult.objectUrl);
      
      toast({
        title: "✅ Image Uploaded",
        description: "Your image has been uploaded to IPFS and Object Storage successfully!",
        variant: "default",
      });
      
      setMintingStep('idle');
      setUploadProgress('');
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      setMintingStep('idle');
      setUploadProgress('');
      
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    }
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

  // 🚀 IPFS + FARCASTER NATIVE: Upload metadata to IPFS then mint!
  const handleMint = async () => {
    console.log('🔥 IPFS MINT STARTING!');
    
    // Validate connection and location
    if (!isConnected || !address) {
      console.log('❌ Missing wallet connection');
      return;
    }

    // Validate location - either GPS or manual with coordinates
    if (!useManualLocation && !location) {
      toast({
        title: "Location Required", 
        description: "Please enable location access or use manual location",
        variant: "destructive",
      });
      return;
    }

    // Critical: Manual location MUST have map coordinates selected
    if (useManualLocation && (!selectedCoords || !manualLocation.trim())) {
      toast({
        title: "Manual Location Incomplete", 
        description: "Please click on the map to select coordinates and enter a location name",
        variant: "destructive",
      });
      return;
    }
    
    if (!title || !category || !imageFile || (!imageIpfsUrl && !imageObjectStorageUrl)) {
      toast({
        title: "Missing Information", 
        description: (!imageIpfsUrl && !imageObjectStorageUrl) ? "Please wait for image to upload" : "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Final coordinate validation
    const finalLat = useManualLocation ? selectedCoords?.lat : location?.latitude;
    const finalLng = useManualLocation ? selectedCoords?.lng : location?.longitude;
    
    if (!finalLat || !finalLng || finalLat === 0 && finalLng === 0) {
      toast({
        title: "Invalid Coordinates", 
        description: "Cannot mint NFT without valid location coordinates",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ Location validation passed:', {
      manual: useManualLocation,
      coords: { lat: finalLat, lng: finalLng },
      location: useManualLocation ? manualLocation : location?.city
    });
    
    try {
      // Step 1: Upload metadata to IPFS
      setMintingStep('uploading-metadata');
      setUploadProgress('Creating metadata and uploading to IPFS...');
      
      console.log('📋 Creating NFT metadata...');
      const metadata = createNFTMetadata({
        title,
        description: description || "Travel NFT",
        imageIpfsUrl: imageIpfsUrl || "",
        category,
        location: {
          city: useManualLocation ? manualLocation : (location?.city || "Unknown City"),
          latitude: useManualLocation ? (selectedCoords ? selectedCoords.lat.toString() : "0") : (location?.latitude.toString() || "0"),
          longitude: useManualLocation ? (selectedCoords ? selectedCoords.lng.toString() : "0") : (location?.longitude.toString() || "0")
        }
      });
      
      console.log('📤 Uploading metadata to IPFS...');
      const metadataIpfsUrl = await ipfsClient.uploadMetadata(metadata);
      setMetadataIpfsUrl(metadataIpfsUrl);
      
      console.log('✅ Metadata uploaded to IPFS:', metadataIpfsUrl);
      
      // Step 2: Batch approve + mint with IPFS metadata URL
      setMintingStep('approving');
      setUploadProgress('');
      console.log('🎯 Creating batch transaction: approve + mint with IPFS metadata');
      
      // 🚀 REAL BLOCKCHAIN: Batch approve + mint in ONE Farcaster confirmation!
      console.log('⚡ STARTING REAL BLOCKCHAIN MINT WITH IPFS...');
      
      await sendCalls({
        calls: [
          // 1. Approve USDC spending first
          {
            to: USDC_CONTRACT_ADDRESS,
            data: encodeFunctionData({
              abi: USDC_ABI,
              functionName: 'approve',
              args: [NFT_CONTRACT_ADDRESS, USDC_MINT_AMOUNT]
            })
          },
          // 2. Mint NFT with IPFS metadata URL
          {
            to: NFT_CONTRACT_ADDRESS,
            data: encodeFunctionData({
              abi: NFT_ABI,
              functionName: 'mintTravelNFT',
              args: [
                address,
                useManualLocation ? manualLocation : (location?.city || `${location?.latitude.toFixed(4)}, ${location?.longitude.toFixed(4)}`),
                useManualLocation ? (selectedCoords ? selectedCoords.lat.toString() : "0") : (location?.latitude.toString() || "0"),
                useManualLocation ? (selectedCoords ? selectedCoords.lng.toString() : "0") : (location?.longitude.toString() || "0"), 
                category,
                metadataIpfsUrl // IPFS metadata URL instead of base64
              ]
            })
          }
        ]
      });
      
      console.log('✅ Blockchain transaction batch sent with IPFS metadata!');
      console.log('⏳ Waiting for transaction confirmation...');
      
      // Transaction sent successfully - UI will update when confirmed via useWaitForTransactionReceipt
      
    } catch (error) {
      console.error('❌ IPFS mint failed:', error);
      setMintingStep('idle');
      setUploadProgress('');
      
      // Mobile-specific error handling
      const isMobileError = error instanceof Error && 
        (error.message.includes('User rejected') || 
         error.message.includes('413') ||
         error.message.includes('chain-proxy'));
         
      const errorMsg = isMobileError 
        ? "Mobile wallet issue - please try connecting with Coinbase Wallet or check your connection"
        : error instanceof Error ? error.message : "Minting failed";
      
      toast({
        title: "Transaction Failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const categories = ["Landscape", "Architecture", "Street Photography", "Cultural", "Wildlife", "Adventure"];

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'pb-16' : ''}`}>
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-4xl font-bold mb-4" data-testid="mint-title">Mint Your Travel NFT</h1>
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
                className={`upload-dropzone rounded-lg p-8 text-center mb-4 ${
                  imageIpfsUrl && imageObjectStorageUrl 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer'
                } ${isDragging ? 'dragover' : ''}`}
                onDrop={imageIpfsUrl && imageObjectStorageUrl ? undefined : handleDrop}
                onDragOver={imageIpfsUrl && imageObjectStorageUrl ? undefined : handleDragOver}
                onDragLeave={imageIpfsUrl && imageObjectStorageUrl ? undefined : handleDragLeave}
                onClick={imageIpfsUrl && imageObjectStorageUrl ? undefined : () => document.getElementById('file-input')?.click()}
                data-testid="upload-dropzone"
              >
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                {imageIpfsUrl && imageObjectStorageUrl ? (
                  <>
                    <p className="text-green-600 dark:text-green-400 mb-2 font-medium">✅ Photo uploaded successfully!</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Reset upload state
                        setImageFile(null);
                        setImagePreview(null);
                        setImageIpfsUrl(null);
                        setImageObjectStorageUrl(null);
                        setMetadataIpfsUrl(null);
                        (document.getElementById('file-input') as HTMLInputElement).value = '';
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                      data-testid="reset-upload"
                    >
                      Upload different photo
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-2">Drop your photo here or click to browse</p>
                    <p className="text-xs text-muted-foreground">Supports JPEG, PNG. Max size: 10MB</p>
                  </>
                )}
                <input
                  id="file-input"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  data-testid="file-input"
                  disabled={!!(imageIpfsUrl && imageObjectStorageUrl)}
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
                  <div className="mb-4">
                    <span className="text-sm font-medium">Location Selection</span>
                  </div>

                  {/* Location Type Selection */}
                  <RadioGroup
                    value={useManualLocation ? "manual" : "gps"}
                    onValueChange={(value) => {
                      setUseManualLocation(value === "manual");
                      if (value === "gps") {
                        // Clear manual location data and get GPS location
                        setManualLocation("");
                        setSelectedCoords(null);
                        getCurrentLocation();
                      }
                    }}
                    className="mb-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="gps" id="gps" />
                      <Label htmlFor="gps" className="text-sm">Use GPS Location</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="manual" id="manual" />
                      <Label htmlFor="manual" className="text-sm">Search City Manually</Label>
                    </div>
                  </RadioGroup>

                  {/* GPS Location Display */}
                  {!useManualLocation && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span data-testid="detected-location">
                          {locationLoading ? "Getting your location..." :
                           location ? (location.city || "Unknown City") : 
                           locationError ? "Location access required - please allow location access in browser" : "Detecting location..."}
                        </span>
                      </div>
                      {location && (
                        <div className="text-xs text-muted-foreground" data-testid="coordinates">
                          Exact GPS coordinates for authenticity
                        </div>
                      )}
                      {locationError && (
                        <div className="text-xs text-destructive">
                          📍 Location permission needed for NFT minting
                        </div>
                      )}
                      <div className="text-xs text-blue-600">
                        🛡️ GPS coordinates are automatically detected for authenticity
                      </div>
                    </div>
                  )}

                  {/* Manual City Search */}
                  {useManualLocation && (
                    <div className="space-y-2">
                      <CitySearchInput
                        onCitySelect={(city) => {
                          setManualLocation(city.name);
                          setSelectedCoords({
                            lat: city.latitude,
                            lng: city.longitude
                          });
                          console.log(`🏙️ City selected: ${city.name} at ${city.latitude}, ${city.longitude}`);
                        }}
                        placeholder="Search for your city..."
                        className="w-full"
                      />
                      <div className="text-xs text-blue-600">
                        🌍 Random location within selected city for privacy
                      </div>
                      {manualLocation && selectedCoords && (
                        <div className="text-xs text-muted-foreground">
                          Selected: {manualLocation} ({selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)})
                        </div>
                      )}
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
                    <span className="text-muted-foreground">Base Network</span>
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
                  {(isConfirming || isBatchPending) && !isConfirmed && !sendCallsData && (
                    <div className="text-xs text-yellow-600 mt-1">
                      ⏳ {mintingStep === 'approving' ? 'Approving USDC & Minting...' : 
                          mintingStep === 'minting' ? 'Minting NFT...' : 
                          'Processing...'}
                    </div>
                  )}
                  {(isConfirmed || sendCallsData) && (
                    <div className="space-y-2 mt-1">
                      <div className="text-xs text-green-600">
                        ✅ NFT successfully minted!
                      </div>
                      {/* Share button temporarily hidden
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const shareText = `Just minted my travel NFT "${title}" from ${useManualLocation ? manualLocation : location?.city}! 🌍 ✨\n\nExplore all travel NFTs on TravelMint 👇 #TravelMint #NFT`;
                          const nftUrl = `${window.location.origin}/explore`;
                          
                          const params = new URLSearchParams();
                          params.append('text', shareText);
                          params.append('embeds[]', nftUrl);
                          if (imageIpfsUrl) {
                            // Use better IPFS gateway
                            const optimizedImageUrl = imageIpfsUrl.includes('gateway.pinata.cloud') 
                              ? imageIpfsUrl.replace('gateway.pinata.cloud', 'ipfs.io')
                              : imageIpfsUrl;
                            params.append('embeds[]', optimizedImageUrl);
                          }
                          
                          const warpcastUrl = `https://warpcast.com/~/compose?${params.toString()}`;
                          
                          window.open(warpcastUrl, '_blank');
                          
                          toast({
                            title: "Opening Farcaster",
                            description: "Share your new NFT with the world!",
                          });
                        }}
                        className="w-full text-xs h-8"
                        data-testid="share-minted-nft"
                      >
                        <Share2 className="w-3 h-3 mr-1" />
                        Share on Farcaster
                      </Button>
                      */}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button
                    className="w-full bg-primary text-primary-foreground py-3 font-medium hover:bg-primary/90 transition-colors"
                    onClick={async () => {
                      console.log('⚡ MINT: Starting IPFS + blockchain transaction...');
                      
                      const finalLocation = useManualLocation ? 
                        { city: manualLocation, latitude: 0, longitude: 0 } : location;
                      
                      if (!isConnected || !title || !category || !imageFile || (!location && !useManualLocation) || (useManualLocation && !manualLocation)) {
                        console.log('❌ Missing required fields');
                        return;
                      }
                      
                      try {
                        await handleMint();
                      } catch (err) {
                        console.error('🚨 Mint failed:', err);
                      }
                    }}
                    disabled={isBatchPending || isContractPending || !isConnected || !title || !category || !imageFile || (!useManualLocation && !location) || (useManualLocation && !manualLocation) || mintingStep !== 'idle'}
                    data-testid="mint-button"
                  >
                    {mintingStep === 'uploading-image' && (
                      <>
                        <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full" />
                        Uploading Image to IPFS...
                      </>
                    )}
                    {mintingStep === 'uploading-metadata' && (
                      <>
                        <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full" />
                        Uploading Metadata to IPFS...
                      </>
                    )}
                    {mintingStep === 'approving' && !isConfirmed && (
                      <>
                        <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full" />
                        {approvalHash ? 'Minting NFT...' : 'Approving USDC...'}
                      </>
                    )}
                    {mintingStep === 'minting' && !isConfirmed && (
                      <>
                        <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full" />
                        Minting NFT...
                      </>
                    )}
                    {(isConfirmed || sendCallsData) && (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                        NFT Successfully Minted!
                      </>
                    )}
                    {mintingStep === 'idle' && !isConfirmed && !sendCallsData && (
                      <>
                        <Wallet className="w-4 h-4 mr-2" />
                        {isBatchPending ? "Confirming blockchain transaction..." :
                         !isConnected ? "Connect wallet to mint" :
                         locationLoading && !useManualLocation ? "Getting location..." :
                         !useManualLocation && !location ? "Location required" :
                         useManualLocation && !manualLocation ? "Enter location manually" :
                         !title || !category || !imageFile ? "Fill all fields" :
                         !imageIpfsUrl ? "Upload image first" :
                         "Mint NFT for 1 USDC"}
                      </>
                    )}
                  </Button>
                  
                  {/* Share NFT Button - temporarily hidden */}
                  {false && (isConfirmed || sendCallsData) && (
                    <ComposeCastButton
                      type="mint"
                      nftName={title}
                      nftLocation={useManualLocation ? manualLocation : (location?.city || "Unknown Location")}
                      variant="outline"
                      className="w-full"
                    />
                  )}
                  
                  <Button
                    variant="secondary"
                    className="w-full py-2 font-medium hover:bg-secondary/80 transition-colors"
                    disabled={!useManualLocation && !location}
                    data-testid="preview-button"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview on Map
                  </Button>

                  {/* IPFS Progress Indicator */}
                  {uploadProgress && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                      <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                        <div className="mr-2 h-4 w-4 animate-spin border-2 border-blue-600 border-t-transparent rounded-full" />
                        {uploadProgress}
                      </div>
                    </div>
                  )}

                  {/* IPFS Status Indicators */}
                  {imageIpfsUrl && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                      <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                        <div className="mr-2 h-4 w-4 rounded-full bg-green-500" />
                        Image uploaded to IPFS successfully
                      </div>
                    </div>
                  )}

                  {metadataIpfsUrl && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                      <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                        <div className="mr-2 h-4 w-4 rounded-full bg-green-500" />
                        Metadata uploaded to IPFS successfully
                      </div>
                    </div>
                  )}
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
