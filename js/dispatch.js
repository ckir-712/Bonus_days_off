(function (global) {
  var Cal = function () { return global.DutyApp.calendar; };

  function state() {
    return global.DutyApp.state.getState();
  }

  function list() {
    return (state().dispatches || []).slice();
  }

  function archive() {
    return (state().dispatchArchive || []).slice();
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

  function syncStatus(st, today) {
    st.personnel.forEach(function (p) {
      var on = (st.dispatches || []).some(function (d) {
        return d.personId === p.id && d.startDate <= today && d.endDate >= today;
      });
      if (on) p.status = "dispatch";
      else if (p.status === "dispatch") p.status = "active";
    });
  }

  function needsStatusSync(st, today) {
    return st.personnel.some(function (p) {
      var on = (st.dispatches || []).some(function (d) {
        return d.personId === p.id && d.startDate <= today && d.endDate >= today;
      });
      if (on && p.status !== "dispatch") return true;
      if (!on && p.status === "dispatch") return true;
      return false;
    });
  }

  function archiveEnded() {
    var today = Cal().today();
    var st = state();
    var ended = (st.dispatches || []).filter(function (d) { return d.endDate && d.endDate < today; });
    if (!ended.length && !needsStatusSync(st, today)) return 0;
    global.DutyApp.state.mutate(function (s) {
      var now = Cal().today();
      var keep = [];
      s.dispatchArchive = s.dispatchArchive || [];
      (s.dispatches || []).forEach(function (d) {
        if (d.endDate && d.endDate < now) {
          var copy = global.DutyApp.state.clone(d);
          copy.archivedOn = now;
          s.dispatchArchive.push(copy);
        } else {
          keep.push(d);
        }
      });
      s.dispatches = keep;
      syncStatus(s, now);
    }, ended.length ? (ended.length + "건 파견 종료 · 이전 기록으로 이동") : "파견 상태 동기화");
    return ended.length;
  }

  function currentList() {
    var today = Cal().today();
    return list().filter(function (d) { return d.startDate <= today && d.endDate >= today; });
  }

  function upcomingList() {
    var today = Cal().today();
    return list().filter(function (d) { return d.startDate > today; });
  }

  function archiveByMonth() {
    var groups = {};
    archive().forEach(function (d) {
      Cal().monthsBetween(d.startDate, d.endDate).forEach(function (key) {
        groups[key] = groups[key] || [];
        groups[key].push(d);
      });
    });
    return groups;
  }

  function save(record) {
    if (!record.id) record.id = global.DutyApp.state.uid("D");
    record.type = "dispatch";
    global.DutyApp.state.mutate(function (st) {
      var idx = st.dispatches.findIndex(function (x) { return x.id === record.id; });
      if (idx >= 0) st.dispatches[idx] = record;
      else st.dispatches.push(record);
      syncStatus(st, Cal().today());
    }, "파견 등록/수정");
    archiveEnded();
  }

  function remove(id) {
    global.DutyApp.state.mutate(function (st) {
      st.dispatches = st.dispatches.filter(function (x) { return x.id !== id; });
      syncStatus(st, Cal().today());
    }, "파견 삭제");
  }

  global.DutyApp.dispatch = {
    list: list,
    archive: archive,
    covers: covers,
    onDate: onDate,
    personOnDate: personOnDate,
    archiveEnded: archiveEnded,
    currentList: currentList,
    upcomingList: upcomingList,
    archiveByMonth: archiveByMonth,
    save: save,
    remove: remove
  };
})(window);
