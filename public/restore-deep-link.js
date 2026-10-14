// Restores a deep link that GitHub Pages could not serve. Pages has no rewrite rule, so reloading
// `…/settings/theme` returns its 404 page, and `404.html` sends the request back to `index.html`
// with the route as a query (`/?/settings/theme`). This puts it back in the address bar before the
// Angular bundle - a deferred module script - runs and reads the location.
//
// A file rather than an inline script, so the Content-Security-Policy in `index.html` needs no
// exception for it. Inert everywhere else: without that query shape it does nothing at all.
(function () {
  if (window.location.search.charAt(1) !== '/') {
    return;
  }

  var parts = window.location.search.slice(2).split('&');
  var route = parts.shift();
  var query = parts.join('&');

  window.history.replaceState(
    null,
    '',
    window.location.pathname + route + (query ? '?' + query : '') + window.location.hash,
  );
})();
