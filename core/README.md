# Core architecture

This is the first safe step of the Smart-Bank-inspired migration.

- `firebase-runtime.js`: one cached Firebase app/auth/Firestore loading boundary.
- `session.js`: one account-scoped browser state boundary.

Existing production feature code is intentionally untouched until each feature is migrated and verified.