import fetch from 'node-fetch';

// LEGACY FILE: No longer used for NFT discovery (replaced by direct RPC in blockchain.ts)
// Keeping for potential future use with transfer history queries

// Use Moralis API instead of deprecated Basescan V1
const MORALIS_API_URL = 'https://deep-index.moralis.io/api/v2.2';
const BASESCAN_API_URL = 'https://api.basescan.org/api'; // Legacy constant
const API_KEY = process.env.MORALIS_API_KEY;
const NFT_CONTRACT_ADDRESS = '0x8c12c9ebf7db0a6370361ce9225e3b77d22a558f';
const CHAIN = 'base'; // Base mainnet

interface BasescanResponse<T> {
  status: string;
  message: string;
  result: T;
}

interface NFTTransfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  tokenID: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getAllTokenIdsFromContract(): Promise<Set<string>> {
  console.log('🔍 Fetching all token IDs from Moralis API...');
  
  if (!API_KEY) {
    throw new Error('MORALIS_API_KEY not found in environment');
  }

  try {
    const tokenIds = new Set<string>();
    let cursor: string | null = null;
    let page = 0;
    
    // Moralis API uses pagination with cursor
    do {
      page++;
      const url = `${MORALIS_API_URL}/nft/${NFT_CONTRACT_ADDRESS}?chain=${CHAIN}&format=decimal&limit=100${cursor ? `&cursor=${cursor}` : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'X-API-Key': API_KEY
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Moralis API error:', response.status, errorText);
        throw new Error(`Moralis API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      
      console.log(`📄 Page ${page}: Found ${data.result?.length || 0} NFTs`);
      
      if (data.result && Array.isArray(data.result)) {
        for (const nft of data.result) {
          tokenIds.add(nft.token_id);
        }
      }
      
      cursor = data.cursor || null;
      
      // Small delay to respect rate limits
      if (cursor) {
        await delay(200);
      }
      
    } while (cursor);

    console.log(`✅ Found ${tokenIds.size} unique token IDs from Moralis`);
    return tokenIds;

  } catch (error) {
    console.error('❌ Error fetching token IDs from Moralis:', error);
    throw error;
  }
}

export async function getTokenTransfers(tokenId: string): Promise<NFTTransfer[]> {
  console.log(`🔍 Fetching transfer history for token ${tokenId}...`);
  
  if (!API_KEY) {
    throw new Error('BASESCAN_API_KEY not found in environment');
  }

  try {
    await delay(250);

    const url = new URL(BASESCAN_API_URL);
    url.searchParams.append('module', 'account');
    url.searchParams.append('action', 'tokennfttx');
    url.searchParams.append('contractaddress', NFT_CONTRACT_ADDRESS);
    url.searchParams.append('startblock', '0');
    url.searchParams.append('endblock', '99999999');
    url.searchParams.append('sort', 'asc');
    url.searchParams.append('apikey', API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json() as BasescanResponse<NFTTransfer[]>;

    if (data.status !== '1') {
      console.error('❌ Basescan API error:', data.message);
      return [];
    }

    const transfers = data.result.filter(t => t.tokenID === tokenId);
    console.log(`✅ Found ${transfers.length} transfers for token ${tokenId}`);
    
    return transfers;

  } catch (error) {
    console.error(`❌ Error fetching transfers for token ${tokenId}:`, error);
    return [];
  }
}

export async function getCurrentOwner(tokenId: string): Promise<string | null> {
  const transfers = await getTokenTransfers(tokenId);
  
  if (transfers.length === 0) {
    return null;
  }

  const sortedTransfers = transfers.sort((a, b) => 
    parseInt(b.blockNumber) - parseInt(a.blockNumber)
  );

  return sortedTransfers[0].to;
}

export async function getMintBlock(tokenId: string): Promise<number | null> {
  const transfers = await getTokenTransfers(tokenId);
  
  const mintTransfer = transfers.find(t => t.from === '0x0000000000000000000000000000000000000000');
  
  if (mintTransfer) {
    return parseInt(mintTransfer.blockNumber);
  }
  
  return null;
}
