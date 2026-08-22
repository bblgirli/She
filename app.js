// She application bootstrap.
// Legacy remains first for compatibility; the shared architecture then owns
// session/data/presence coordination without replacing the proven Firebase path.
import "./legacy-app.js";
import "./app-fixes.js";
import "./core/bootstrap.js";
import "./core/session-coordinator.js";
import "./core/presence-coordinator.js";
import "./core/service-registry.js";
import "./feature-bootstrap.js";
