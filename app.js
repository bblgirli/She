// She application bootstrap.
// Firebase is initialized through the single shared runtime before feature services.
import { preloadFirebaseRuntime } from "./firebase-runtime.js";
import "./app-fixes.js";
import "./core/bootstrap.js";
import "./feature-bootstrap.js";
import "./legacy-app.js";

preloadFirebaseRuntime();
