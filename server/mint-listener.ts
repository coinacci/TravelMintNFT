import { getNftContract } from "./blockchain.js";
import { storage } from "./storage.js";
import { syncSingleImage } from "./image-sync.js";
import { nanoid } from "nanoid";

let isListening = false;
let lastProcessedBlock = 0;

// Set to track processed transaction hashes (prevent duplicates)
const processedTxHashes = new Set<string>();

export async function startMintEventListener() {
  if (isListening) {
    console.log("⚠️ Mint event listener already running");
    return;
  }

  console.log("🎧 Starting NFT Mint event listener...");
  
  try {
    const nftContract = getNftContract();
    
    // Listen for Transfer events where 'from' is 0x0 (mint events)
    const mintFilter = nftContract.filters.Transfer(
      "0x0000000000000000000000000000000000000000", // from = null address (mint)
      null, // to = any address
      null  // tokenId = any token
    );
    
    nftContract.on(mintFilter, async (from, to, tokenId, event) => {
      const txHash = event.transactionHash || event.log?.transactionHash || 'unknown';
      const blockNumber = event.blockNumber || event.log?.blockNumber || 0;
      
      // Deduplicate by transaction hash
      if (processedTxHashes.has(txHash)) {
        console.log(`⚠️ Mint event already processed: tx ${txHash}`);
        return;
      }
      
      try {
        console.log(`\n🎉 NEW MINT DETECTED!`);
        console.log(`  Token ID: ${tokenId.toString()}`);
        console.log(`  Minted to: ${to}`);
        console.log(`  Block: ${blockNumber}`);
        console.log(`  Transaction: ${txHash}`);
        
        const tokenIdStr = tokenId.toString();
        
        // Check if token already exists in database
        const existingNFT = await storage.getNFTByTokenId(tokenIdStr);
        if (existingNFT) {
          console.log(`⚠️ Token #${tokenIdStr} already exists in database - skipping`);
          processedTxHashes.add(txHash);
          return;
        }
        
        // Retry loop for fetching metadata and saving to database
        const maxRetries = 3;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
          try {
            console.log(`📡 Fetching metadata for token #${tokenIdStr}...`);
            
            // Fetch tokenURI from contract
            const tokenURI = await nftContract.tokenURI(tokenId);
            
            if (!tokenURI) {
              throw new Error('Empty tokenURI');
            }
            
            // Parse base64 encoded metadata
            let metadata: any = {};
            let imageUrl = '';
            let location = '';
            let latitude: number | null = null;
            let longitude: number | null = null;
            let description = '';
            
            if (tokenURI.startsWith('data:application/json;base64,')) {
              const base64Data = tokenURI.replace('data:application/json;base64,', '');
              const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
              metadata = JSON.parse(jsonString);
              
              imageUrl = metadata.image || '';
              description = metadata.description || '';
              
              // Extract attributes
              if (metadata.attributes && Array.isArray(metadata.attributes)) {
                for (const attr of metadata.attributes) {
                  if (attr.trait_type === 'Location') location = attr.value || '';
                  if (attr.trait_type === 'Latitude') latitude = parseFloat(attr.value);
                  if (attr.trait_type === 'Longitude') longitude = parseFloat(attr.value);
                }
              }
            } else {
              console.warn(`⚠️ Token #${tokenIdStr} has non-base64 tokenURI format: ${tokenURI.substring(0, 50)}...`);
            }
            
            console.log(`  📍 Location: ${location || 'Unknown'}`);
            console.log(`  🌐 Coordinates: ${latitude}, ${longitude}`);
            console.log(`  🖼️ Image: ${imageUrl.substring(0, 60)}...`);
            
            // Add to database
            const newNFT = {
              id: nanoid(),
              title: metadata.name || `TravelNFT #${tokenIdStr}`,
              description: description,
              imageUrl: imageUrl,
              objectStorageUrl: null,
              location: location || 'Unknown Location',
              latitude: latitude ? latitude.toString() : null,
              longitude: longitude ? longitude.toString() : null,
              category: 'travel',
              price: '0',
              isForSale: 0,
              creatorAddress: to.toLowerCase(),
              ownerAddress: to.toLowerCase(),
              farcasterCreatorUsername: null,
              farcasterOwnerUsername: null,
              farcasterCreatorFid: null,
              farcasterOwnerFid: null,
              mintPrice: '1',
              royaltyPercentage: '5',
              tokenId: tokenIdStr,
              contractAddress: '0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f',
              transactionHash: txHash,
              metadata: metadata
            };
            
            const createdNFT = await storage.createNFT(newNFT);
            
            console.log(`✅ Token #${tokenIdStr} added to database successfully!`);
            console.log(`   Transaction: ${txHash}`);
            console.log(`🔄 New mint will appear on explore page within cache TTL (~10 seconds)`);
            
            // Sync image to Object Storage in background for faster loading
            if (createdNFT && createdNFT.id) {
              syncSingleImage(createdNFT.id).then(success => {
                if (success) {
                  console.log(`🖼️ Token #${tokenIdStr} image cached to Object Storage`);
                } else {
                  console.log(`⚠️ Token #${tokenIdStr} image cache failed (will use IPFS fallback)`);
                }
              }).catch(err => {
                console.error(`❌ Image sync error for token #${tokenIdStr}:`, err.message);
              });
            }
            
            // Mark as processed
            processedTxHashes.add(txHash);
            lastProcessedBlock = blockNumber;
            
            // Success - break retry loop
            break;
            
          } catch (error) {
            retryCount++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Error processing mint (attempt ${retryCount}/${maxRetries}):`, errorMessage);
            
            if (retryCount >= maxRetries) {
              // Save to pending_mints for automatic retry
              try {
                await storage.createPendingMint({
                  tokenId: tokenIdStr,
                  contractAddress: '0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f',
                  ownerAddress: to.toLowerCase(),
                  transactionHash: txHash,
                  retryCount: 0,
                  lastError: errorMessage,
                  lastAttemptAt: new Date()
                });
                console.log(`💾 Token #${tokenIdStr} saved to pending queue for automatic retry`);
                console.log(`   Will retry metadata fetch automatically via metadata sync service`);
                
                // Mark as processed to avoid duplicate events
                processedTxHashes.add(txHash);
              } catch (dbError) {
                console.error(`❌ CRITICAL: Failed to save pending mint:`, dbError);
                console.error(`   Token ID: ${tokenIdStr}`);
                console.error(`   Transaction: ${txHash}`);
                console.error(`   ⚠️ Manual intervention required`);
              }
            } else {
              // Wait before retry (exponential backoff: 1s, 2s, 4s)
              const backoffMs = 1000 * Math.pow(2, retryCount - 1);
              console.log(`⏳ Retrying in ${backoffMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
          }
        }
        
      } catch (error) {
        console.error(`❌ Error in mint event handler (outer):`, error);
        console.error(`   Transaction: ${txHash}`);
      }
    });
    
    isListening = true;
    console.log("✅ NFT Mint event listener started successfully");
    console.log("🔊 Listening for new mints in real-time...");
    
  } catch (error) {
    console.error("❌ Failed to start mint event listener:", error);
  }
}

export function stopMintEventListener() {
  if (!isListening) {
    return;
  }
  
  console.log("🛑 Stopping NFT Mint event listener...");
  const nftContract = getNftContract();
  nftContract.removeAllListeners("Transfer");
  isListening = false;
  processedTxHashes.clear();
  console.log("✅ NFT Mint event listener stopped");
}

export function getLastProcessedBlock(): number {
  return lastProcessedBlock;
}
