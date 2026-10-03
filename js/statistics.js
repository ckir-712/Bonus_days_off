(function (global) {
  function personStats(startDate, endDate) {
    var list = global.DutyApp.state.getState().assignments.filter(function (a) {
      return (!startDate || a.date >= startDate) && (!endDate || a.date <= endDate);
    });
    return global.DutyApp.personnel.list().map(function (p) {
      var mine = list.filter(function (a) { return a.personId === p.id; });
      function c(type) { return mine.filter(function (a) { return a.dutyTypeId === type; }).length; }
      return {
        id: p.id,
        name: p.name,
        rank: p.rank,
        total: mine.length,
        cctv: c("cctv"),
        watch: c("watch"),
        kitchen: c("kitchen"),
        guard: c("guard"),
        other: c("other"),
        holiday: mine.filter(function (a) { return global.DutyApp.holiday.isHoliday(a.date); }).length
      };
    });
  }

  function groupStats(fromDate) {
    var rot = global.DutyApp.state.getState().rotationSettings;
    var start = fromDate || rot.startDate;
    var cycleDays = rot.cycleDays || 45;
    var aCctv = 0, aWatch = 0, bCctv = 0, bWatch = 0;
    var i;
    for (i = 0; i < 4; i++) {
      var cyc = i;
      var len = cycleDays;
      if (cyc % 2 === 0) { aCctv += len; bWatch += len; }
      else { aWatch += len; bCctv += len; }
    }
    return [
      { group: "A조", name: global.DutyApp.state.getState().groupMeta.A, cctvDays: aCctv, watchDays: aWatch, start: start },
      { group: "B조", name: global.DutyApp.state.getState().groupMeta.B, cctvDays: bCctv, watchDays: bWatch, start: start }
    ];
  }

  function monthlyDutyCounts(dutyTypeId, monthKey) {
    var list = global.DutyApp.state.getState().assignments.filter(function (a) {
      return a.dutyTypeId === dutyTypeId && a.date.slice(0, 7) === monthKey;
    });
    return global.DutyApp.personnel.list().map(function (p) {
      var mine = list.filter(function (a) { return a.personId === p.id; });
      var byBucket = { weekday: 0, friday: 0, weekend: 0 };
      var bySlot = {};
      mine.forEach(function (a) {
        var bucket = a.bucket;
        if (!bucket && dutyTypeId === "cctv") bucket = global.DutyApp.cctv.nextDayBucket(a.date);
        if (!bucket && dutyTypeId === "kitchen") bucket = global.DutyApp.holiday.kitchenDayKind(a.date);
        if (bucket && byBucket[bucket] !== undefined) byBucket[bucket] += 1;
        var key = a.slotKey || a.slot || "근무";
        var label = a.slot || key;
        if (!bySlot[key]) bySlot[key] = { label: label, weekday: 0, friday: 0, weekend: 0, all: 0 };
        if (bucket && bySlot[key][bucket] !== undefined) bySlot[key][bucket] += 1;
        bySlot[key].all += 1;
      });
      return {
        id: p.id,
        name: p.name,
        rank: p.rank,
        total: mine.length,
        byBucket: byBucket,
        bySlot: bySlot
      };
    }).sort(function (a, b) {
      if (a.total !== b.total) return a.total - b.total;
      return a.name.localeCompare(b.name, "ko");
    });
  }

  global.DutyApp.statistics = {
    personStats: personStats,
    groupStats: groupStats,
    monthlyDutyCounts: monthlyDutyCounts
  };
})(window);
