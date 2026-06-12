(() => {
  const REQUIRED_CRYSTALS = 7;

  const newStages = [
    {
      id: "star",
      name: "星降るウィザード",
      icon: "🧙‍♂️",
      hp: 90,
      damage: 30,
      crystal: true,
      q: [
        ["夜空で光って見えるものは？", ["星", "石", "木の根"], 0],
        ["星を見るときに適した場所は？", ["暗い場所", "明るい部屋", "テレビの前"], 0],
        ["夜空を観察するときに大切なのは？", ["安全な場所で見る", "道路に飛び出す", "一人で遠くへ行く"], 0]
      ]
    },
    {
      id: "wolf",
      name: "雪原のホワイトウルフ",
      icon: "🐺",
      hp: 90,
      damage: 30,
      crystal: true,
      q: [
        ["寒い日に必要なものは？", ["防寒着", "水着", "うちわ"], 0],
        ["雪道で安全な歩き方は？", ["ゆっくり歩く", "全力で走る", "目を閉じる"], 0],
        ["冬の屋外で大切なのは？", ["体を冷やしすぎない", "薄着で長時間遊ぶ", "水分を取らない"], 0]
      ]
    },
    {
      id: "golem",
      name: "森のゴーレム",
      icon: "🗿",
      hp: 120,
      damage: 40,
      crystal: true,
      q: [
        ["森の植物を守る行動は？", ["道から外れない", "枝を折る", "花を全部摘む"], 0],
        ["野生動物を見つけたら？", ["離れて観察する", "追いかける", "餌をあげる"], 0],
        ["森にごみを残してはいけない理由は？", ["自然や動物を守るため", "木を高くするため", "雨を止めるため"], 0]
      ]
    }
  ];

  if (typeof stages === "undefined" || !Array.isArray(stages)) {
    console.error("8体対応: stagesが見つかりません。");
    return;
  }

  const bossIndex = stages.findIndex(stage => stage.id === "boss");

  newStages.forEach(stage => {
    if (!stages.some(existing => existing.id === stage.id)) {
      if (bossIndex >= 0) {
        stages.splice(stages.length - 1, 0, stage);
      } else {
        stages.push(stage);
      }
    }
  });

  function injectMapNodes() {
    const map = document.querySelector(".map");
    if (!map) return;

    ["star", "wolf", "golem"].forEach((id, index) => {
      if (map.querySelector(`[data-stage="${id}"]`)) return;

      const button = document.createElement("button");
      button.className = `node extra-node extra-${id}`;
      button.dataset.stage = id;
      map.appendChild(button);
    });

    const style = document.createElement("style");
    style.textContent = `
      .map{min-height:980px!important}
      .map .n1{top:90px!important;left:18px!important}
      .map .n2{top:205px!important;right:18px!important}
      .map .n3{top:325px!important;left:18px!important}
      .map .n4{top:445px!important;right:18px!important}
      .map .extra-star{top:565px;left:18px}
      .map .extra-wolf{top:685px;right:18px}
      .map .extra-golem{top:805px;left:18px}
      .map .n5{bottom:20px!important;left:50%!important;transform:translateX(-50%)!important}
    `;
    document.head.appendChild(style);

    const crystalBox = document.getElementById("crystals")?.parentElement;
    if (crystalBox) {
      crystalBox.innerHTML = `💎 <b id="crystals">0</b>/${REQUIRED_CRYSTALS}`;
    }

    document.querySelectorAll(".certificate-meta div").forEach(div => {
      if (div.textContent.includes("撃破数：")) {
        div.textContent = "撃破数：8体";
      }
    });
  }

  injectMapNodes();

  if (typeof renderMap === "function") {
    renderMap = function() {
      document.getElementById("mapName").textContent = state.name;
      document.getElementById("mapHp").textContent = state.hp;
      document.getElementById("crystals").textContent = state.crystals;

      document.querySelectorAll(".node").forEach(node => {
        const stage = stages.find(item => item.id === node.dataset.stage);
        if (!stage) return;

        const cleared = state.cleared.includes(stage.id);
        const locked = stage.boss && state.crystals < REQUIRED_CRYSTALS;

        node.disabled = cleared || locked;
        node.classList.toggle("clear", cleared);
        node.classList.toggle("locked", locked);
        node.classList.toggle("ready", stage.boss && !cleared && !locked);

        node.innerHTML = `
          <span class="icon">${locked ? "🔒" : cleared ? "✅" : stage.icon}</span>
          <strong>${stage.name}</strong>
          <small>${locked ? `${REQUIRED_CRYSTALS}つで解放` : cleared ? "CLEAR" : "挑戦する"}</small>
        `;

        node.onclick = () => startBattle(stage.id);
      });
    };
  }

  if (typeof startBattle === "function") {
    const originalStartBattle = startBattle;

    startBattle = function(stageId) {
      const stage = stages.find(item => item.id === stageId);

      if (stage?.boss && state.crystals < REQUIRED_CRYSTALS) {
        alert(`ラスボスに挑戦するにはクリスタルが${REQUIRED_CRYSTALS}つ必要です。`);
        return;
      }

      return originalStartBattle(stageId);
    };
  }

  if (typeof renderMap === "function" && typeof state !== "undefined" && state.name) {
    renderMap();
  }

  console.log("8体対応を有効化しました。");
})();