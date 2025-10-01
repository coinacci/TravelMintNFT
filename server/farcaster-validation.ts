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
        // Farcaster.xyz: https://farcaster.xyz/username/0x12345678
        /farcaster\.xyz\/[^\/]+\/(0x[a-fA-F0-9]+)/,
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
   * Fetch cast data from Neynar API
   */
  private async fetchCastData(castHash: string): Promise<CastData | null> {
    try {
      const apiKey = process.env.NEYNAR_API_KEY;
      if (!apiKey) {
        console.error('❌ NEYNAR_API_KEY not found');
        return null;
      }

      console.log(`🔍 Fetching cast data from Neynar API for hash: ${castHash}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Neynar API endpoint for cast by hash
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash`,
        { 
          signal: controller.signal,
          headers: {
            'accept': 'application/json',
            'x-api-key': apiKey
          }
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log(`⚠️ Neynar API error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log('Error response:', errorText);
        return null;
      }

      const data = await response.json();
      console.log('🔍 Neynar API response:', JSON.stringify(data, null, 2));
      
      // Parse Neynar API response
      if (data && data.cast) {
        const cast = data.cast;
        
        // Validate timestamp exists - critical for "posted today" validation
        if (!cast.timestamp) {
          console.log('⚠️ Cast missing timestamp - cannot validate posting date');
          return null;
        }
        
        // Parse timestamp - Neynar returns ISO string
        let timestamp: string;
        if (typeof cast.timestamp === 'string') {
          timestamp = cast.timestamp;
        } else if (typeof cast.timestamp === 'number') {
          // Handle epoch seconds or milliseconds
          const tsMillis = cast.timestamp > 1e12 ? cast.timestamp : cast.timestamp * 1000;
          timestamp = new Date(tsMillis).toISOString();
        } else {
          console.log('⚠️ Invalid timestamp format:', cast.timestamp);
          return null;
        }
        
        return {
          text: cast.text || '',
          timestamp,
          author: {
            fid: cast.author?.fid || 0,
            username: cast.author?.username || 'unknown'
          }
        };
      }

      console.log('⚠️ Unexpected cast data format from Neynar API');
      return null;

    } catch (error) {
      console.error('❌ Neynar API request failed:', error);
      return null;
    }
  }

  /**
   * Validate cast content for TravelMint requirements
   */
  private validateContent(text: string): ValidationResult {
    const lowerText = text.toLowerCase();

    // Check for TravelMint mention (only requirement)
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