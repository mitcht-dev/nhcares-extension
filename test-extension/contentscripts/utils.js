// Shared Utilities Module
// Common functions used across multiple scripts

// Function to detect if we're on AlayaCare (excluding connector subdomain)
function isAlayaCarePage() {
  const hostname = window.location.hostname;

  // Exclude connector subdomain
  if (hostname.includes('connector.alayacare.com') || hostname.includes('connector.alayacare.ca')) {
    return false;
  }

  // Check for AlayaCare domains
  return hostname.includes('alayacare.com') ||
         hostname.includes('alayacare.ca') ||
         hostname.includes('localhost');
}

// Helper function to run callback when DOM is ready
function onDomReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

// Helper function to setup SPA navigation listeners
// Calls callback when URL changes (hashchange, popstate)
function onUrlChange(callback) {
  window.addEventListener('hashchange', function() {
    setTimeout(callback, 100);
  });

  window.addEventListener('popstate', function() {
    setTimeout(callback, 100);
  });
}

// Export to window for use in other scripts
window.vibeUtils = {
  isAlayaCarePage: isAlayaCarePage,
  onDomReady: onDomReady,
  onUrlChange: onUrlChange
};
