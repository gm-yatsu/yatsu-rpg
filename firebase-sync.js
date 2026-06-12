(() => {
  const STORAGE_KEY = "qrRpgCertV2";

  if (typeof FIREBASE_CONFIG === "undefined") {
    console.error("Firebase設定ファイルが読み込まれていません。");
    return;
  }

  if (
    !FIREBASE_CONFIG.apiKey ||
    FIREBASE_CONFIG.apiKey.startsWith("REPLACE_")
  ) {
    console.error("Firebase設定値が未入力です。");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  let currentUid = null;
  let saveTimer = null;

  const originalSetItem = localStorage.setItem.bind(localStorage);

  function buildPayload(rawState) {
    return {
      playerName: rawState.name || "",
      difficulty: rawState.difficulty || "",
      hp: Number(rawState.hp || 0),
      crystals: Number(rawState.crystals || 0),
      cleared: Array.isArray(rawState.cleared)
        ? rawState.cleared
        : [],
      completed: Boolean(rawState.completed),
      certificateCode: rawState.certificate?.code || "",
      certificateRank: rawState.certificate?.rank || "",
      certificateDate: rawState.certificate?.date || "",
      currentStage: rawState.stage || "",
      updatedAt:
        firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function syncNow(value) {
    if (!currentUid) {
      return;
    }

    try {
      const parsed =
        typeof value === "string"
          ? JSON.parse(value)
          : value;

      if (!parsed || !parsed.name) {
        return;
      }

      await db
        .collection("players")
        .doc(currentUid)
        .set(
          buildPayload(parsed),
          { merge: true }
        );

      console.log(
        "Firestore保存成功:",
        currentUid
      );
    } catch (error) {
      console.error(
        "Firestore保存失敗:",
        error
      );
    }
  }

  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);

    if (key !== STORAGE_KEY) {
      return;
    }

    clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {
      syncNow(value);
    }, 300);
  };

  auth
    .setPersistence(
      firebase.auth.Auth.Persistence.LOCAL
    )
    .then(() => auth.signInAnonymously())
    .catch(error => {
      console.error(
        "匿名認証失敗:",
        error
      );
    });

  auth.onAuthStateChanged(async user => {
    if (!user) {
      return;
    }

    currentUid = user.uid;

    console.log(
      "匿名認証成功:",
      currentUid
    );

    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (saved) {
      await syncNow(saved);
    }
  });
})();
