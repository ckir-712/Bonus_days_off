(function (global) {
  function slots() {
    return global.DutyApp.state.getState().settings.watchSlots || [];
  }

  function neededOn(date) {
    return slots().map(function (s) {
      return {
        dutyTypeId: "watch",
        date: date,
        startTime: s.startTime,
        endTime: s.endTime,
        requiredPersonnel: s.requiredPersonnel,
        slot: s.startTime + "~" + s.endTime
      };
    });
  }

  function availableMembers(date) {
    return global.DutyApp.cctv.availableMembers(date, "watch");
  }

  global.DutyApp.watch = {
    slots: slots,
    neededOn: neededOn,
    availableMembers: availableMembers
  };
})(window);
