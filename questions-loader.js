(() => {
  if (
    typeof firebase === "undefined" ||
    typeof FIREBASE_CONFIG === "undefined"
  ) {
    console.error("Firebaseが読み込まれていません。");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  let questionData = {};

  function normalizeQuestions(list) {
    if (!Array.isArray(list)) {
      return [];
    }

    return list
      .filter(question =>
        question &&
        typeof question.text === "string" &&
        Array.isArray(question.choices) &&
        question.choices.length >= 2 &&
        Number.isInteger(question.correctIndex)
      )
      .map(question => [
        question.text,
        question.choices.map(String),
        question.correctIndex
      ]);
  }

  function applyQuestions() {
    if (
      typeof stages === "undefined" ||
      !Array.isArray(stages)
    ) {
      console.error("stagesが見つかりません。");
      return;
    }

    const difficulty =
      typeof state !== "undefined" &&
      state.difficulty === "adult"
        ? "adult"
        : "kids";

    const field =
      difficulty === "adult"
        ? "adultQuestions"
        : "kidsQuestions";

    stages.forEach(stage => {
      const data = questionData[stage.id];

      if (!data || data.enabled === false) {
        return;
      }

      const questions =
        normalizeQuestions(data[field]);

      if (questions.length > 0) {
        stage.q = questions;
      }
    });

    console.log(
      difficulty + "用の問題を反映しました。"
    );
  }

  auth.onAuthStateChanged(user => {
    if (!user) {
      return;
    }

    db.collection("questions").onSnapshot(
      snapshot => {
        questionData = {};

        snapshot.forEach(doc => {
          questionData[doc.id] = doc.data();
        });

        applyQuestions();
      },
      error => {
        console.error(
          "問題データ読込失敗:",
          error
        );
      }
    );
  });

  const startButton =
    document.getElementById("startBtn");

  if (startButton) {
    startButton.addEventListener(
      "click",
      () => {
        setTimeout(applyQuestions, 0);
      }
    );
  }

  window.addEventListener(
    "questions-refresh",
    applyQuestions
  );
})();
