import { Link, useLocation } from "wouter";
import { useAccount } from "wagmi";
import { MapPin, Store, Camera, Globe, Home, User, Menu, ChevronDown, Trophy, Target } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { WalletConnect } from "@/components/wallet-connect";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
    { path: "/marketplace", label: "Marketplace", icon: Store },
    { path: "/my-nfts", label: "My NFTs", icon: User },
  ];
  
  // Quest items - only show for Farcaster users
  const questNavItems = farcasterUser ? [
    { path: "/quests", label: "Quests", icon: Target },
    { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ] : [];
  
  // Combine navigation items
  const navItems = [...baseNavItems, ...questNavItems];

  if (isMobile) {
    return (
      <>
        {/* Mobile Header */}
        <header className="bg-card border-b border-border sticky top-0 z-50">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-xl font-bold travel-gradient bg-clip-text text-transparent">
                  <MapPin className="inline-block w-5 h-5 mr-2" />
                  TravelMint
                </div>
              </div>
              
              <div className="flex items-center space-x-1">
                <WalletConnect />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center space-x-1" data-testid="nav-menu-trigger-mobile">
                      <Menu className="h-4 w-4" />
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.path;
                      return (
                        <DropdownMenuItem key={item.path} asChild>
                          <Link
                            href={item.path}
                            className={`flex items-center space-x-2 w-full ${
                              isActive ? "text-primary font-medium" : "text-foreground"
                            }`}
                            data-testid={`nav-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile bottom navigation removed - now using header dropdown */}
      </>
    );
  }

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-2xl font-bold travel-gradient bg-clip-text text-transparent">
              <MapPin className="inline-block w-6 h-6 mr-2" />
              TravelMint
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <WalletConnect />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2" data-testid="nav-menu-trigger">
                  <Menu className="h-4 w-4" />
                  <span>Menu</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link
                        href={item.path}
                        className={`flex items-center space-x-2 w-full ${
                          isActive ? "text-primary font-medium" : "text-foreground"
                        }`}
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
