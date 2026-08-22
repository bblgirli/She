/* She — centralized Firestore data boundary.
 * Read/write helpers are deliberately generic so existing collection names and
 * document shapes remain unchanged during the migration.
 */
(function () {
  'use strict';

  function db() {
    const runtime = window.SheFirebase;
    if (!runtime || !runtime.db) throw new Error('She Firebase database is not ready');
    return runtime.db;
  }

  function firestore() {
    const runtime = window.SheFirebase;
    if (!runtime || !runtime.firestore) throw new Error('She Firestore helpers are not ready');
    return runtime.firestore;
  }

  window.SheDataStore = {
    collection(name) {
      if (!name) throw new Error('Collection name is required');
      return firestore().collection(db(), name);
    },

    doc(collectionName, id) {
      if (!id) throw new Error('Document id is required');
      return firestore().doc(db(), collectionName, id);
    },

    async get(collectionName, id) {
      const snap = await firestore().getDoc(this.doc(collectionName, id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async set(collectionName, id, data, options) {
      await firestore().setDoc(this.doc(collectionName, id), data, options || {});
    },

    async update(collectionName, id, data) {
      await firestore().updateDoc(this.doc(collectionName, id), data);
    },

    async remove(collectionName, id) {
      await firestore().deleteDoc(this.doc(collectionName, id));
    },

    async list(collectionName) {
      const snap = await firestore().getDocs(this.collection(collectionName));
      return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    },

    onCollection(collectionName, callback, onError) {
      return firestore().onSnapshot(
        this.collection(collectionName),
        (snap) => callback(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
        onError
      );
    }
  };
})();
