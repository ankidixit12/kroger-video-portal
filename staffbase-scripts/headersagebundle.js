(function () {
  'use strict';

  // ============ CONFIGURATION ============
  var CONFIG = {
    buttonText: 'Ask Sage',
    redirectUrl: 'https://auth.pingone.com/6c0241eb-6d4c-4b98-bdfb-5ab44b0d7112/as/authorize?response_type=code&client_id=4f387fcc-7296-4307-9576-024545986701&redirect_uri=https%3A%2F%2Fsage-frontend-uat.kroger-nonprod-cluster-f40f61a16d8a9e75eea30e463991caf4-0000.us-south.containers.appdomain.cloud%2Foauth%2Fping%2Fcallback&code_challenge=fbRx16h0GaEvDU-tHAnOq22GoaxW4NjWH4EM8O4uJdo&code_challenge_method=S256&state=64SCO5NbF58Vw65FiXSSVQfe_2gnAAOd4xL42fS3CoU&scope=openid+HRDA%3AProfile+HRDA%3AProfile%3ADev17+HRDA%3AProfile%3ADev29%22',
    tooltipText: 'How can I help today?',
    iconUrl: 'https://krogerstoragesage.z20.web.core.windows.net/SageLogo.png',
    iconWidth: 22.052,
    iconHeight: 22.052
  };

  var QUICKLINKS_SELECTOR = '[class*="StyledDesktopQuicklinks"]';
  var BUTTON_ID = 'ask-sage-button';
  var WRAPPER_ID = 'ask-sage-wrapper';
  // =======================================

  // ============================================================
  // Build the button + wrapper (returns the wrapper element)
  // ============================================================
  function buildButton() {
    var button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.setAttribute('aria-label', CONFIG.buttonText);
    button.style.cssText = [
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'gap: 6px',
      'border: none',
      'border-radius: 32px',
      'background: #71984A',
      'width: 121px',
      'height: 32px',
      'cursor: pointer',
      'padding: 0'
    ].join(';');

    var iconImg = document.createElement('img');
    iconImg.src = CONFIG.iconUrl;
    iconImg.alt = '';
    iconImg.setAttribute('aria-hidden', 'true');
    iconImg.style.cssText = [
      'width: ' + CONFIG.iconWidth + 'px',
      'height: ' + CONFIG.iconHeight + 'px',
      'object-fit: contain',
      'display: block'
    ].join(';');

    var textSpan = document.createElement('span');
    textSpan.textContent = CONFIG.buttonText;
    textSpan.style.cssText = [
      'color: #FFF',
      'font-family: Roboto, sans-serif',
      'font-size: 16px',
      'font-style: normal',
      'font-weight: 600',
      'line-height: 20px',
      'white-space: nowrap'
    ].join(';');

    button.appendChild(iconImg);
    button.appendChild(textSpan);

    button.addEventListener('click', function (e) {
      e.preventDefault();
      if (CONFIG.redirectUrl) window.location.href = CONFIG.redirectUrl;
    });

    // Wrapper for tooltip positioning
    var wrapper = document.createElement('div');
    wrapper.id = WRAPPER_ID;
    wrapper.style.cssText = 'position: relative; display: inline-block;';
    wrapper.appendChild(button);

    // Tooltip
    var tooltip = document.createElement('div');
    tooltip.className = 'sage-tooltip';
    tooltip.textContent = CONFIG.tooltipText;
    tooltip.style.cssText = [
      'position: absolute',
      'top: 100%',
      'left: 50%',
      'transform: translateX(-50%)',
      'margin-top: 8px',
      'background: #333',
      'color: #fff',
      'padding: 8px 12px',
      'border-radius: 6px',
      'font-family: Roboto, Arial, sans-serif',
      'font-size: 13px',
      'line-height: 1.4',
      'white-space: nowrap',
      'box-shadow: 0 2px 8px rgba(0,0,0,0.3)',
      'opacity: 0',
      'visibility: hidden',
      'transition: opacity 0.25s ease, visibility 0.25s ease',
      'z-index: 2147483647',
      'pointer-events: none'
    ].join(';');
    wrapper.appendChild(tooltip);

    wrapper.addEventListener('mouseenter', function () {
      tooltip.style.opacity = '1';
      tooltip.style.visibility = 'visible';
    });
    wrapper.addEventListener('mouseleave', function () {
      tooltip.style.opacity = '0';
      tooltip.style.visibility = 'hidden';
    });

    return wrapper;
  }

  // ============================================================
  // Apply styles to existing elements
  // ============================================================
  function applyStyles() {
    document.querySelectorAll(QUICKLINKS_SELECTOR).forEach(function (el) {
      el.style.width = '130px';
    });
    document.querySelectorAll(QUICKLINKS_SELECTOR + ' > a').forEach(function (a) {
      a.style.maxHeight = '40px';
      a.style.maxWidth = '142px';
      a.style.marginBottom = '15px';
    });
    document.querySelectorAll('[class*="StyledIconLogo"] img').forEach(function (img) {
      img.style.width = '123px';
      img.style.height = '35px';
    });
  }

  // ============================================================
  // The reliable "ensure" function — runs on every DOM change
  // ============================================================
  function ensureButton() {
    var container = document.querySelector(QUICKLINKS_SELECTOR);
    if (!container) return;  // not rendered yet — wait for next mutation

    // Re-inject only if the button is missing (handles re-renders)
    if (!container.querySelector('#' + WRAPPER_ID)) {
      container.appendChild(buildButton());
      console.log('[Sage Script] Ask Sage button injected.');
    }

    applyStyles();
  }

  // ============================================================
  // Persistent observer — NEVER disconnects
  // ============================================================
  function startObserver() {
    // Run once immediately
    ensureButton();

    // Debounce to avoid running on every tiny mutation
    var scheduled = false;
    var observer = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        ensureButton();
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // ---- Kick off ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();