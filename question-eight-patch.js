(() => {
  const stageSelect = document.getElementById("stage");
  if (!stageSelect || typeof defaults === "undefined") return;

  const additions = [
    ["star", "星降るウィザード"],
    ["wolf", "雪原のホワイトウルフ"],
    ["golem", "森のゴーレム"]
  ];

  additions.forEach(([value, label]) => {
    if (![...stageSelect.options].some(option => option.value === value)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      stageSelect.appendChild(option);
    }
  });

  defaults.star = {
    kids: [
      {text:"夜空で光って見えるものは？",choices:["星","石","木の根"],correctIndex:0},
      {text:"星を見るときに適した場所は？",choices:["暗い場所","明るい部屋","テレビの前"],correctIndex:0},
      {text:"夜空を見るときに大切なのは？",choices:["安全な場所で見る","道路に飛び出す","一人で遠くへ行く"],correctIndex:0}
    ],
    adult: [
      {text:"星空観察に適した条件は？",choices:["周囲の光が少ない","強い照明がある","昼間である"],correctIndex:0},
      {text:"星が東から西へ動くように見える主な理由は？",choices:["地球の自転","月の公転","雲の移動"],correctIndex:0},
      {text:"高原が星空観察に向く理由の一つは？",choices:["人工光が少ない場所がある","必ず雲がない","空気が存在しない"],correctIndex:0}
    ]
  };

  defaults.wolf = {
    kids: [
      {text:"寒い日に必要なものは？",choices:["防寒着","水着","うちわ"],correctIndex:0},
      {text:"雪道で安全な歩き方は？",choices:["ゆっくり歩く","全力で走る","目を閉じる"],correctIndex:0},
      {text:"冬の屋外で大切なのは？",choices:["体を冷やしすぎない","薄着で長時間遊ぶ","水分を取らない"],correctIndex:0}
    ],
    adult: [
      {text:"雪道で歩幅を小さくする理由は？",choices:["転倒リスクを下げる","体温を下げる","靴を濡らす"],correctIndex:0},
      {text:"低温環境で注意すべき症状は？",choices:["低体温症","日焼けだけ","花粉症だけ"],correctIndex:0},
      {text:"冬季の屋外活動で適切なのは？",choices:["防寒と水分補給を行う","汗をかいても放置する","体調不良を我慢する"],correctIndex:0}
    ]
  };

  defaults.golem = {
    kids: [
      {text:"森の植物を守る行動は？",choices:["道から外れない","枝を折る","花を全部摘む"],correctIndex:0},
      {text:"野生動物を見つけたら？",choices:["離れて観察する","追いかける","餌をあげる"],correctIndex:0},
      {text:"森にごみを残してはいけない理由は？",choices:["自然や動物を守るため","木を高くするため","雨を止めるため"],correctIndex:0}
    ],
    adult: [
      {text:"生態系保全で重要な行動は？",choices:["外来種を持ち込まない","野生動物へ餌を与える","植物を持ち帰る"],correctIndex:0},
      {text:"遊歩道利用の主な目的は？",choices:["安全確保と植生保護","移動を複雑にする","音を増やす"],correctIndex:0},
      {text:"森林の水源涵養機能とは？",choices:["雨水を蓄え流出を緩和する","雨を完全に止める","海水を淡水に変える"],correctIndex:0}
    ]
  };

  console.log("問題管理画面を8体対応にしました。");
})();