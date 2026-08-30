(() => {
  if (window.__yatsuAnalyticsLoggerV2) return;
  window.__yatsuAnalyticsLoggerV2 = true;

  const PENDING_EVENT_QUEUE_KEY = "pendingEventQueue";
  const APP_VERSION = "yatsu-rpg-8-p2-20260830";
  const LEGACY_TYPES = {
    battle_start: "stage_start",
    answer: "question_answer",
    enemy_clear: "stage_clear",
    boss_clear: "stage_clear"
  };

  if (typeof firebase === "undefined" || typeof FIREBASE_CONFIG === "undefined") {
    console.error("分析ログ: Firebaseを利用できません。");
    return;
  }
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);

  const auth = firebase.auth();
  const db = firebase.firestore();
  let uid = auth.currentUser?.uid || null;
  let battleStartedAt = null;
  let flushing = false;
  let flushAgain = false;
  let renderingQuestion = false;
  let gameStartLogged = false;
  let gameResetLogged = false;
  let currentQuestion = {
    stageId: "",
    stageName: "",
    questionText: "",
    questionNumber: 0
  };

  function readPendingEventQueue() {
    try {
      const saved = localStorage.getItem(PENDING_EVENT_QUEUE_KEY);
      const queue = saved ? JSON.parse(saved) : [];
      return Array.isArray(queue) ? queue : [];
    } catch (error) {
      console.error("分析ログキュー読込失敗:", error);
      return [];
    }
  }

  function writePendingEventQueue(queue) {
    try {
      localStorage.setItem(PENDING_EVENT_QUEUE_KEY, JSON.stringify(queue));
      return true;
    } catch (error) {
      console.error("分析ログキュー保存失敗:", error);
      return false;
    }
  }

  function createEventId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function stageFor(stageId) {
    if (!stageId || typeof stages === "undefined" || !Array.isArray(stages)) {
      return null;
    }
    return stages.find(stage => stage.id === stageId) || null;
  }

  function legacyTypeFor(eventType) {
    return LEGACY_TYPES[eventType] || eventType;
  }

  function createEvent(eventType, extra = {}) {
    const stageId = extra.stageId || state?.stage || "";
    const stage = stageFor(stageId);
    const certificate = state?.certificate || null;
    const eventId = createEventId();
    return {
      ...extra,
      eventId,
      eventType,
      type: legacyTypeFor(eventType),
      uid: uid || "",
      playerId: uid || "",
      playerName: extra.playerName ?? state?.name ?? "",
      difficulty: extra.difficulty ?? state?.difficulty ?? "",
      stageId,
      stageName: extra.stageName || stage?.name || "",
      crystals: Number(state?.crystals || 0),
      clearedCount: Array.isArray(state?.cleared) ? state.cleared.length : 0,
      completed: Boolean(state?.completed),
      certificateCode: certificate?.code || "",
      createdAtClientMs: Date.now(),
      userAgent: navigator.userAgent || "",
      appVersion: APP_VERSION
    };
  }

  function enqueueEvent(event) {
    const queue = readPendingEventQueue().filter(item => item?.eventId !== event.eventId);
    queue.push(event);
    return writePendingEventQueue(queue);
  }

  function removeQueuedEvent(eventId) {
    const queue = readPendingEventQueue().filter(item => item?.eventId !== eventId);
    writePendingEventQueue(queue);
  }

  function firestorePayload(event) {
    return {
      ...event,
      uid: uid || event.uid || "",
      playerId: uid || event.playerId || "",
      createdAt: firebase.firestore.Timestamp.fromMillis(
        Number(event.createdAtClientMs || Date.now())
      ),
      receivedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function sendEvent(event) {
    if (!uid || navigator.onLine === false) return false;
    try {
      await db.collection("gameEvents")
        .doc(event.eventId)
        .set(firestorePayload(event), { merge: true });
      removeQueuedEvent(event.eventId);
      return true;
    } catch (error) {
      console.error("分析ログ保存失敗。キューを保持します:", error);
      return false;
    }
  }

  async function flushPendingEventQueue() {
    if (flushing) {
      flushAgain = true;
      return;
    }
    if (!uid || navigator.onLine === false) return;
    flushing = true;
    try {
      const queue = readPendingEventQueue();
      for (const event of queue) {
        const sent = await sendEvent(event);
        if (!sent) break;
      }
    } finally {
      flushing = false;
      if (flushAgain) {
        flushAgain = false;
        setTimeout(flushPendingEventQueue, 0);
      }
    }
  }

  function logEvent(eventType, extra = {}) {
    try {
      const event = createEvent(eventType, extra);
      const queued = enqueueEvent(event);
      if (queued) {
        flushPendingEventQueue();
      } else {
        sendEvent(event);
      }
      return event.eventId;
    } catch (error) {
      console.error("分析ログ生成失敗:", error);
      return "";
    }
  }

  auth.onAuthStateChanged(user => {
    uid = user?.uid || null;
    if (uid) flushPendingEventQueue();
  });

  window.addEventListener("online", flushPendingEventQueue);

  if (typeof startBattle === "function") {
    const originalStartBattle = startBattle;
    startBattle = function(stageId) {
      const result = originalStartBattle.apply(this, arguments);
      const battleScreen = document.getElementById("battle");
      const enteredBattle =
        state?.stage === stageId && battleScreen?.classList.contains("active");
      if (enteredBattle) {
        const stage = stageFor(stageId);
        battleStartedAt = Date.now();
        logEvent("battle_start", {
          stageId,
          stageName: stage?.name || ""
        });
      }
      return result;
    };
  }

  if (typeof renderQuestion === "function") {
    const originalRenderQuestion = renderQuestion;
    renderQuestion = function(stage) {
      if (renderingQuestion) {
        return originalRenderQuestion.apply(this, arguments);
      }
      renderingQuestion = true;
      try {
        const result = originalRenderQuestion.apply(this, arguments);
        currentQuestion = {
          stageId: stage?.id || "",
          stageName: stage?.name || "",
          questionText: document.getElementById("qText")?.textContent || "",
          questionNumber: Number(state?.q || 0) + 1
        };
        logEvent("question_view", currentQuestion);
        return result;
      } finally {
        renderingQuestion = false;
      }
    };
  }

  if (typeof answer === "function") {
    const originalAnswer = answer;
    answer = function(button, correct, stage) {
      const selectedText = button?.textContent || "";
      const result = originalAnswer.apply(this, arguments);
      logEvent("answer", {
        stageId: stage?.id || currentQuestion.stageId,
        stageName: stage?.name || currentQuestion.stageName,
        questionText: currentQuestion.questionText,
        questionNumber: currentQuestion.questionNumber,
        selectedText,
        correct: Boolean(correct)
      });
      return result;
    };
  }

  if (typeof makeCertificate === "function") {
    const originalMakeCertificate = makeCertificate;
    makeCertificate = function() {
      const hadCertificate = Boolean(state?.certificate?.code);
      const result = originalMakeCertificate.apply(this, arguments);
      if (!hadCertificate && state?.certificate?.code) {
        const stage = stageFor(state?.stage);
        logEvent("certificate_issued", {
          stageId: state?.stage || "",
          stageName: stage?.name || "",
          certificateRank: state.certificate.rank || "",
          certificateDate: state.certificate.date || ""
        });
      }
      return result;
    };
  }

  if (typeof win === "function") {
    const originalWin = win;
    win = function(stage) {
      const clearedBefore = Array.isArray(state?.cleared) ? [...state.cleared] : [];
      const crystalsBefore = Number(state?.crystals || 0);
      const completedBefore = Boolean(state?.completed);
      const result = originalWin.apply(this, arguments);
      const firstClear =
        !clearedBefore.includes(stage?.id) &&
        Array.isArray(state?.cleared) &&
        state.cleared.includes(stage?.id);

      if (!firstClear) return result;

      const clearDetails = {
        stageId: stage?.id || "",
        stageName: stage?.name || "",
        durationSeconds: battleStartedAt
          ? Math.max(0, Math.round((Date.now() - battleStartedAt) / 1000))
          : 0,
        remainingHp: Number(state?.hp || 0)
      };

      if (stage?.boss) {
        logEvent("boss_clear", clearDetails);
        if (!completedBefore && state?.completed) {
          logEvent("game_complete", clearDetails);
        }
      } else {
        logEvent("enemy_clear", clearDetails);
        const crystalsAfter = Number(state?.crystals || 0);
        if (stage?.crystal && crystalsAfter > crystalsBefore) {
          logEvent("crystal_get", clearDetails);
          if (crystalsBefore < 7 && crystalsAfter === 7) {
            logEvent("all_crystals_get", clearDetails);
            logEvent("boss_unlock", clearDetails);
          }
        }
      }
      battleStartedAt = null;
      return result;
    };
  }

  const startButton = document.getElementById("startBtn");
  startButton?.addEventListener("click", () => {
    if (gameStartLogged || startButton.disabled) return;
    const playerName = document.getElementById("name")?.value.trim() || "";
    if (!playerName) return;
    gameStartLogged = true;
    logEvent("game_start", {
      stageId: "",
      stageName: "",
      playerName,
      difficulty: document.getElementById("difficulty")?.value || "kids"
    });
  }, true);

  const resetHandler = () => {
    if (gameResetLogged) return;
    gameResetLogged = true;
    const stage = stageFor(state?.stage);
    logEvent("game_reset", {
      stageId: state?.stage || "",
      stageName: stage?.name || ""
    });
  };
  document.getElementById("resetBtn")?.addEventListener("click", resetHandler, true);
  document.getElementById("againBtn")?.addEventListener("click", resetHandler, true);

  flushPendingEventQueue();
  console.log("分析ログP2機能を有効化しました。");
})();
