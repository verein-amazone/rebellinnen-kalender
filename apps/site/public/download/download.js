// Sends a phone straight to its store. `/download` is the target of the printed QR codes, so it
// has to work as a plain page too: without this script, on a computer, or before a store listing
// is public, the page simply shows the store buttons it has.
//
// The store addresses come from `apps/site/site.config.json` via the `data-*` attributes on <html>; an
// empty one means "not public yet" and never redirects. Nothing is stored or sent anywhere - the
// device type is only read here, in the browser.
(function () {
  var root = document.documentElement;
  var userAgent = navigator.userAgent;
  // iPadOS reports itself as a Mac; a Mac with a touch screen is an iPad.
  var isApple =
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(userAgent);
  var target = isApple
    ? root.getAttribute('data-app-store')
    : isAndroid
      ? root.getAttribute('data-play-store')
      : '';

  if (!target) {
    return;
  }

  var status = document.getElementById('download-status');
  if (status) {
    status.textContent = isApple ? 'Weiter zum App Store …' : 'Weiter zu Google Play …';
  }
  // `replace`, so the back button returns to wherever the visitor came from, not to this page.
  window.location.replace(target);
})();
