import { Link, useLocation } from "wouter";
import { useAccount } from "wagmi";
import { Store, Globe, User, Trophy, Target, Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { WalletConnect } from "@/components/wallet-connect";
import { useFarcasterNotifications } from "@/hooks/use-farcaster-notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function Navigation() {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { address, isConnected } = useAccount();
  
  // Initialize automatic notification token collection
  const { 
    farcasterUser: notificationUser, 
    notificationToken, 
    notificationsEnabled,
    isCollectingToken 
  } = useFarcasterNotifications();

  // All navigation items - available to everyone
  const navItems = [
    { path: "/explore", label: "Explore", icon: Globe },
    { path: "/marketplace", label: "Market", icon: Store },
    { path: "/quests", label: "Quests", icon: Target },
    { path: "/leaderboard", label: "Board", icon: Trophy },
    { path: "/my-nfts", label: "Profile", icon: User },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="bg-black sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-end">
            <div className="flex items-center space-x-2">
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
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <div 
                  className={`flex flex-col items-center px-0.5 py-2 min-w-[42px] transition-colors duration-200 ${
                    isActive 
                      ? 'text-white' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  data-testid={`nav-tab-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="h-3.5 w-3.5 mb-0.5" />
                  {isActive && (
                    <span className="text-[9px] font-medium text-center leading-tight whitespace-nowrap">
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
      {location !== '/' && <div className="h-24"></div>}
    </>
  );
}
