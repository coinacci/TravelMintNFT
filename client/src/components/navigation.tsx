import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAccount } from "wagmi";
import { Store, Globe, User, Trophy, Target, Menu, LogOut, TrendingUp, Award } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { WalletConnect } from "@/components/wallet-connect";
import { useFarcasterNotifications } from "@/hooks/use-farcaster-notifications";
import { useFarcasterAuth } from "@/hooks/use-farcaster-auth";
import { SignInButton, useSignIn } from "@farcaster/auth-kit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export default function Navigation() {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { address, isConnected } = useAccount();
  const [questsMenuOpen, setQuestsMenuOpen] = useState(false);
  
  // Initialize automatic notification token collection
  const { 
    farcasterUser: notificationUser, 
    notificationToken, 
    notificationsEnabled,
    isCollectingToken 
  } = useFarcasterNotifications();
  
  // Unified Farcaster auth (works for both Frame SDK and AuthKit)
  const { isAuthenticated, user, isFrameSDK, isAuthKit } = useFarcasterAuth();
  
  // AuthKit sign in/out
  const { signOut } = useSignIn();

  // Navigation items - Quests has submenu, Badges is separate
  const navItems = [
    { path: "/explore", label: "Explore", icon: Globe },
    { path: "/marketplace", label: "Marketplace", icon: Store },
    { path: "/quests", label: "Quests", icon: Target, hasSubmenu: true },
    { path: "/badges", label: "Badges", icon: Award },
    { path: "/my-nfts", label: "Profile", icon: User },
  ];
  
  // Quests submenu items
  const questsSubItems = [
    { path: "/quests", label: "Progress", icon: TrendingUp },
    { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="bg-black sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-end">
            <div className="flex items-center space-x-2">
              {/* Show Sign in With Farcaster only for browser users (not in Mini App) */}
              {!isFrameSDK && !isAuthenticated && (
                <SignInButton
                  onSuccess={({ fid, username }) => {
                    console.log(`✅ Signed in with Farcaster: @${username} (FID: ${fid})`);
                  }}
                />
              )}
              
              {/* Show user info and sign-out if authenticated via AuthKit */}
              {!isFrameSDK && isAuthenticated && user && isAuthKit && (
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2 text-white text-sm">
                    {user.pfpUrl && (
                      <img 
                        src={user.pfpUrl} 
                        alt={user.username}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <span>@{user.username}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      signOut();
                      console.log('👋 Signed out from Farcaster');
                    }}
                    className="text-white hover:bg-gray-800"
                    data-testid="button-signout"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {/* Notification indicator removed - notifications work via FID-based system */}
              <WalletConnect farcasterUser={notificationUser} />
              
              {/* Hamburger Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-white hover:bg-gray-800"
                    data-testid="menu-button"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/faq" className="cursor-pointer w-full">
                      FAQ
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/about" className="cursor-pointer w-full">
                      About
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/contact" className="cursor-pointer w-full">
                      Contact
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Bottom Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-white">
        <div className="flex items-center justify-around py-3 pb-8 safe-area-padding">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || (item.hasSubmenu && location === '/leaderboard');
            
            // Special rendering for Quests with submenu
            if (item.hasSubmenu) {
              return (
                <Popover key={item.path} open={questsMenuOpen} onOpenChange={setQuestsMenuOpen}>
                  <PopoverTrigger asChild>
                    <div 
                      className="flex flex-col items-center px-0.5 py-2 min-w-[42px] transition-colors duration-200 cursor-pointer"
                      data-testid={`nav-tab-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Icon className={`h-3.5 w-3.5 mb-0.5 ${
                        isActive ? 'text-white' : 'text-gray-400'
                      }`} />
                      <span className={`text-[9px] text-center leading-tight whitespace-nowrap ${
                        isActive 
                          ? 'font-semibold text-white' 
                          : 'font-normal text-gray-300'
                      }`}>
                        {item.label}
                      </span>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    side="top" 
                    align="center"
                    className="w-40 p-2 bg-gray-900 border-gray-700"
                    sideOffset={8}
                  >
                    <div className="flex flex-col space-y-1">
                      {questsSubItems.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = location === subItem.path;
                        return (
                          <button
                            key={subItem.path}
                            onClick={() => {
                              setLocation(subItem.path);
                              setQuestsMenuOpen(false);
                            }}
                            className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                              isSubActive 
                                ? 'bg-primary text-white' 
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                            }`}
                            data-testid={`nav-submenu-${subItem.label.toLowerCase()}`}
                          >
                            <SubIcon className="h-4 w-4" />
                            <span className="text-sm font-medium">{subItem.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }
            
            // Regular navigation items
            return (
              <Link key={item.path} href={item.path}>
                <div 
                  className="flex flex-col items-center px-0.5 py-2 min-w-[42px] transition-colors duration-200"
                  data-testid={`nav-tab-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className={`h-3.5 w-3.5 mb-0.5 ${
                    isActive ? 'text-white' : 'text-gray-400'
                  }`} />
                  <span className={`text-[9px] text-center leading-tight whitespace-nowrap ${
                    isActive 
                      ? 'font-semibold text-white' 
                      : 'font-normal text-gray-300'
                  }`}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for bottom navigation - not needed on home/explore pages */}
      {location !== '/' && location !== '/explore' && <div className="h-24"></div>}
    </>
  );
}
