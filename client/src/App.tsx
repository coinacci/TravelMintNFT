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
    // CRITICAL: Set app ready immediately, handle Farcaster in background
    setIsAppReady(true);
    
    // Initialize Farcaster SDK in background without blocking UI
    const initFarcaster = async () => {
      try {
        console.log('🚀 Initializing Farcaster SDK...');
        
        // Check if we're in Farcaster environment
        const isInFarcaster = typeof window !== 'undefined' && 
                              sdk && 
                              sdk.actions && 
                              typeof sdk.actions.ready === 'function';
        
        if (isInFarcaster) {
          // Get context in background
          console.log('🔄 Getting Farcaster context...');
          try {
            const contextPromise = sdk.context;
            const contextTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Context timeout')), 2000)
            );
            
            const appContext = await Promise.race([contextPromise, contextTimeout]);
            setContext(appContext);
            console.log('✅ Farcaster context received:', (appContext as any)?.user?.displayName || 'Unknown');
          } catch (contextError: any) {
            console.log('⚠️ Context timeout/error (normal in web browser):', contextError?.message || contextError);
          }
          
          // Signal ready in background with aggressive timeout
          console.log('⚡ Calling sdk.actions.ready() in background...');
          try {
            const readyPromise = sdk.actions.ready();
            const readyTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Ready timeout')), 1000)
            );
            
            await Promise.race([readyPromise, readyTimeout]);
            console.log('✅ Farcaster SDK ready - background initialization complete');
          } catch (readyError: any) {
            console.log('❌ ready() timeout/failed (normal in web browser):', readyError?.message || readyError);
            console.log('✅ Farcaster SDK continuing without ready signal');
          }
        } else {
          console.log('🌐 Running in browser mode (Farcaster SDK not available)');
        }
      } catch (error) {
        console.log('❌ Farcaster SDK error, continuing as web app:', error);
      }
    };

    // Start Farcaster init in background - don't block UI
    setTimeout(() => initFarcaster(), 100);
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
