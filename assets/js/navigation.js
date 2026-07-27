(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.AMGNavigation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const routes = {
    data: 'pages/data.html',
    airtime: 'pages/airtime.html',
    electricity: 'pages/electricity.html',
    results: 'pages/results.html',
    dashboard: 'pages/dashboard.html'
  };

  function getPurchaseRoute(service) {
    if (!service) return null;

    const normalized = String(service).trim().toLowerCase();
    return routes[normalized] || null;
  }

  return {
    getPurchaseRoute
  };
});
