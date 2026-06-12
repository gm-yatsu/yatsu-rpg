(() => {
  const STORAGE_KEY = "qrRpgCertV2";

  if (!window.FIREBASE_CONFIG || FIREBASE_CONFIG.apiKey.startsWith("REPLACE_")) {
    console.warn("Firebase設定が未入力のため、端末内保存で動作しています。");
    return;
  }

  firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth();
  const db = firebase.firestore();

  let currentUid = null;
  let saveTimer = null;
  const originalSetItem = localStorage.setItem.bind(localStorage);

  function playerPayload(rawState) {
    return {
      playerName: rawState.name || "",
      difficulty: rawState.difficulty || "",
      hp: Number(rawState.hp || 0),
      crystals: Number(rawState.crystals || 0),
      cleared: Array.isArray(rawState.cleared) ? rawState.cleared : [],
      completed: Boolean(rawState.completed),
      certificateCode: rawState.certificate?.code || "",
      certificateRank: rawState.certificate?.rank || "",
      certificateDate: rawState.certificate?.date || "",
      currentStage: rawState.stage || "",
      userAgent: navigator.userAgent.slice(0, 300),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function syncNow(value) {
    if (!currentUid) return;
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (!parsed || !parsed.name) return;
      await db.collection("players").doc(currentUid).set(
        playerPayload(parsed),
        { merge: true }
      );
      window.dispatchEvent(new CustomEvent("cloud-save-success"));
    } catch (error) {
      console.error("Firebase保存エラー:", error);
      window.dispatchEvent(new CustomEvent("cloud-save-error"));
    }
  }

  localStorage.setItem = function(key, value) {
    originalSetItem(key, value);
    if (key !== STORAGE_KEY) return;

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => syncNow(value), 300);
  };

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => auth.signInAnonymously())
    .catch(error => console.error("匿名ログインエラー:", error));

  auth.onAuthStateChanged(async user => {
    if (!user) return;
    currentUid = user.uid;

    const localValue = localStorage.getItem(STORAGE_KEY);
    if (localValue) {
      await syncNow(localValue);
    }
  });
})();
