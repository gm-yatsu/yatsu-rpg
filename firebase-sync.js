(() => {
  const STORAGE_KEY = "qrRpgCertV2";
  const SYNC_META_KEY = "qrRpgSyncMetaV1";
  const PENDING_QUEUE_KEY = "pendingSaveQueue";
  const RESET_VERSION_KEY = "qrRpgResetVersion";
  const SAVE_DELAY_MS = 300;

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("端末保存失敗:", error);
      return false;
    }
  }

  function finishWithLocal(message) {
    const localState = readJson(STORAGE_KEY, null);
    if (localState && typeof window.yatsuRpgApplySyncedState === "function") {
      window.yatsuRpgApplySyncedState(localState, "local");
    }
    window.yatsuRpgFinishSync?.(message || "オフライン保存を使用しています。");
  }

  if (
    typeof firebase === "undefined" ||
    typeof FIREBASE_CONFIG === "undefined" ||
    !FIREBASE_CONFIG.apiKey ||
    FIREBASE_CONFIG.apiKey.startsWith("REPLACE_")
  ) {
    console.error("Firebase設定またはライブラリを利用できません。");
    finishWithLocal("クラウド保存を利用できないため、端末保存で開始します。");
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);

  const auth = firebase.auth();
  const db = firebase.firestore();
  let currentUid = null;
  let saveTimer = null;
  let synchronizing = false;

  function getMeta() {
    const meta = readJson(SYNC_META_KEY, {});
    return meta && typeof meta === "object" ? meta : {};
  }

  function setMeta(patch) {
    const meta = { ...getMeta(), ...patch };
    writeJson(SYNC_META_KEY, meta);
    if (Number.isFinite(Number(meta.resetVersion))) {
      try {
        localStorage.setItem(RESET_VERSION_KEY, String(Number(meta.resetVersion)));
      } catch (error) {
        console.error("リセット世代の端末保存失敗:", error);
      }
    }
    return meta;
  }

  function getLocalResetVersion() {
    let legacyVersion = 0;
    try {
      legacyVersion = Number(localStorage.getItem(RESET_VERSION_KEY) || 0);
    } catch (_) {}
    return Math.max(Number(getMeta().resetVersion || 0), legacyVersion);
  }

  function getQueue() {
    const queue = readJson(PENDING_QUEUE_KEY, []);
    return Array.isArray(queue) ? queue : [];
  }

  function setQueue(queue) {
    writeJson(PENDING_QUEUE_KEY, queue);
  }

  function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function cloneState(rawState) {
    return JSON.parse(JSON.stringify(rawState || {}));
  }

  function blankState() {
    return {
      name: "", difficulty: "kids", hp: 100, crystals: 0,
      cleared: [], stage: null, enemyHp: 0, q: 0,
      completed: false, certificate: null
    };
  }

  function enqueueSave(rawState) {
    const updatedAtMs = Date.now();
    const resetVersion = getLocalResetVersion();
    const item = {
      id: makeId(), type: "save", uid: currentUid,
      state: cloneState(rawState), updatedAtMs, resetVersion
    };
    const queue = getQueue().filter(entry => entry?.type !== "save");
    queue.push(item);
    setQueue(queue);
    setMeta({ updatedAtMs, resetVersion, pending: true });
    return item;
  }

  function enqueueReset() {
    const item = {
      id: makeId(), type: "reset", uid: currentUid,
      baseResetVersion: getLocalResetVersion(), requestedAtMs: Date.now()
    };
    const queue = getQueue().filter(entry =>
      entry?.type !== "save" && entry?.type !== "reset"
    );
    queue.push(item);
    setQueue(queue);
    return item;
  }

  function removeQueueItem(id) {
    setQueue(getQueue().filter(item => item?.id !== id));
  }

  function discardPendingSaves() {
    setQueue(getQueue().filter(item => item?.type !== "save"));
    setMeta({ pending: false });
  }

  function timestampToMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function buildPayload(rawState, updatedAtMs, resetVersion) {
    return {
      playerName: rawState.name || "",
      difficulty: rawState.difficulty || "kids",
      hp: Number(rawState.hp ?? 100),
      crystals: Number(rawState.crystals || 0),
      cleared: Array.isArray(rawState.cleared) ? rawState.cleared : [],
      completed: Boolean(rawState.completed),
      certificateCode: rawState.certificate?.code || "",
      certificateRank: rawState.certificate?.rank || "",
      certificateDate: rawState.certificate?.date || "",
      currentStage: rawState.stage || "",
      enemyHp: Number(rawState.enemyHp || 0),
      questionIndex: Number(rawState.q || 0),
      resetVersion: Number(resetVersion || 0),
      clientUpdatedAtMs: Number(updatedAtMs || Date.now()),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  function stateFromFirestore(data) {
    const hasCertificate = Boolean(
      data.certificateCode || data.certificateRank || data.certificateDate
    );
    return {
      name: data.playerName || "",
      difficulty: data.difficulty === "adult" ? "adult" : "kids",
      hp: Number(data.hp ?? 100),
      crystals: Number(data.crystals || 0),
      cleared: Array.isArray(data.cleared) ? data.cleared : [],
      stage: data.currentStage || null,
      enemyHp: Number(data.enemyHp || 0),
      q: Number(data.questionIndex || 0),
      completed: Boolean(data.completed),
      certificate: hasCertificate ? {
        code: data.certificateCode || "",
        rank: data.certificateRank || "",
        date: data.certificateDate || ""
      } : null
    };
  }

  function applyAndCache(rawState, source, metaPatch = {}) {
    const cachedState = cloneState(rawState);
    writeJson(STORAGE_KEY, cachedState);
    setMeta(metaPatch);
    window.yatsuRpgApplySyncedState?.(cachedState, source);
  }

  async function commitSave(item) {
    if (!currentUid || navigator.onLine === false) {
      throw new Error("OFFLINE_OR_NOT_AUTHENTICATED");
    }
    const ref = db.collection("players").doc(currentUid);
    const commitResult = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const remoteData = snapshot.exists ? snapshot.data() : {};
      const remoteResetVersion = snapshot.exists
        ? Number(remoteData.resetVersion || 0) : 0;
      if (remoteResetVersion > Number(item.resetVersion || 0)) {
        const error = new Error("STALE_RESET_VERSION");
        error.code = "stale-reset-version";
        throw error;
      }
      const remoteTime = remoteUpdatedAtMs(remoteData);
      if (
        remoteResetVersion === Number(item.resetVersion || 0) &&
        remoteTime > Number(item.updatedAtMs || 0)
      ) {
        return { resetVersion: remoteResetVersion, skippedAsOlder: true };
      }
      const resetVersion = Math.max(
        remoteResetVersion, Number(item.resetVersion || 0)
      );
      transaction.set(
        ref,
        buildPayload(item.state, item.updatedAtMs, resetVersion),
        { merge: true }
      );
      return { resetVersion, skippedAsOlder: false };
    });
    removeQueueItem(item.id);
    const newerSaveExists = getQueue().some(entry => entry?.type === "save");
    if (commitResult.skippedAsOlder) {
      if (!newerSaveExists) setTimeout(synchronizeFromFirestore, 0);
      return;
    }
    const latestLocalUpdatedAtMs = Number(getMeta().updatedAtMs || 0);
    setMeta({
      updatedAtMs: Math.max(latestLocalUpdatedAtMs, item.updatedAtMs),
      resetVersion: commitResult.resetVersion,
      pending: newerSaveExists,
      lastSyncedAtMs: Date.now()
    });
    console.log("Firestore保存成功:", currentUid);
  }

  async function commitReset(item) {
    if (!currentUid || navigator.onLine === false) {
      throw new Error("OFFLINE_OR_NOT_AUTHENTICATED");
    }
    const ref = db.collection("players").doc(currentUid);
    const result = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const remote = snapshot.exists ? snapshot.data() : {};
      const nextResetVersion = Math.max(
        Number(remote.resetVersion || 0),
        Number(item.baseResetVersion || 0)
      ) + 1;
      // オフラインでリセット後に再開していた場合、その最新進捗を保持する。
      const resetState = readJson(STORAGE_KEY, null) || blankState();
      transaction.set(ref, {
        ...buildPayload(resetState, Date.now(), nextResetVersion),
        resetAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return { nextResetVersion, resetState };
    });
    removeQueueItem(item.id);
    applyAndCache(result.resetState, "reset", {
      updatedAtMs: Date.now(), resetVersion: result.nextResetVersion,
      pending: false, pendingReset: false, lastSyncedAtMs: Date.now()
    });
    return result;
  }

  async function flushPendingSaves() {
    const saves = getQueue().filter(item => item?.type === "save");
    for (const item of saves) {
      try {
        await commitSave(item);
      } catch (error) {
        if (error?.code === "stale-reset-version") {
          removeQueueItem(item.id);
          continue;
        }
        console.error("Firestore再送失敗。キューを保持します:", error);
        break;
      }
    }
  }

  async function requestSave(rawState, options = {}) {
    if (!rawState || typeof rawState !== "object") return;
    const item = enqueueSave(rawState);
    const run = async () => {
      if (!currentUid || navigator.onLine === false) return;
      try {
        await commitSave(item);
      } catch (error) {
        if (error?.code === "stale-reset-version") {
          removeQueueItem(item.id);
          synchronizeFromFirestore();
        } else {
          console.error("Firestore保存失敗。キューへ保持します:", error);
        }
      }
    };
    clearTimeout(saveTimer);
    if (options.immediate) run();
    else saveTimer = setTimeout(run, SAVE_DELAY_MS);
  }

  async function readServerPlayer() {
    if (!currentUid || navigator.onLine === false) return null;
    return db.collection("players").doc(currentUid).get({ source: "server" });
  }

  function remoteUpdatedAtMs(data) {
    return Number(data.clientUpdatedAtMs || 0) || timestampToMillis(data.updatedAt);
  }

  async function synchronizeFromFirestore() {
    if (synchronizing || !currentUid) return;
    synchronizing = true;
    try {
      const pendingReset = getQueue().find(item => item?.type === "reset");
      if (pendingReset && navigator.onLine !== false) {
        try {
          await commitReset(pendingReset);
        } catch (error) {
          console.error("リセット再送失敗。キューを保持します:", error);
        }
      }

      let snapshot;
      try {
        snapshot = await readServerPlayer();
      } catch (error) {
        console.error("Firestore起動読込失敗:", error);
        finishWithLocal("オフライン保存から復元しました。接続後に自動再送します。");
        return;
      }
      if (!snapshot) {
        finishWithLocal("オフライン保存から復元しました。接続後に自動再送します。");
        return;
      }

      const localState = readJson(STORAGE_KEY, null);
      const localMeta = getMeta();
      const localResetVersion = getLocalResetVersion();

      if (!snapshot.exists) {
        if (localState) {
          applyAndCache(localState, "migration", {
            ...localMeta, resetVersion: localResetVersion
          });
          const migrationItem = enqueueSave(localState);
          try {
            await commitSave(migrationItem);
          } catch (error) {
            console.error("既存端末データの移行失敗。キューを保持します:", error);
          }
          window.yatsuRpgFinishSync?.("端末データをFirestoreへ移行しました。");
        } else {
          discardPendingSaves();
          window.yatsuRpgFinishSync?.("新しい冒険を開始できます。");
        }
        return;
      }

      const remoteData = snapshot.data() || {};
      const remoteState = stateFromFirestore(remoteData);
      const remoteResetVersion = Number(remoteData.resetVersion || 0);
      const remoteTime = remoteUpdatedAtMs(remoteData);
      const localTime = Number(localMeta.updatedAtMs || 0);

      let winner = "firestore";
      if (localState) {
        if (localResetVersion > remoteResetVersion) winner = "local";
        else if (
          localResetVersion === remoteResetVersion && localTime && remoteTime
        ) {
          winner = localTime > remoteTime ? "local" : "firestore";
        }
      }

      if (winner === "local") {
        applyAndCache(localState, "local-newer", {
          updatedAtMs: localTime, resetVersion: localResetVersion, pending: true
        });
        const localItem = enqueueSave(localState);
        try {
          await commitSave(localItem);
        } catch (error) {
          console.error("新しい端末データの保存失敗。キューを保持します:", error);
        }
        window.yatsuRpgFinishSync?.("端末の未送信データをFirestoreへ反映しました。");
      } else {
        discardPendingSaves();
        applyAndCache(remoteState, "firestore", {
          updatedAtMs: remoteTime, resetVersion: remoteResetVersion,
          pending: false, lastSyncedAtMs: Date.now()
        });
        window.yatsuRpgFinishSync?.("Firestoreから進捗を復元しました。");
      }
    } finally {
      synchronizing = false;
    }
  }

  async function requestReset() {
    clearTimeout(saveTimer);
    const item = enqueueReset();
    writeJson(STORAGE_KEY, blankState());
    setMeta({
      updatedAtMs: item.requestedAtMs,
      resetVersion: item.baseResetVersion + 1,
      pending: true,
      pendingReset: true
    });
    if (!currentUid || navigator.onLine === false) return;
    const attempt = commitReset(item).catch(error => {
      console.error("Firestoreリセット失敗。キューへ保持します:", error);
    });
    await Promise.race([
      attempt,
      new Promise(resolve => setTimeout(resolve, 1500))
    ]);
  }

  window.yatsuRpgSaveState = requestSave;
  window.yatsuRpgResetPlayer = requestReset;
  window.yatsuRpgSynchronize = synchronizeFromFirestore;

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => auth.currentUser || auth.signInAnonymously())
    .catch(error => {
      console.error("匿名認証失敗:", error);
      finishWithLocal("認証できないため、端末保存で開始します。");
    });

  auth.onAuthStateChanged(user => {
    if (!user) return;
    currentUid = user.uid;
    console.log("匿名認証成功:", currentUid);
    synchronizeFromFirestore();
  });

  window.addEventListener("online", () => {
    synchronizeFromFirestore().then(flushPendingSaves);
  });
})();
