// She application bootstrap.
// The legacy runtime remains the active runtime while feature services migrate.
// This registry has no Firebase side effects and is safe to load at startup.
import "./core/service-registry.js";
import "./legacy-app.js";
import "./app-fixes.js";
