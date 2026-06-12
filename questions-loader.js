(() => {
  const DEFAULT_STAGE_IDS = ["slime", "goblin", "ghost", "food", "boss"];

  if (
    typeof firebase === "undefined" ||
    typeof FIREBASE_CONFIG === "undefined"
  ) {
    console.warn("問題データ連携: Firebase未読込");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  function applyQuestionDocs(snapshot) {
    const byStage = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      if (
        data &&
        data.enabled !== false &&
        Array.isArray(data.questions) &&
        data.questions.length
      ) {
        byStage[doc.id] = data.questions;
      }
    });

    if (typeof stages === "undefined" || !Array.isArray(stages)) {
      console.error("問題データ連携: stagesが見つかりません");
      return;
    }

    stages.forEach(stage => {
      const questions = byStage[stage.id];
      if (!questions) return;

      stage.q = questions
        .filter(q =>
          q &&
          typeof q.text === "string" &&
          Array.isArray(q.choices) &&
          q.choices.length >= 2 &&
          Number.isInteger(q.correctIndex) &&
          q.correctIndex >= 0 &&
          q.correctIndex < q.choices.length
        )
        .map(q => [
          q.text,
          q.choices.map(String),
          q.correctIndex
        ]);
    });

    console.log("Firestore問題データを反映しました");
    window.dispatchEvent(new CustomEvent("questions-loaded"));
  }

  auth.onAuthStateChanged(user => {
    if (!user) return;

    db.collection("questions")
      .onSnapshot(
        applyQuestionDocs,
        error => console.error("問題データ読込失敗:", error)
      );
  });
})();
