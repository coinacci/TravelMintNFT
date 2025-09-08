import { useState, useEffect } from "react";

export function useIsFarcasterMobile() {
  const [isFarcasterMobile, setIsFarcasterMobile] = useState(false);
  const [isDetected, setIsDetected] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent || '';
      const isMobile = userAgent.includes('Farcaster') && 
                      (userAgent.includes('Mobile') || 
                       userAgent.includes('Android') || 
                       userAgent.includes('iPhone') ||
                       /Mobi|Android/i.test(userAgent));
      
      console.log('🔍 Farcaster Mobile Detection:', {
        userAgent: userAgent.substring(0, 100),
        isFarcasterMobile: isMobile,
        inFrame: window.parent !== window
      });
      
      setIsFarcasterMobile(isMobile);
      setIsDetected(true);
    }
  }, []);

  return { isFarcasterMobile, isDetected };
}