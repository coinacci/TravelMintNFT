import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/contexts/wallet-provider";
import { useEffect, useState, Component, ReactNode } from "react";
import sdk from "@farcaster/frame-sdk";
import Landing from "@/pages/landing";
import Explore from "@/pages/explore";
import Marketplace from "@/pages/marketplace";
import MyNFTs from "@/pages/my-nfts";
import Mint from "@/pages/mint";
import Navigation from "@/components/navigation";

// Browser-safe Farcaster SDK initialization
let farcasterReady = false;
if (typeof window !== 'undefined' && sdk?.actions?.ready) {
  console.log('🚀 Initializing Farcaster SDK...');
  try {
    // Call ready() without await to prevent blocking
    sdk.actions.ready();
    farcasterReady = true;
    console.log('✅ Farcaster ready signal sent');
  } catch (e) {
    console.log('⚠️ Farcaster not available (running in web browser)');
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<{children: ReactNode}, ErrorBoundaryState> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">Please refresh the page to continue</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router() {
  return (
    <>
      <Navigation />
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/explore" component={Explore} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/my-nfts" component={MyNFTs} />
        <Route path="/mint" component={Mint} />
        <Route>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
              <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
            </div>
          </div>
        </Route>
      </Switch>
    </>
  );
}

function App() {
  const [context, setContext] = useState<any>(null);

  useEffect(() => {
    console.log('🎯 TravelMint App starting...');
    
    // Get Farcaster context if available (optional, non-blocking)
    if (typeof window !== 'undefined' && sdk?.context) {
      Promise.resolve(sdk.context)
        .then((appContext: any) => {
          setContext(appContext);
          console.log('✅ Farcaster context loaded:', appContext?.user?.displayName || 'User');
        })
        .catch((error) => {
          // Handle promise rejection properly to prevent unhandled rejection
          console.log('ℹ️ Running in web browser mode (Farcaster context not available)');
          console.log('📋 Error details:', error?.message || 'No details available');
        });
    } else {
      console.log('🌐 No Farcaster SDK available - running in standard web browser');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <ErrorBoundary>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ErrorBoundary>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
