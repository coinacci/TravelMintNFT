import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Set up global error handling for browser extension compatibility
window.addEventListener('error', (event) => {
  // Suppress browser extension errors that don't affect our app
  if (event.error?.message?.includes('chrome-extension:') || 
      event.error?.message?.includes('moz-extension:')) {
    console.warn('🔌 Browser extension error (suppressed):', event.error.message);
    event.preventDefault();
    return false;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  
  // Suppress browser extension errors
  if (typeof reason === 'string' && 
      (reason.includes('chrome-extension:') || 
       reason.includes('moz-extension:'))) {
    console.warn('🔌 Browser extension rejection (suppressed):', reason);
    event.preventDefault();
    return false;
  }
  
  // CRITICAL: Prevent wallet authorization crashes that break Farcaster iframe
  if (reason?.message?.includes('not been authorized yet') ||
      reason?.message?.includes('replit.dev') ||
      reason?.message?.includes('unauthorized') ||
      reason?.code === -32603 ||
      reason?.code === -32002 ||
      reason?.errorClass === 'Transaction') {
    console.warn('🔑 Wallet authorization error (app crash prevented):', reason.message || reason);
    event.preventDefault(); // PREVENT APP CRASH
    return false;
  }
  
  // Handle other wallet-related errors
  if (typeof reason === 'string' && 
      (reason.includes('wallet') || reason.includes('connector'))) {
    console.warn('🔌 Wallet connector error (handled):', reason);
    event.preventDefault();
    return false;
  }
  
  // Log remaining errors for debugging
  console.error('🚨 Unhandled promise rejection:', reason);
});

createRoot(document.getElementById("root")!).render(<App />);
