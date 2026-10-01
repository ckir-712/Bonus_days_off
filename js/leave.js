(function (global) {
  var Cal = function () { return global.DutyApp.calendar; };

  function list() {
    return global.DutyApp.state.getState().leaves.slice();
  }

  function covers(record, date) {
    return Cal().inRange(date, record.startDate, record.endDate);
  }

  function onDate(date) {
    return list().filter(function (r) { return covers(r, date); });
  }

  function personOnDate(personId, date) {
    return list().some(function (r) { return r.personId === personId && covers(r, date); });
  }

  function save(record) {
    if (!record.id) record.id = global.DutyApp.state.uid("L");
    record.type = "leave";
    global.DutyApp.state.mutate(function (st) {
      var idx = st.leaves.findIndex(function (x) { return x.id === record.id; });
      if (idx >= 0) st.leaves[idx] = record;
      else st.leaves.push(record);
    }, "휴가 등록/수정");
  }

  function remove(id) {
    global.DutyApp.state.mutate(function (st) {
      st.leaves = st.leaves.filter(function (x) { return x.id !== id; });
    }, "휴가 삭제");
  }

  global.DutyApp.leave = {
    list: list,
    covers: covers,
    onDate: onDate,
    personOnDate: personOnDate,
    save: save,
    remove: remove
  };
})(window);
