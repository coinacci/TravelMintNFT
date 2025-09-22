import { Link, useLocation } from "wouter";
import { useAccount } from "wagmi";
import { MapPin, Store, Globe, Home, User, Trophy, Target } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { WalletConnect } from "@/components/wallet-connect";
import { useEffect, useState } from "react";
import sdk from "@farcaster/frame-sdk";

export default function Navigation() {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { address, isConnected } = useAccount();
  const [farcasterUser, setFarcasterUser] = useState<any>(null);

  // Get Farcaster user context for quest menu
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
            console.log('✅ Farcaster user detected for navigation:', context.user.username);
          }
        }
      } catch (error) {
        console.log('ℹ️ No Farcaster context in navigation');
      }
    };
    
    getFarcasterContext();
  }, []);

  // Base navigation items
  const baseNavItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/explore", label: "Explore", icon: Globe },
    // { path: "/marketplace", label: "Marketplace", icon: Store }, // Hidden temporarily
    { path: "/my-nfts", label: "My NFTs", icon: User },
  ];
  
  // Quest items - only show for Farcaster users
  const questNavItems = farcasterUser ? [
    { path: "/quests", label: "Quests", icon: Target },
    { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ] : [];
  
  // Combine navigation items
  const navItems = [...baseNavItems, ...questNavItems];

  return (
    <>
      {/* Top Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold travel-gradient bg-clip-text text-transparent`}>
                <MapPin className={`inline-block ${isMobile ? 'w-4 h-4' : 'w-5 h-5'} mr-2`} />
                TravelMint
              </div>
            </div>
            
            <div className="flex items-center space-x-1">
              <WalletConnect />
            </div>
          </div>
        </div>
      </header>

      {/* Bottom Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
        <div className="flex items-center justify-around py-2 pb-4 safe-area-padding">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <div 
                  className={`flex flex-col items-center px-1 py-2 min-w-[50px] transition-colors duration-200 ${
                    isActive 
                      ? 'text-primary' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid={`nav-tab-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="h-4 w-4 mb-0.5" />
                  {isActive && (
                    <span className="text-[10px] font-medium text-center leading-tight whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for bottom navigation - not needed on home page */}
      {location !== '/' && <div className="h-20"></div>}
    </>
  );
}
