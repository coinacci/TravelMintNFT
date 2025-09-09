import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Minimal error handling for stability
window.addEventListener('error', (event) => {
  const msg = event.error?.message || '';
  
  // Suppress browser extension errors
  if (msg.includes('chrome-extension:') || msg.includes('moz-extension:')) {
    console.warn('🔌 Browser extension error (suppressed):', msg);
    event.preventDefault();
    return false;
  }
  
  // Log actual app errors
  console.error('🚨 App error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  
  // Suppress extension errors
  if (typeof reason === 'string' && 
      (reason.includes('chrome-extension:') || reason.includes('moz-extension:'))) {
    console.warn('🔌 Extension rejection (suppressed):', reason);
    event.preventDefault();
    return false;
  }
  
  // Suppress wallet errors that crash Farcaster
  if (reason?.message?.includes('not been authorized') ||
      reason?.message?.includes('unauthorized') ||
      reason?.code === -32603 ||
      reason?.code === -32002) {
    console.warn('🔑 Wallet error (handled):', reason?.message || reason);
    event.preventDefault();
    return false;
  }
  
  console.error('🚨 Unhandled rejection:', reason);
});

// Mount app
createRoot(document.getElementById("root")!).render(<App />);