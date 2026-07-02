/**
 * Life Dashboard — LDStorage
 * Единое "безлимитное" хранилище на IndexedDB вместо localStorage.
 *
 * Подключить ПЕРЕД основным <script> страницы:
 *   <script src="storage.js"></script>
 *
 * Использование (везде — асинхронно, через async/await или .then):
 *   await window.LDStorage.set('notes', dataArray);
 *   const notes = await window.LDStorage.get('notes'); // undefined если ключа нет
 *   await window.LDStorage.delete('notes');
 *   const keys  = await window.LDStorage.keys();
 *
 * Почему IndexedDB, а не localStorage:
 *   localStorage жёстко ограничен ~5-10 МБ на домен и не подходит для
 *   хранения фото/видео/аудио в base64 (дневник, вотчлист и т.п.).
 *   IndexedDB лимитируется свободным местом на устройстве (обычно
 *   десятки-сотни МБ, часто несколько ГБ) — на практике достаточно
 *   для многолетнего использования приложения.
 */
(function (global) {
  'use strict';

  const DB_NAME    = 'LifeDashboardDB';
  const DB_VERSION = 1;
  const STORE      = 'kv';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in global)) {
        reject(new Error('IndexedDB недоступен в этом браузере'));
        return;
      }
      const req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error || new Error('Не удалось открыть IndexedDB'));
      req.onblocked = () => reject(new Error('Открытие IndexedDB заблокировано другой вкладкой'));
    });
    return dbPromise;
  }

  async function get(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async function set(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
      tx.onabort    = () => reject(tx.error || new Error('Транзакция прервана'));
    });
  }

  async function del(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
    });
  }

  async function keys() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
  }

  /**
   * Одноразовая миграция данных из localStorage в IndexedDB.
   * migrations: [{ lsKey, idbKey, extract? }]
   *   lsKey    — ключ в localStorage (JSON-строка)
   *   idbKey   — ключ в IndexedDB, куда положить результат
   *   extract  — необязательная функция (parsedValue) => valueToStore
   *              (например, чтобы достать вложенное поле {notes:[...]})
   * После успешного переноса старый ключ в localStorage удаляется,
   * чтобы освободить его крошечную квоту для остальных разделов.
   * Безопасно вызывать многократно — если в IndexedDB уже что-то есть,
   * миграция для этого ключа пропускается.
   */
  async function migrateFromLocalStorage(migrations) {
    for (const m of migrations) {
      try {
        const already = await get(m.idbKey);
        if (already !== null && already !== undefined) continue; // уже мигрировано

        const raw = global.localStorage.getItem(m.lsKey);
        if (raw === null) continue; // нечего переносить

        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        const value = typeof m.extract === 'function' ? m.extract(parsed) : parsed;

        await set(m.idbKey, value);
        global.localStorage.removeItem(m.lsKey);
      } catch (err) {
        console.error('LDStorage: ошибка миграции ключа', m.lsKey, err);
        // не прерываем миграцию остальных ключей
      }
    }
  }

  /**
   * Просим браузер не вытеснять данные приложения при нехватке места.
   * Не гарантирует успеха (зависит от браузера/эвристик), но снижает риск.
   */
  async function requestPersistence() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        return await navigator.storage.persist();
      }
    } catch (e) { /* игнорируем — не критично */ }
    return false;
  }

  /** Текущее использование / квота (если браузер поддерживает). */
  async function estimateUsage() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        return await navigator.storage.estimate(); // {usage, quota}
      }
    } catch (e) { /* игнорируем */ }
    return null;
  }

  global.LDStorage = {
    get,
    set,
    delete: del,
    keys,
    migrateFromLocalStorage,
    requestPersistence,
    estimateUsage
  };

  // Просим постоянное хранилище сразу при подключении скрипта.
  requestPersistence();

})(window);
