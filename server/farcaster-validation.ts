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
      // Validate URL format
      if (!castUrl.includes('warpcast.com') && !castUrl.includes('farcaster.xyz')) {
        return { isValid: false, reason: "Invalid cast URL format" };
      }

      // Fetch cast data using URL directly (Neynar supports URL type)
      const castData = await this.fetchCastData(castUrl);
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
   * Fetch cast data from Neynar API
   */
  private async fetchCastData(castUrl: string): Promise<CastData | null> {
    try {
      const apiKey = process.env.NEYNAR_API_KEY;
      if (!apiKey) {
        console.error('❌ NEYNAR_API_KEY not found');
        return null;
      }

      console.log(`🔍 Fetching cast data from Neynar API for URL: ${castUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Neynar API endpoint for cast by URL (supports short hashes in URLs)
      const encodedUrl = encodeURIComponent(castUrl);
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodedUrl}&type=url`,
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