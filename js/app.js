(function (global) {
  function boot() {
    global.DutyApp.state.load();
    global.DutyApp.ui.init();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
