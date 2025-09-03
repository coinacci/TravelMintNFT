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
  // Suppress unhandled promise rejections from browser extensions
  if (typeof event.reason === 'string' && 
      (event.reason.includes('chrome-extension:') || 
       event.reason.includes('moz-extension:'))) {
    console.warn('🔌 Browser extension rejection (suppressed):', event.reason);
    event.preventDefault();
    return false;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
