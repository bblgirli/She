// She application bootstrap: one runtime coordinator, then compatibility layers.
import "./core/app-runtime.js";
import "./legacy-app.js";
import "./app-fixes.js";
import "./core/bootstrap.js";
import "./core/session-coordinator.js";
import "./core/presence-coordinator.js";
import "./core/presence-ui.js";
import "./core/service-registry.js";
import "./feature-bootstrap.js";