import { getQuestDay } from '@shared/schema';

interface CastData {
  text: string;
  timestamp: string;
  author: {
    fid: number;
    username: string;
  };
}

interface ValidationResult {
  isValid: boolean;
  reason: string;
  castData?: CastData;
}

export class FarcasterCastValidator {
  
  /**
   * Validate a Farcaster cast URL for social post quest
   */
  async validateCast(castUrl: string): Promise<ValidationResult> {
    try {
      // Extract cast identifier from URL
      const castIdentifier = this.extractCastIdentifier(castUrl);
      if (!castIdentifier) {
        return { isValid: false, reason: "Invalid cast URL format" };
      }

      // Fetch cast data from Farcaster Hub API
      const castData = await this.fetchCastData(castIdentifier);
      if (!castData) {
        return { isValid: false, reason: "Could not fetch cast data" };
      }

      // Validate content requirements
      const contentValidation = this.validateContent(castData.text);
      if (!contentValidation.isValid) {
        return contentValidation;
      }

      // Validate timestamp (must be from today)
      const timestampValidation = this.validateTimestamp(castData.timestamp);
      if (!timestampValidation.isValid) {
        return timestampValidation;
      }

      return { 
        isValid: true, 
        reason: "Cast validation passed",
        castData 
      };

    } catch (error) {
      console.error('🚨 Cast validation error:', error);
      return { isValid: false, reason: "Cast validation failed" };
    }
  }

  /**
   * Extract cast identifier from various Farcaster URL formats
   */
  private extractCastIdentifier(url: string): string | null {
    try {
      // Support multiple Farcaster client URLs
      const patterns = [
        // Warpcast: https://warpcast.com/username/0x12345678
        /warpcast\.com\/[^\/]+\/(0x[a-fA-F0-9]+)/,
        // Direct cast hash in various formats
        /(0x[a-fA-F0-9]{8,})/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      console.log('⚠️ Could not extract cast identifier from URL:', url);
      return null;
    } catch (error) {
      console.error('🚨 Error extracting cast identifier:', error);
      return null;
    }
  }

  /**
   * Fetch cast data from Farcaster Hub API
   */
  private async fetchCastData(castHash: string): Promise<CastData | null> {
    const hubEndpoints = [
      'https://hub.farcaster.xyz',
      'https://hub.pinata.cloud'
    ];

    for (const hubUrl of hubEndpoints) {
      try {
        console.log(`🔍 Fetching cast data from ${hubUrl} for hash: ${castHash}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          `${hubUrl}/v1/castById?fid=0&hash=${castHash}`,
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.log(`⚠️ Hub ${hubUrl} error: ${response.status} ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        
        // Parse Farcaster Hub API response
        if (data && data.data && data.data.castAddBody) {
          const cast = data.data.castAddBody;
          const timestamp = new Date(data.data.timestamp * 1000).toISOString();
          
          return {
            text: cast.text || '',
            timestamp,
            author: {
              fid: data.data.fid,
              username: data.data.username || 'unknown'
            }
          };
        }

        console.log('⚠️ Unexpected cast data format from Hub API');
        continue;

      } catch (error) {
        console.log(`⚠️ Hub ${hubUrl} request failed:`, error);
        continue;
      }
    }

    console.log('❌ Failed to fetch cast data from all Hub endpoints');
    return null;
  }

  /**
   * Validate cast content for TravelMint requirements
   */
  private validateContent(text: string): ValidationResult {
    const lowerText = text.toLowerCase();

    // Check for TravelMint mention
    const travelMintKeywords = ['travelmint', 'travel mint'];
    const hasTravelMint = travelMintKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );

    if (!hasTravelMint) {
      return { 
        isValid: false, 
        reason: "Cast must mention 'TravelMint'" 
      };
    }

    // Check for app link
    const appLinkKeywords = [
      'travelmint.app',
      '.replit.app',
      'travel nft',
      'travel mint app'
    ];
    
    const hasAppLink = appLinkKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );

    if (!hasAppLink) {
      return { 
        isValid: false, 
        reason: "Cast must include app link or reference" 
      };
    }

    return { isValid: true, reason: "Content validation passed" };
  }

  /**
   * Validate that cast was posted today
   */
  private validateTimestamp(timestamp: string): ValidationResult {
    try {
      const castDate = new Date(timestamp);
      const today = getQuestDay();
      const castDay = getQuestDay(castDate);

      if (castDay !== today) {
        return { 
          isValid: false, 
          reason: "Cast must be from today" 
        };
      }

      return { isValid: true, reason: "Timestamp validation passed" };
    } catch (error) {
      return { 
        isValid: false, 
        reason: "Invalid timestamp format" 
      };
    }
  }
}

// Export singleton instance
export const farcasterCastValidator = new FarcasterCastValidator();