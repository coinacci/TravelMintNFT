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
    // Initialize Farcaster SDK properly - AFTER app is fully loaded
    const initFarcaster = async () => {
      try {
        console.log('🚀 Initializing Farcaster SDK...');
        
        // Check if we're in Farcaster environment
        const isInFarcaster = typeof window !== 'undefined' && 
                              sdk && 
                              sdk.actions && 
                              typeof sdk.actions.ready === 'function';
        
        if (isInFarcaster) {
          try {
            // CRITICAL: Get context with timeout for web browsers
            console.log('🔄 Getting Farcaster context...');
            
            const contextPromise = sdk.context;
            const contextTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Context timeout')), 2000)
            );
            
            try {
              const appContext = await Promise.race([contextPromise, contextTimeout]);
              setContext(appContext);
              console.log('✅ Farcaster context received:', (appContext as any)?.user?.displayName || 'Unknown');
              console.log('📱 Full context object:', appContext);
            } catch (contextError: any) {
              console.log('⚠️ Context timeout/error (normal in web browser):', contextError?.message || contextError);
            }
            
            // Always signal ready regardless of context success
            await sdk.actions.ready();
            console.log('✅ Farcaster SDK ready - app fully initialized and visible');
            setIsAppReady(true);
          } catch (error) {
            console.log('⚠️ Farcaster SDK initialization failed:', error);
            // Final fallback - signal ready anyway to prevent infinite loading
            try {
              sdk.actions.ready(); // Sync call as last resort
              console.log('✅ Farcaster SDK ready (sync fallback)');
              setIsAppReady(true);
            } catch (readyError) {
              console.log('❌ Farcaster SDK ready() completely failed:', readyError);
              setIsAppReady(true); // Continue as web app
            }
          }
        } else {
          console.log('🌐 Running in browser mode (Farcaster SDK not available)');
          setIsAppReady(true);
        }
      } catch (error) {
        console.log('❌ Farcaster SDK error, continuing as web app:', error);
        setIsAppReady(true);
      }
    };

    // CRITICAL: Wait for initial render to complete before signaling ready
    const timer = setTimeout(initFarcaster, 500);
    return () => clearTimeout(timer);
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
