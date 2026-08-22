// She application bootstrap.
// Shared architecture starts first so Firebase/session/data boundaries are
// available before the existing feature runtime begins.
import "./app-fixes.js";
import "./core/bootstrap.js";
import "./feature-bootstrap.js";
import "./legacy-app.js";
