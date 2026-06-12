(() => {
  if (typeof firebase === "undefined" || typeof FIREBASE_CONFIG === "undefined") return;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);

  const auth = firebase.auth();
  const db = firebase.firestore();
  let uid = null;
  let battleStartedAt = null;
  let currentQuestion = { stageId: "", questionText: "", questionNumber: 0 };

  async function logEvent(type, extra = {}) {
    if (!uid) return;
    try {
      await db.collection("gameEvents").add({
        type,
        playerId: uid,
        playerName: state?.name || "",
        difficulty: state?.difficulty || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...extra
      });
    } catch (error) {
      console.error("分析ログ保存失敗:", error);
    }
  }

  auth.onAuthStateChanged(user => {
    if (user) uid = user.uid;
  });

  if (typeof startBattle === "function") {
    const originalStartBattle = startBattle;
    startBattle = function(stageId) {
      battleStartedAt = Date.now();
      logEvent("stage_start", { stageId });
      return originalStartBattle(stageId);
    };
  }

  if (typeof renderQuestion === "function") {
    const originalRenderQuestion = renderQuestion;
    renderQuestion = function(stage) {
      const result = originalRenderQuestion(stage);
      currentQuestion = {
        stageId: stage?.id || "",
        questionText: document.getElementById("qText")?.textContent || "",
        questionNumber: Number(state?.q || 0) + 1
      };
      logEvent("question_view", currentQuestion);
      return result;
    };
  }

  if (typeof answer === "function") {
    const originalAnswer = answer;
    answer = function(button, correct, stage) {
      logEvent("question_answer", {
        stageId: stage?.id || "",
        questionText: currentQuestion.questionText,
        questionNumber: currentQuestion.questionNumber,
        selectedText: button?.textContent || "",
        correct: Boolean(correct)
      });
      return originalAnswer(button, correct, stage);
    };
  }

  if (typeof win === "function") {
    const originalWin = win;
    win = function(stage) {
      logEvent("stage_clear", {
        stageId: stage?.id || "",
        durationSeconds: battleStartedAt
          ? Math.round((Date.now() - battleStartedAt) / 1000)
          : 0,
        remainingHp: Number(state?.hp || 0)
      });
      return originalWin(stage);
    };
  }

  console.log("分析ログ機能を有効化しました。");
})();