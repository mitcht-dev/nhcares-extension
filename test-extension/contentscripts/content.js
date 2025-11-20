// Content script for Dayalabs Alayacare Utilities
// This script runs on pages matching the patterns in manifest.json
// With world: MAIN, this runs directly in the page context

// Initialize when page loads
function initialize() {
  if (window.vibeUtils && window.vibeUtils.isAlayaCarePage()) {
    // Check and apply scheduled visits columns
    if (window.scheduledVisits) {
      window.scheduledVisits.checkAndApply();
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Watch for URL changes (for single-page applications)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;

    if (window.vibeUtils && window.scheduledVisits) {
      window.scheduledVisits.checkAndApply();
    }
  }
});

// Start observing when body is available
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
} else {
  document.addEventListener('DOMContentLoaded', function () {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// Listen for hash changes (common in SPAs)
window.addEventListener('hashchange', function () {
  if (window.vibeUtils && window.scheduledVisits) {
    window.scheduledVisits.checkAndApply();
  }
});

// Also check periodically (backup mechanism)
setInterval(function () {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;

    if (window.vibeUtils && window.scheduledVisits) {
      window.scheduledVisits.checkAndApply();
    }
  }
}, 1000);
