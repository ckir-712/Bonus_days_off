(function (global) {
  var S = function () { return global.DutyApp.state.getState(); };

  function list() {
    return S().personnel.slice().sort(function (a, b) {
      return a.id.localeCompare(b.id);
    });
  }

  function byId(id) {
    return S().personnel.find(function (p) { return p.id === id; });
  }

  function label(id) {
    var p = byId(id);
    return p ? (p.rank + " " + p.name) : id;
  }

  function nextId() {
    var max = 0;
    S().personnel.forEach(function (p) {
      var n = Number(String(p.id).replace(/\D/g, ""));
      if (n > max) max = n;
    });
    return "P" + String(max + 1).padStart(3, "0");
  }

  function save(person) {
    global.DutyApp.state.mutate(function (st) {
      var idx = st.personnel.findIndex(function (p) { return p.id === person.id; });
      if (idx >= 0) st.personnel[idx] = person;
      else st.personnel.push(person);
    }, "인원 저장: " + person.name);
  }

  function remove(id) {
    var p = byId(id);
    global.DutyApp.state.mutate(function (st) {
      st.personnel = st.personnel.filter(function (x) { return x.id !== id; });
      st.dutyGroups.cctv = st.dutyGroups.cctv.filter(function (x) { return x !== id; });
      st.dutyGroups.watch = st.dutyGroups.watch.filter(function (x) { return x !== id; });
    }, "인원 삭제: " + (p ? p.name : id));
  }

  function companies() {
    var set = {};
    S().personnel.forEach(function (p) { if (p.company) set[p.company] = true; });
    return Object.keys(set);
  }

  global.DutyApp.personnel = {
    list: list,
    byId: byId,
    label: label,
    nextId: nextId,
    save: save,
    remove: remove,
    companies: companies
  };
})(window);
