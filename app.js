// She application bootstrap.
// Keep the proven legacy runtime first; the shared feature layer is loaded after
// Firebase/auth compatibility has been established so it cannot block startup.
import "./legacy-app.js";
import "./app-fixes.js";
import "./core/service-registry.js";
import "./feature-bootstrap.js";
