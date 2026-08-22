# Core runtime

This is the first executable layer of the Smart-Bank-inspired migration.

- `firebase-runtime.js` owns cached Firebase app/auth/Firestore module loading.
- `session.js` owns account-scoped browser state.

Feature pages remain on the existing runtime until each feature is migrated and verified. This prevents regressions in chat, voice notes, calls, notifications, and presence.