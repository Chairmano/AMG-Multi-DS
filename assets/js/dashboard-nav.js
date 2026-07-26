(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.AMGDashboardNav = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const routes = {
    dashboard: 'dashboard.html',
    services: 'services.html',
    wallet: 'wallet.html',
    transactions: 'transactions.html',
    profile: 'profile.html',
    notifications: 'notifications.html',
    support: 'support.html'
  };

  const serviceRoutes = {
    'Buy Data': 'data.html',
    'Buy Airtime': 'airtime.html',
    Electricity: 'electricity.html',
    'Exam Results': 'results.html',
    'TV Subscription': 'airtime.html',
    Internet: 'data.html',
    Water: 'airtime.html'
  };

  function getRoute(page) {
    return routes[page] || 'dashboard.html';
  }

  function getServiceRoute(serviceName) {
    return serviceRoutes[serviceName] || 'services.html';
  }

  return {
    getRoute,
    getServiceRoute
  };
});
