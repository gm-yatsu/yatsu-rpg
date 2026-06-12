(() => {
  const DEFAULT_QUESTIONS_PER_BATTLE = 3;

  if (
    typeof stages === "undefined" ||
    typeof startBattle !== "function" ||
    typeof renderQuestion !== "function"
  ) {
    console.error("ランダム出題機能: ゲーム本体が読み込まれていません。");
    return;
  }

  function shuffle(array) {
    const copy = array.slice();

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }

  function prepareBattleQuestions(stage) {
    const source = Array.isArray(stage.q) ? stage.q : [];
    const count = Math.min(
      Number(stage.questionsPerBattle || DEFAULT_QUESTIONS_PER_BATTLE),
      source.length
    );

    stage._battleQuestions = shuffle(source).slice(0, count);
    stage._battleQuestionCount = count;
  }

  const originalStartBattle = startBattle;

  startBattle = function(stageId) {
    const stage = stages.find(item => item.id === stageId);

    if (stage) {
      prepareBattleQuestions(stage);
    }

    return originalStartBattle(stageId);
  };

  renderQuestion = function(stage) {
    const pool =
      Array.isArray(stage._battleQuestions) &&
      stage._battleQuestions.length
        ? stage._battleQuestions
        : stage.q;

    if (!Array.isArray(pool) || !pool.length) {
      document.getElementById("message").textContent =
        "このステージには問題が登録されていません。";
      document.getElementById("choices").innerHTML = "";
      return;
    }

    const questionIndex = state.q;

    if (questionIndex >= pool.length) {
      // 全問終了しても敵が残っている場合は、新しい問題セットを作る
      prepareBattleQuestions(stage);
      state.q = 0;
      save();
      return renderQuestion(stage);
    }

    const source = pool[questionIndex];

    const questionText = source[0];
    const choices = source[1]
      .map((text, index) => ({
        text,
        correct: index === source[2]
      }));

    const shuffledChoices = shuffle(choices);

    document.getElementById("qNo").textContent =
      `問題 ${questionIndex + 1} / ${pool.length}`;

    document.getElementById("qText").textContent =
      questionText;

    document.getElementById("message").textContent =
      "答えを選んで攻撃しよう";

    document.getElementById("nextBtn").classList.add("hidden");
    document.getElementById("returnBtn").classList.add("hidden");

    const box = document.getElementById("choices");
    box.innerHTML = "";

    shuffledChoices.forEach(item => {
      const button = document.createElement("button");
      button.className = "choice";
      button.textContent = item.text;
      button.dataset.correct = item.correct ? "1" : "0";

      button.onclick = () => {
        answer(button, item.correct, stage);
      };

      box.appendChild(button);
    });
  };

  console.log("ランダム3問・重複なし出題を有効化しました。");
})();
