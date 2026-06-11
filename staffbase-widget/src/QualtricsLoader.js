const ZONE_URL = 'https://zn2ukynhmxdi4ug6f-krogerxmit.siteintercept.qualtrics.com/SIE/?Q_ZID=ZN_2uKyNHmXdi4UG6f';
const ROOT_ID = 'qualtrics-intercept-root';
const ZONE_DIV_ID = 'ZN_2uKyNHmXdi4UG6f';
const TEST_COOKIE = 'QSI_TestPopUp';
let isLoaded = false;

function setTestCookie() {
  document.cookie = `${TEST_COOKIE}=true; path=/; max-age=86400; SameSite=Lax`;
}

function getTestCookie() {
  return document.cookie.split(';').some(c => c.trim() === `${TEST_COOKIE}=true`);
}

export function ensureInterceptRoot() {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;

  root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.display = 'none';
  document.body.appendChild(root);
  return root;
}

function addZoneDiv(targetSelector) {
  let existing = document.getElementById(ZONE_DIV_ID);
  if (existing) return existing;

  const div = document.createElement('div');
  div.id = ZONE_DIV_ID;
  div.innerHTML = '<!--DO NOT REMOVE-CONTENTS PLACED HERE-->';

  if (targetSelector) {
    try {
      const el = document.querySelector(targetSelector);
      if (el) { el.appendChild(div); return div; }
    } catch (e) {
      console.warn('Invalid selector for embedded intercept:', targetSelector, e);
    }
  }

  const root = document.getElementById(ROOT_ID) || ensureInterceptRoot();
  root.appendChild(div);
  return div;
}

export function loadQualtrics(userId) {
  if (isLoaded) return;

  setTestCookie();

  if (!getTestCookie()) return;

  const testUrl = new URL(window.location.href);
  if (!testUrl.searchParams.has('QualtricsTest_PopUp')) {
    testUrl.searchParams.set('QualtricsTest_PopUp', '1');
    history.replaceState(null, '', testUrl.toString());
  }

  const params = new URLSearchParams(window.location.search);
  const isEmbedded = params.has('QualtricsTest_Embedded');
  const embeddedSelector = params.get('qualtricsSelector') || null;

  ensureInterceptRoot();
  addZoneDiv(isEmbedded ? embeddedSelector : null);

  window.QSI = window.QSI || {};
  window.QSI.config = Object.assign(window.QSI.config || {}, {
    externalReference: userId,
  });

  const existingScript = document.querySelector(`script[src='${ZONE_URL}']`);
  if (existingScript) {
    isLoaded = true;
    if (window.QSI && window.QSI.API && typeof window.QSI.API.run === 'function') {
      try { window.QSI.API.run(); } catch (e) { console.warn('QSI.API.run failed', e); }
    }
    return;
  }

  const script = document.createElement('script');
  script.src = ZONE_URL;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.onload = () => {
    console.log('Qualtrics intercept script loaded.');
    if (window.QSI && window.QSI.API) {
      if (typeof window.QSI.API.load === 'function') window.QSI.API.load();
      if (typeof window.QSI.API.run  === 'function') window.QSI.API.run();
    }
  };
  script.onerror = (e) => { console.error('Qualtrics intercept script failed to load.', e); };
  document.body.appendChild(script);
  isLoaded = true;
}

export function resetLoader() {
  isLoaded = false;
}
