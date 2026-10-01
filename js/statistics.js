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

  global.DutyApp.statistics = { personStats: personStats, groupStats: groupStats };
})(window);
