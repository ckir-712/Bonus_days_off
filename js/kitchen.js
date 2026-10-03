(function (global) {
  function type() {
    return global.DutyApp.duty.typeById("kitchen");
  }

  function items() {
    var t = type();
    return ((t && t.items) || []).slice();
  }

  function slots() {
    return items();
  }

  function dayKind(date) {
    return global.DutyApp.holiday.kitchenDayKind(date);
  }

  function kindLabel(kind) {
    return kind === "weekend" ? "주말" : "평일";
  }

  function neededOn(date) {
    var kind = dayKind(date);
    return items().map(function (item) {
      return {
        dutyTypeId: "kitchen",
        date: date,
        startTime: "",
        endTime: "",
        requiredPersonnel: item.requiredPersonnel,
        slot: item.label,
        slotKey: item.id,
        bucket: kind,
        monthKey: date.slice(0, 7),
        fairMode: "kitchen",
        timed: false
      };
    });
  }

  global.DutyApp.kitchen = {
    items: items,
    slots: slots,
    dayKind: dayKind,
    kindLabel: kindLabel,
    neededOn: neededOn
  };
})(window);
