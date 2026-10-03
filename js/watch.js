(function (global) {
  function shifts() {
    var type = global.DutyApp.duty.typeById("watch");
    return ((type && type.shifts) || []).slice().sort(function (a, b) { return Number(a.order) - Number(b.order); });
  }

  function slots() {
    return shifts();
  }

  function neededOn(date) {
    return shifts().map(function (s) {
      return {
        dutyTypeId: "watch",
        date: date,
        startTime: s.startTime,
        endTime: s.endTime,
        requiredPersonnel: s.requiredPersonnel,
        slot: s.label,
        slotKey: s.id,
        order: s.order,
        monthKey: date.slice(0, 7),
        fairMode: "watch"
      };
    });
  }

  function availableMembers(date) {
    return global.DutyApp.cctv.availableMembers(date, "watch");
  }

  global.DutyApp.watch = {
    shifts: shifts,
    slots: slots,
    neededOn: neededOn,
    availableMembers: availableMembers
  };
})(window);
