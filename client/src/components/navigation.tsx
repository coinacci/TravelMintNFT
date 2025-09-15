import { Link, useLocation } from "wouter";
import { useAccount, useBalance } from "wagmi";
import { MapPin, Store, Camera, Wallet, Globe, Home, User, Menu, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { WalletConnect } from "@/components/wallet-connect";
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
  
  const { data: balance } = useBalance({
    address: address,
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    query: { 
      enabled: !!address && isConnected,
      retry: false,
      refetchOnWindowFocus: false
    }
  });

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/explore", label: "Explore", icon: Globe },
    { path: "/marketplace", label: "Marketplace", icon: Store },
    { path: "/my-nfts", label: "My NFTs", icon: User },
  ];

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
              
              <div className="flex items-center space-x-3">
                {isConnected && address && balance && (
                  <div className="flex items-center space-x-2 bg-muted px-2 py-1 rounded-lg">
                    <Wallet className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium" data-testid="wallet-balance-mobile">
                      {parseFloat(balance.formatted || "0").toFixed(0)} USDC
                    </span>
                  </div>
                )}
                <WalletConnect />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center space-x-1" data-testid="nav-menu-trigger-mobile">
                      <Menu className="h-4 w-4" />
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
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

          <div className="flex items-center space-x-3">
            {isConnected && address && balance && (
              <div className="hidden md:flex items-center space-x-2 bg-muted px-3 py-2 rounded-lg">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium" data-testid="wallet-balance">
                  {parseFloat(balance.formatted || "0").toFixed(2)} USDC
                </span>
              </div>
            )}
            <WalletConnect />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2" data-testid="nav-menu-trigger">
                  <Menu className="h-4 w-4" />
                  <span>Menu</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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
