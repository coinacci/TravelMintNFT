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
  const [isAppReady, setIsAppReady] = useState(false);
  const [context, setContext] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    
    console.log('🚀 TravelMint App starting...');
    
    // IMMEDIATELY signal Farcaster that app is ready - this prevents white screen
    if (typeof window !== 'undefined' && sdk?.actions?.ready) {
      console.log('⚡ Signaling Farcaster ready IMMEDIATELY...');
      
      // Call ready() synchronously first
      try {
        sdk.actions.ready();
        console.log('✅ Synchronous ready() called');
      } catch (e) {
        console.log('❌ Sync ready() failed:', e);
      }
      
      // Also call as Promise to ensure it's received
      Promise.resolve().then(() => {
        try {
          sdk.actions.ready();
          console.log('✅ Promise ready() called');
        } catch (e) {
          console.log('❌ Promise ready() failed:', e);
        }
      });
    }
    
    // Set app ready immediately
    setIsAppReady(true);
    
    // Get Farcaster context in background (optional)
    if (typeof window !== 'undefined' && sdk?.context) {
      sdk.context.then((appContext: any) => {
        if (mounted) {
          setContext(appContext);
          console.log('✅ Farcaster context received:', appContext?.user?.displayName || 'User');
        }
      }).catch((error: any) => {
        console.log('⚠️ Context not available (normal in web browser)');
      });
    }
    
    // Cleanup
    return () => {
      mounted = false;
    };
  }, []);

  // Show loading screen until app is ready
  if (!isAppReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary animate-spin rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading TravelMint...</p>
        </div>
      </div>
    );
  }

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
