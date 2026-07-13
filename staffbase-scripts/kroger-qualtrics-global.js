(function () {
  var SIE_URL = "https://zn2ukynhmxdi4ug6f-krogerxmit.siteintercept.qualtrics.com/SIE/?Q_ZID=ZN_2uKyNHmXdi4UG6f";
  var ROOT_ID = "qualtrics-intercept-root";
  var ZONE_ID = "ZN_2uKyNHmXdi4UG6f";

  function ensureRoot() {
    var el = document.getElementById(ROOT_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = ROOT_ID;
      el.style.display = "none";
      document.body.appendChild(el);
    }
    return el;
  }

  function ensureZoneDiv() {
    if (!document.getElementById(ZONE_ID)) {
      var div = document.createElement("div");
      div.id = ZONE_ID;
      document.body.appendChild(div);
    }
  }

  // Get user's Kroger Employee ID from Staffbase API
  function getUserId() {
    return fetch('/api/users/me', { credentials: 'include' })
      .then(function (res) {
        if (!res.ok) throw new Error('User fetch failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        // Primary: Kroger Employee ID
        // Fallbacks: email → Staffbase internal ID
        var extRef = data.externalID 
                  || (data.emails && data.emails[0] && data.emails[0].value)
                  || data.id 
                  || null;
        console.log('[Qualtrics] externalReference resolved:', extRef);
        return extRef;
      })
      .catch(function (err) {
        console.warn('[Qualtrics] Could not fetch user ID:', err);
        return null;
      });
  }

  function loadQualtrics(extRef) {
    ensureRoot();
    ensureZoneDiv();

    window.QSI = window.QSI || {};
    window.QSI.config = window.QSI.config || {};
    if (extRef) {
      window.QSI.config.externalReference = extRef;
    }

    // If already loaded, just re-run
    if (window.QSI && window.QSI.API && typeof window.QSI.API.run === "function") {
      try {
        window.QSI.API.unload && window.QSI.API.unload();
        window.QSI.API.load && window.QSI.API.load();
        window.QSI.API.run();
      } catch (e) { console.warn("[Qualtrics] QSI run failed:", e); }
      return;
    }

    // Otherwise load the SIE script
    if (!document.querySelector("script[src='" + SIE_URL + "']")) {
      var script = document.createElement("script");
      script.type = "text/javascript";
      script.src = SIE_URL;
      script.async = true;
      script.onload = function () {
        if (window.QSI && window.QSI.API) {
          try {
            window.QSI.API.load && window.QSI.API.load();
            window.QSI.API.run && window.QSI.API.run();
          } catch (e) { console.warn("[Qualtrics] QSI init failed:", e); }
        }
      };
      document.body.appendChild(script);
    }
  }

  // SPA navigation handling (Staffbase is a Single Page App)
  function hookSPANavigation() {
    var lastUrl = location.href;
    ['pushState', 'replaceState'].forEach(function (type) {
      var orig = history[type];
      history[type] = function () {
        var result = orig.apply(this, arguments);
        window.dispatchEvent(new Event('qsi:locationchange'));
        return result;
      };
    });
    window.addEventListener('popstate', function () {
      window.dispatchEvent(new Event('qsi:locationchange'));
    });
    window.addEventListener('qsi:locationchange', function () {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (window.QSI && window.QSI.API && typeof window.QSI.API.run === "function") {
          try { window.QSI.API.run(); } catch (e) {}
        }
      }
    });
  }

  function init() {
    getUserId().then(function (extRef) {
      loadQualtrics(extRef);
      hookSPANavigation();
    });
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init, false);
  }
})();