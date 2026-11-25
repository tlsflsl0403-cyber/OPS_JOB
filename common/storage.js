(function (global) {
  "use strict";

  const namespace = global.OPSJOB || (global.OPSJOB = {});
  const USER_KEY = "user";
  const RECORDS_KEY = "records";
  const LEGACY_USER_KEY = "selfdev.user";
  const LEGACY_RECORDS_KEY = "selfdev.records";

  function readJson(key, fallback, legacyKey) {
    const raw = global.localStorage.getItem(key) ?? global.localStorage.getItem(legacyKey);
    if (raw === null) {
      return fallback;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`저장된 데이터(${key})를 읽지 못했습니다: ${error.message}`);
    }
  }

  function getUser() {
    const user = readJson(USER_KEY, {}, LEGACY_USER_KEY);
    if (!user || typeof user !== "object" || Array.isArray(user)) {
      throw new TypeError("저장된 사용자 데이터 형식이 올바르지 않습니다.");
    }
    return user;
  }

  function saveUser(user) {
    if (!user || typeof user !== "object" || Array.isArray(user)) {
      throw new TypeError("저장할 사용자 데이터 형식이 올바르지 않습니다.");
    }
    global.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function getRecords() {
    const records = readJson(RECORDS_KEY, [], LEGACY_RECORDS_KEY);
    if (!Array.isArray(records)) {
      throw new TypeError("저장된 기록 데이터 형식이 올바르지 않습니다.");
    }
    return records;
  }

  function saveRecord(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new TypeError("저장할 기록 데이터 형식이 올바르지 않습니다.");
    }
    const records = getRecords();
    records.push(record);
    global.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  }

  function getTagCounts() {
    return getRecords().reduce((counts, record) => {
      for (const tag of new Set(Array.isArray(record.tags) ? record.tags : [])) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
      return counts;
    }, {});
  }

  namespace.storage = { getUser, saveUser, getRecords, saveRecord, getTagCounts };
})(window);
