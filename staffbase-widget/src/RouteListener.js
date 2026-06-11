export function refreshQualtrics() {
  if (window.QSI && window.QSI.API) {
    try {
      window.QSI.API.unload();
      window.QSI.API.load();
      window.QSI.API.run();
    } catch (e) {
      console.error('Qualtrics refresh failed', e);
    }
  }
}
