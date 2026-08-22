// She application bootstrap.
// The safety/fix layer is registered first so account switching can clear a
// restored Firebase session before the legacy runtime redirects from login.
import "./app-fixes.js";
import "./legacy-app.js";
