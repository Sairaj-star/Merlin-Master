/**
 * IndexedDB layer for StudyMaster AI
 */
const StudyDB = (function () {
  const DB_NAME = 'StudyMasterAI';
  const DB_VERSION = 1;
  let db = null;

  const STORES = {
    subjects: 'subjects',
    chapters: 'chapters',
    tasks: 'tasks',
    notes: 'notes',
    studyLogs: 'studyLogs',
    habits: 'habits',
    goals: 'goals',
    achievements: 'achievements',
    revisions: 'revisions',
    mockScores: 'mockScores'
  };

  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        db = req.result;
        resolve(db);
      };
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORES.subjects)) {
          const s = database.createObjectStore(STORES.subjects, { keyPath: 'id' });
          s.createIndex('archived', 'archived', { unique: false });
        }
        if (!database.objectStoreNames.contains(STORES.chapters)) {
          const c = database.createObjectStore(STORES.chapters, { keyPath: 'id' });
          c.createIndex('subjectId', 'subjectId', { unique: false });
        }
        if (!database.objectStoreNames.contains(STORES.tasks)) {
          const t = database.createObjectStore(STORES.tasks, { keyPath: 'id' });
          t.createIndex('date', 'date', { unique: false });
          t.createIndex('subjectId', 'subjectId', { unique: false });
        }
        if (!database.objectStoreNames.contains(STORES.notes)) {
          database.createObjectStore(STORES.notes, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORES.studyLogs)) {
          const l = database.createObjectStore(STORES.studyLogs, { keyPath: 'id' });
          l.createIndex('date', 'date', { unique: false });
        }
        if (!database.objectStoreNames.contains(STORES.habits)) {
          database.createObjectStore(STORES.habits, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORES.goals)) {
          database.createObjectStore(STORES.goals, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORES.achievements)) {
          database.createObjectStore(STORES.achievements, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORES.revisions)) {
          const r = database.createObjectStore(STORES.revisions, { keyPath: 'id' });
          r.createIndex('chapterId', 'chapterId', { unique: false });
        }
        if (!database.objectStoreNames.contains(STORES.mockScores)) {
          database.createObjectStore(STORES.mockScores, { keyPath: 'id' });
        }
      };
    });
  }

  function tx(storeNames, mode = 'readonly') {
    return db.transaction(storeNames, mode);
  }

  function getAll(storeName) {
    return open().then(() => new Promise((resolve, reject) => {
      const request = tx([storeName]).objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }));
  }

  function getByIndex(storeName, indexName, value) {
    return open().then(() => new Promise((resolve, reject) => {
      const request = tx([storeName]).objectStore(storeName).index(indexName).getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }));
  }

  function put(storeName, item) {
    return open().then(() => new Promise((resolve, reject) => {
      const request = tx([storeName], 'readwrite').objectStore(storeName).put(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    }));
  }

  function putMany(storeName, items) {
    return open().then(() => new Promise((resolve, reject) => {
      const transaction = tx([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      items.forEach((item) => store.put(item));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    }));
  }

  function remove(storeName, id) {
    return open().then(() => new Promise((resolve, reject) => {
      const request = tx([storeName], 'readwrite').objectStore(storeName).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }));
  }

  function clearStore(storeName) {
    return open().then(() => new Promise((resolve, reject) => {
      const request = tx([storeName], 'readwrite').objectStore(storeName).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }));
  }

  async function exportAll() {
    const data = {};
    for (const name of Object.values(STORES)) {
      data[name] = await getAll(name);
    }
    return data;
  }

  async function importAll(data) {
    await open();
    for (const [storeName, items] of Object.entries(data)) {
      if (STORES[storeName] || Object.values(STORES).includes(storeName)) {
        const store = Object.values(STORES).includes(storeName) ? storeName : STORES[storeName];
        if (Array.isArray(items)) {
          await clearStore(store);
          if (items.length) await putMany(store, items);
        }
      }
    }
  }

  async function clearAll() {
    await open();
    await Promise.all(Object.values(STORES).map(clearStore));
  }

  return {
    STORES,
    open,
    getAll,
    getByIndex,
    put,
    putMany,
    remove,
    clearStore,
    exportAll,
    importAll,
    clearAll
  };
})();
