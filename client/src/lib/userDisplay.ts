/**
 * Utility functions for displaying user identities in a user-friendly way
 * Priority: Farcaster username > Base App > Shortened wallet address
 */

export interface UserIdentity {
  walletAddress: string;
  farcasterUsername?: string | null;
  farcasterFid?: string | null;
}

/**
 * Format a user's display name based on available information
 * @param identity - User identity data
 * @returns Formatted display name (e.g., "@alice", "Base App", "0x1234...5678")
 */
export function formatUserDisplayName(identity: UserIdentity): string {
  // 1. If Farcaster username is available, use it
  if (identity.farcasterUsername) {
    return `@${identity.farcasterUsername}`;
  }
  
  // 2. Check if it's a recognized platform wallet
  const platformName = getPlatformFromAddress(identity.walletAddress);
  if (platformName) {
    return platformName;
  }
  
  // 3. Fallback to shortened wallet address
  return shortenAddress(identity.walletAddress);
}

/**
 * Format user with both display name and optional shortened address
 * @param identity - User identity data
 * @param showAddress - Whether to show address in parentheses
 * @returns Formatted string (e.g., "@alice (0x1234...5678)" or "@alice")
 */
export function formatUserWithAddress(identity: UserIdentity, showAddress = false): string {
  const displayName = formatUserDisplayName(identity);
  
  if (showAddress && identity.farcasterUsername) {
    return `${displayName} (${shortenAddress(identity.walletAddress)})`;
  }
  
  return displayName;
}

/**
 * Shorten an Ethereum address to a readable format
 * @param address - Full ethereum address
 * @returns Shortened address (e.g., "0x1234...5678")
 */
export function shortenAddress(address: string): string {
  if (!address || address.length < 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Detect if a wallet address belongs to a known platform
 * @param address - Wallet address to check
 * @returns Platform name or null
 */
function getPlatformFromAddress(address: string): string | null {
  // Common platform treasury/contract addresses
  const platformAddresses: Record<string, string> = {
    '0x7cde7822456aac667df0420cd048295b92704084': 'TravelMint Platform',
    // Add more platform addresses as needed
  };
  
  const lowerAddress = address.toLowerCase();
  return platformAddresses[lowerAddress] || null;
}

/**
 * Get Farcaster profile URL from username or FID
 * @param username - Farcaster username (without @)
 * @param fid - Farcaster FID
 * @returns Warpcast profile URL
 */
export function getFarcasterProfileUrl(username?: string | null, fid?: string | null): string | null {
  if (username) {
    return `https://warpcast.com/${username}`;
  }
  if (fid) {
    return `https://warpcast.com/~/profiles/${fid}`;
  }
  return null;
}

/**
 * Check if a user has a Farcaster identity
 * @param identity - User identity data
 * @returns true if user has Farcaster username or FID
 */
export function hasFarcasterIdentity(identity: UserIdentity): boolean {
  return !!(identity.farcasterUsername || identity.farcasterFid);
}
