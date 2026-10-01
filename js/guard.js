(function (global) {
  function slots() {
    return global.DutyApp.state.getState().settings.guardSlots || [];
  }

  function neededOn(date) {
    var extra = global.DutyApp.duty.schedules().filter(function (s) {
      return s.dutyTypeId === "guard" && s.date === date;
    });
    if (extra.length) return extra;
    return slots().map(function (s) {
      return {
        dutyTypeId: "guard",
        date: date,
        startTime: s.startTime,
        endTime: s.endTime,
        requiredPersonnel: s.requiredPersonnel,
        slot: s.label || "야간"
      };
    });
  }

  global.DutyApp.guard = { slots: slots, neededOn: neededOn };
})(window);
