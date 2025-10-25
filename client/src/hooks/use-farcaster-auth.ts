import { useState, useEffect } from "react";
import sdk from "@farcaster/frame-sdk";
import { useProfile } from "@farcaster/auth-kit";

interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  isAuthKit?: boolean;
}

export function useFarcasterAuth() {
  const [frameSdkUser, setFrameSdkUser] = useState<FarcasterUser | null>(null);
  const [isFrameContext, setIsFrameContext] = useState(false);
  
  const authKitProfile = useProfile();
  
  useEffect(() => {
    const checkFrameContext = async () => {
      try {
        if (typeof window !== 'undefined' && sdk?.context) {
          const context = await Promise.resolve(sdk.context);
          if (context?.user) {
            setIsFrameContext(true);
            setFrameSdkUser({
              fid: context.user.fid,
              username: context.user.username || '',
              displayName: context.user.displayName || '',
              pfpUrl: context.user.pfpUrl,
              isAuthKit: false
            });
          }
        }
      } catch (error) {
        console.log('No Farcaster Frame context - running in browser');
      }
    };
    
    checkFrameContext();
  }, []);
  
  if (isFrameContext && frameSdkUser) {
    return {
      isAuthenticated: true,
      user: frameSdkUser,
      isAuthKit: false,
      isFrameSDK: true
    };
  }
  
  if (authKitProfile.isAuthenticated && authKitProfile.profile && 
      authKitProfile.profile.fid && authKitProfile.profile.username) {
    const authKitUser: FarcasterUser = {
      fid: authKitProfile.profile.fid,
      username: authKitProfile.profile.username,
      displayName: authKitProfile.profile.displayName || authKitProfile.profile.username,
      pfpUrl: authKitProfile.profile.pfpUrl,
      isAuthKit: true
    };
    
    return {
      isAuthenticated: true,
      user: authKitUser,
      isAuthKit: true,
      isFrameSDK: false
    };
  }
  
  return {
    isAuthenticated: false,
    user: null,
    isAuthKit: false,
    isFrameSDK: false
  };
}
