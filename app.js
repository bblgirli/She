// She application bootstrap.
// The legacy runtime remains the active runtime while the feature modules are
// migrated safely. Do not initialize a second Firebase app here.
import "./legacy-app.js";
import "./app-fixes.js";
