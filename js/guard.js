(function (global) {
  function shifts() {
    var type = global.DutyApp.duty.typeById("guard");
    return ((type && type.shifts) || []).slice().sort(function (a, b) { return Number(a.order) - Number(b.order); });
  }

  function slots() {
    return shifts();
  }

  function neededOn(date) {
    var extra = global.DutyApp.duty.schedules().filter(function (s) {
      return s.dutyTypeId === "guard" && s.date === date;
    });
    if (extra.length) {
      return extra.map(function (s) {
        return {
          dutyTypeId: "guard",
          date: date,
          startTime: s.startTime,
          endTime: s.endTime,
          requiredPersonnel: s.requiredPersonnel,
          slot: s.slot || (s.startTime + "~" + s.endTime),
          slotKey: s.id,
          monthKey: date.slice(0, 7),
          fairMode: "general"
        };
      });
    }
    return shifts().map(function (s) {
      return {
        dutyTypeId: "guard",
        date: date,
        startTime: s.startTime,
        endTime: s.endTime,
        requiredPersonnel: s.requiredPersonnel,
        slot: s.label,
        slotKey: s.id,
        order: s.order,
        monthKey: date.slice(0, 7),
        fairMode: "general"
      };
    });
  }

  global.DutyApp.guard = { shifts: shifts, slots: slots, neededOn: neededOn };
})(window);
