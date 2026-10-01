(function (global) {
  function download(filename, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    var data = global.DutyApp.state.exportData();
    download("military-duty-backup.json", JSON.stringify(data, null, 2));
  }

  function importJson(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        global.DutyApp.state.importData(data);
        cb && cb(null);
      } catch (e) {
        cb && cb(e);
      }
    };
    reader.readAsText(file);
  }

  global.DutyApp.export = { exportJson: exportJson, importJson: importJson, download: download };
})(window);
