(function (global) {
  function slots() {
    return global.DutyApp.state.getState().settings.kitchenSlots || [];
  }

  function neededOn(date) {
    var extra = global.DutyApp.duty.schedules().filter(function (s) {
      return s.dutyTypeId === "kitchen" && s.date === date;
    });
    if (extra.length) return extra;
    return slots().map(function (s) {
      return {
        dutyTypeId: "kitchen",
        date: date,
        startTime: s.startTime,
        endTime: s.endTime,
        requiredPersonnel: s.requiredPersonnel,
        slot: s.label || s.id || "아침"
      };
    });
  }

  global.DutyApp.kitchen = { slots: slots, neededOn: neededOn };
})(window);
