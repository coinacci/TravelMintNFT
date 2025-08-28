import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Store, Camera, Wallet, Globe, Home, User } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { WalletConnect } from "@/components/wallet-connect";

interface User {
  id: string;
  username: string;
  balance: string;
  avatar?: string;
}

export default function Navigation() {
  const [location] = useLocation();
  const isMobile = useIsMobile();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/users"],
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
                {user && (
                  <div className="flex items-center space-x-2 bg-muted px-2 py-1 rounded-lg">
                    <Wallet className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium" data-testid="user-balance-mobile">
                      {parseFloat(user.balance).toFixed(0)}
                    </span>
                  </div>
                )}
                <WalletConnect />
                {user?.avatar && (
                  <img
                    src={user.avatar}
                    alt="User profile"
                    className="w-8 h-8 rounded-full border-2 border-primary cursor-pointer"
                    data-testid="user-avatar-mobile"
                  />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
          <div className="grid grid-cols-4 h-16">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
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

          <nav className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center space-x-2 transition-colors ${
                    isActive ? "text-primary" : "text-foreground hover:text-primary"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center space-x-3">
            {user && (
              <div className="hidden md:flex items-center space-x-2 bg-muted px-3 py-2 rounded-lg">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium" data-testid="user-balance">
                  {parseFloat(user.balance).toFixed(2)} USDC
                </span>
              </div>
            )}
            <WalletConnect />
            {user?.avatar && (
              <img
                src={user.avatar}
                alt="User profile"
                className="w-10 h-10 rounded-full border-2 border-primary cursor-pointer"
                data-testid="user-avatar"
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
