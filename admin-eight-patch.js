(() => {
  const observer = new MutationObserver(() => {
    document.querySelectorAll("#rows td").forEach(td => {
      if (td.textContent.match(/^\d+\/5$/)) {
        td.textContent = td.textContent.replace("/5", "/8");
      }
      if (td.textContent.match(/^\d+\/4$/)) {
        td.textContent = td.textContent.replace("/4", "/7");
      }
    });
  });

  const rows = document.getElementById("rows");
  if (rows) observer.observe(rows, {childList:true, subtree:true});
})();