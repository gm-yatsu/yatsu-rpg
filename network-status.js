(() => {
  const STATUS_ID = "networkStatusBar";

  function createStatusBar() {
    if (document.getElementById(STATUS_ID)) return;

    const bar = document.createElement("div");
    bar.id = STATUS_ID;
    bar.innerHTML = `
      <span id="networkStatusText">通信状態を確認中…</span>
      <button id="networkRetryBtn" type="button">再試行</button>
    `;

    const style = document.createElement("style");
    style.textContent = `
      #${STATUS_ID}{
        position:sticky;
        top:0;
        z-index:9999;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        width:min(100%,560px);
        margin:0 auto 10px;
        padding:10px 14px;
        border-radius:12px;
        font-weight:800;
        font-size:13px;
        box-shadow:0 6px 18px rgba(0,0,0,.18);
        transition:.25s;
      }
      #${STATUS_ID}.checking{background:#fff1bd;color:#654d00}
      #${STATUS_ID}.online{background:#d9f4df;color:#145f2d}
      #${STATUS_ID}.saving{background:#dcecff;color:#174f87}
      #${STATUS_ID}.offline{background:#ffdada;color:#8b2424}
      #${STATUS_ID} button{
        border:0;
        border-radius:8px;
        padding:7px 10px;
        background:rgba(0,0,0,.1);
        color:inherit;
        font-weight:900;
      }
    `;

    document.head.appendChild(style);
    document.body.insertBefore(bar, document.body.firstChild);

    document.getElementById("networkRetryBtn")
      .addEventListener("click", retryConnection);
  }

  function setStatus(type, text, showRetry = false) {
    createStatusBar();

    const bar = document.getElementById(STATUS_ID);
    const label = document.getElementById("networkStatusText");
    const retry = document.getElementById("networkRetryBtn");

    bar.className = type;
    label.textContent = text;
    retry.style.display = showRetry ? "inline-block" : "none";
  }

  async function verifyFirebase() {
    if (!navigator.onLine) {
      setStatus("offline", "オフラインです。通信環境を確認してください。", true);
      return false;
    }

    if (
      typeof firebase === "undefined" ||
      typeof FIREBASE_CONFIG === "undefined"
    ) {
      setStatus("offline", "ゲーム設定の読み込みに失敗しました。", true);
      return false;
    }

    setStatus("checking", "Firebaseへ接続中…");

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }

      const auth = firebase.auth();
      const db = firebase.firestore();

      let user = auth.currentUser;

      if (!user) {
        user = await auth.signInAnonymously();
        user = user.user;
      }

      await db.collection("players").doc(user.uid).get();

      setStatus("online", "オンライン：進捗を保存できます。");
      return true;
    } catch (error) {
      console.error("接続確認失敗:", error);
      setStatus(
        "offline",
        "通信エラー：再試行してください。",
        true
      );
      return false;
    }
  }

  async function retryConnection() {
    setStatus("checking", "再接続しています…");

    try {
      if (typeof firebase !== "undefined" && firebase.apps.length) {
        await firebase.firestore().enableNetwork();
      }
    } catch (error) {
      console.warn("Firestore再接続:", error);
    }

    await verifyFirebase();
  }

  window.addEventListener("online", verifyFirebase);
  window.addEventListener("offline", () => {
    setStatus("offline", "オフラインです。進捗は端末内に一時保存されます。", true);
  });

  const originalSetItem = localStorage.setItem.bind(localStorage);

  localStorage.setItem = function(key, value) {
    originalSetItem(key, value);

    if (key === "qrRpgCertV2") {
      if (navigator.onLine) {
        setStatus("saving", "進捗を保存中…");

        setTimeout(() => {
          verifyFirebase();
        }, 1200);
      } else {
        setStatus(
          "offline",
          "オフライン：進捗は端末内に一時保存されました。",
          true
        );
      }
    }
  };

  createStatusBar();
  setStatus("checking", "通信状態を確認中…");
  verifyFirebase();
})();