/**
 * Neynar API integration for fetching Farcaster user data
 * https://docs.neynar.com/reference/user-bulk-by-address
 */

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE_URL = "https://api.neynar.com/v2/farcaster";

interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  verified_addresses: {
    eth_addresses: string[];
  };
}

interface NeynarBulkAddressResponse {
  [address: string]: NeynarUser[];
}

interface NeynarUserResponse {
  user: NeynarUser;
}

/**
 * Get Farcaster user info by wallet address using Neynar API
 * @param address - Ethereum wallet address
 * @returns User FID and username, or null if not found
 */
export async function getNeynarUserByAddress(address: string): Promise<{ fid: string; username: string } | null> {
  if (!NEYNAR_API_KEY) {
    console.warn("⚠️ NEYNAR_API_KEY not set - skipping Neynar API call");
    return null;
  }

  try {
    const url = `${NEYNAR_BASE_URL}/user/bulk-by-address?addresses=${address.toLowerCase()}&address_types=verified_address`;
    
    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`⚠️ Neynar API rate limit hit for ${address}`);
        return null;
      }
      throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
    }

    const data: NeynarBulkAddressResponse = await response.json();
    
    // Neynar returns an object with address as key
    const lowerAddress = address.toLowerCase();
    const users = data[lowerAddress];
    
    if (!users || users.length === 0) {
      return null;
    }

    // Take first user if multiple (rare)
    const user = users[0];
    
    return {
      fid: user.fid.toString(),
      username: user.username
    };
    
  } catch (error: any) {
    console.error(`❌ Neynar API error for address ${address}:`, error.message);
    return null;
  }
}

/**
 * Get Farcaster user info by FID using Neynar API
 * @param fid - Farcaster ID
 * @returns User FID and username, or null if not found
 */
export async function getNeynarUserByFid(fid: string): Promise<{ fid: string; username: string } | null> {
  if (!NEYNAR_API_KEY) {
    console.warn("⚠️ NEYNAR_API_KEY not set - skipping Neynar API call");
    return null;
  }

  try {
    const url = `${NEYNAR_BASE_URL}/user/bulk?fids=${fid}`;
    
    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "api_key": NEYNAR_API_KEY
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`⚠️ Neynar API rate limit hit for FID ${fid}`);
        return null;
      }
      throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
    }

    const data: { users: NeynarUser[] } = await response.json();
    
    if (!data.users || data.users.length === 0) {
      return null;
    }

    const user = data.users[0];
    
    return {
      fid: user.fid.toString(),
      username: user.username
    };
    
  } catch (error: any) {
    console.error(`❌ Neynar API error for FID ${fid}:`, error.message);
    return null;
  }
}

/**
 * Add delay to respect rate limits (150 requests per minute = ~400ms between requests)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
