(function (global) {
  var Cal = function () { return global.DutyApp.calendar; };

  function list() {
    return global.DutyApp.state.getState().dispatches.slice();
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
    if (!record.id) record.id = global.DutyApp.state.uid("D");
    record.type = "dispatch";
    global.DutyApp.state.mutate(function (st) {
      var idx = st.dispatches.findIndex(function (x) { return x.id === record.id; });
      if (idx >= 0) st.dispatches[idx] = record;
      else st.dispatches.push(record);
      var p = st.personnel.find(function (x) { return x.id === record.personId; });
      if (p) p.status = "dispatch";
    }, "파견 등록/수정");
  }

  function remove(id) {
    global.DutyApp.state.mutate(function (st) {
      var rec = st.dispatches.find(function (x) { return x.id === id; });
      st.dispatches = st.dispatches.filter(function (x) { return x.id !== id; });
      if (rec) {
        var still = st.dispatches.some(function (x) { return x.personId === rec.personId; });
        var p = st.personnel.find(function (x) { return x.id === rec.personId; });
        if (p && !still && p.status === "dispatch") p.status = "active";
      }
    }, "파견 삭제");
  }

  global.DutyApp.dispatch = {
    list: list,
    covers: covers,
    onDate: onDate,
    personOnDate: personOnDate,
    save: save,
    remove: remove
  };
})(window);
