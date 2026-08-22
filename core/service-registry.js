/* She service registry.
 * Architecture-only registry: it never initializes Firebase and never changes
 * existing feature behavior. Feature modules can register here as they migrate.
 */
(function () {
  'use strict';

  const services = Object.create(null);

  function register(name, api) {
    if (!name || !api) throw new Error('Service name and API are required');
    services[name] = api;
    return api;
  }

  function get(name) {
    return services[name] || null;
  }

  window.SheServices = Object.freeze({ register, get });
})();
