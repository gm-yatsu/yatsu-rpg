(() => {
  if (typeof stageNames === "undefined") return;

  Object.assign(stageNames, {
    star: "星降るウィザード",
    wolf: "雪原のホワイトウルフ",
    golem: "森のゴーレム"
  });

  const select = document.getElementById("stageFilter");
  if (select) {
    [
      ["star","星降るウィザード"],
      ["wolf","雪原のホワイトウルフ"],
      ["golem","森のゴーレム"]
    ].forEach(([value,label]) => {
      if (![...select.options].some(option => option.value === value)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      }
    });
  }

  if (typeof render === "function") render();
})();