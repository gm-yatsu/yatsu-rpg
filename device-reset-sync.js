(() => {
  const STORAGE_KEY = "qrRpgCertV2";
  const RESET_VERSION_KEY = "qrRpgResetVersion";

  if (
    typeof firebase === "undefined" ||
    typeof FIREBASE_CONFIG === "undefined"
  ) {
    console.error("端末リセット同期: Firebaseが読み込まれていません。");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  let unsubscribe = null;
  let applyingReset = false;

  function defaultState(playerName = "", difficulty = "kids") {
    return {
      name: playerName,
      difficulty,
      hp: 100,
      crystals: 0,
      cleared: [],
      stage: null,
      enemyHp: 0,
      q: 0,
      completed: false,
      certificate: null
    };
  }

  function applyLocalReset(playerData, resetVersion) {
    if (applyingReset) return;
    applyingReset = true;

    try {
      const currentLocal = localStorage.getItem(STORAGE_KEY);
      let currentState = {};

      try {
        currentState = currentLocal ? JSON.parse(currentLocal) : {};
      } catch (_) {
        currentState = {};
      }

      const resetState = defaultState(
        playerData.playerName || currentState.name || "",
        playerData.difficulty || currentState.difficulty || "kids"
      );

      localStorage.setItem(
        RESET_VERSION_KEY,
        String(resetVersion)
      );

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(resetState)
      );

      if (typeof state !== "undefined") {
        Object.assign(state, resetState);
      }

      alert(
        "スタッフ操作により進捗がリセットされました。最初から冒険を開始します。"
      );

      const cleanUrl =
        location.origin + location.pathname;

      location.replace(cleanUrl);
    } finally {
      applyingReset = false;
    }
  }

  auth.onAuthStateChanged(user => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (!user) return;

    unsubscribe = db
      .collection("players")
      .doc(user.uid)
      .onSnapshot(snapshot => {
        if (!snapshot.exists) return;

        const data = snapshot.data() || {};
        const remoteVersion =
          Number(data.resetVersion || 0);

        const localVersion =
          Number(
            localStorage.getItem(RESET_VERSION_KEY) || 0
          );

        if (remoteVersion > localVersion) {
          applyLocalReset(data, remoteVersion);
        }
      }, error => {
        console.error("端末リセット監視エラー:", error);
      });
  });

  console.log("端末側リセット同期を有効化しました。");
})();