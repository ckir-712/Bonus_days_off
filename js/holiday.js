(function (global) {
  function list() {
    return global.DutyApp.state.getState().holidays.slice().sort(function (a, b) {
      return a.date.localeCompare(b.date);
    });
  }

  function onDate(date) {
    return list().filter(function (h) { return h.date === date; });
  }

  function isWeekend(date) {
    var d = global.DutyApp.calendar.weekday(date);
    return d === 0 || d === 6;
  }

  function isHoliday(date) {
    return onDate(date).length > 0 || isWeekend(date);
  }

  function names(date) {
    var extra = onDate(date).map(function (h) { return h.name; });
    if (isWeekend(date) && extra.length === 0) {
      extra.push(global.DutyApp.calendar.weekday(date) === 0 ? "일요일" : "토요일");
    }
    return extra;
  }

  function save(record) {
    global.DutyApp.state.mutate(function (st) {
      var idx = st.holidays.findIndex(function (h) { return h.date === record.date && h.name === record.name; });
      if (idx >= 0) st.holidays[idx] = record;
      else st.holidays.push(record);
    }, "휴일 저장: " + record.name);
  }

  function remove(date, name) {
    global.DutyApp.state.mutate(function (st) {
      st.holidays = st.holidays.filter(function (h) { return !(h.date === date && h.name === name); });
    }, "휴일 삭제");
  }

  global.DutyApp.holiday = {
    list: list,
    onDate: onDate,
    isWeekend: isWeekend,
    isHoliday: isHoliday,
    names: names,
    save: save,
    remove: remove
  };
})(window);
