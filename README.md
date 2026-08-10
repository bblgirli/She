# She

## Firebase setup

This is a browser Firebase app. Create a Firebase project, enable **Authentication > Sign-in method > Email/Password** (and Google if you want the Google button), and create a Firestore database.

1. Copy the web app configuration from Firebase Console > Project settings into [firebase-config.js](firebase-config.js).
2. Publish [firestore.rules](firestore.rules) in the Firestore Rules tab, or deploy it with the Firebase CLI.
3. Serve this folder over HTTP, for example `python3 -m http.server 8080`, then open `http://localhost:8080/signup.html`.

Accounts are stored in the Firebase Authentication service and `users/{uid}`. Messages are stored under `conversations/{conversationId}/messages` and are read in real time with Firestore listeners. The existing contact cards use legacy names; to create a shared conversation between two accounts, call `openChat(name, otherUserUid)` from a contact entry so both users resolve the same conversation.