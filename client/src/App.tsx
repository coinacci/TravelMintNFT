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

// CRITICAL: Call ready() IMMEDIATELY when module loads - before any components
console.log('🔥 EMERGENCY: Calling ready() at module level...');
if (typeof window !== 'undefined' && sdk?.actions?.ready) {
  try {
    sdk.actions.ready();
    console.log('🚨 MODULE LEVEL ready() called successfully');
  } catch (e) {
    console.log('❌ Module level ready() failed:', e);
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

  // Call ready() in constructor/render phase - even earlier than useEffect
  console.log('⚡ App component render - calling ready() again...');
  if (typeof window !== 'undefined' && sdk?.actions?.ready) {
    try {
      sdk.actions.ready();
      console.log('✅ Render phase ready() called');
    } catch (e) {
      console.log('❌ Render ready() failed:', e);
    }
  }

  useEffect(() => {
    console.log('🚀 App useEffect running...');
    
    // Multiple ready() attempts with different timing
    const multipleReadyCalls = () => {
      if (typeof window !== 'undefined' && sdk?.actions?.ready) {
        console.log('🔄 Multiple ready() attempts starting...');
        
        // Immediate
        try { sdk.actions.ready(); console.log('✅ Immediate ready()'); } catch (e) { console.log('❌ Immediate failed'); }
        
        // 10ms delay
        setTimeout(() => {
          try { sdk.actions.ready(); console.log('✅ 10ms delayed ready()'); } catch (e) { console.log('❌ 10ms failed'); }
        }, 10);
        
        // 50ms delay
        setTimeout(() => {
          try { sdk.actions.ready(); console.log('✅ 50ms delayed ready()'); } catch (e) { console.log('❌ 50ms failed'); }
        }, 50);
        
        // 100ms delay
        setTimeout(() => {
          try { sdk.actions.ready(); console.log('✅ 100ms delayed ready()'); } catch (e) { console.log('❌ 100ms failed'); }
        }, 100);
      }
    };
    
    multipleReadyCalls();
    
    // Get context
    if (typeof window !== 'undefined' && sdk?.context) {
      sdk.context.then((appContext: any) => {
        setContext(appContext);
        console.log('✅ Context received:', appContext?.user?.displayName || 'User');
      }).catch(() => {
        console.log('⚠️ Context not available');
      });
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
