(function (global) {
  function list() {
    return global.DutyApp.state.getState().replacements.slice();
  }

  function applyOne(rec, assignments) {
    assignments = assignments || global.DutyApp.state.getState().assignments;
    var found = assignments.find(function (a) {
      return a.personId === rec.originalPersonId && a.date === rec.date && a.dutyTypeId === rec.dutyId;
    });
    if (!found) return { ok: false, reason: "원 근무를 찾을 수 없음" };
    var check = global.DutyApp.duty.isAvailableForDuty(rec.replacementPersonId, rec.date, rec.dutyId, {
      startTime: found.startTime,
      endTime: found.endTime,
      ignoreId: found.id,
      assignments: assignments
    });
    if (!check.ok) return { ok: false, reason: check.reasons.join(", ") };
    found.personId = rec.replacementPersonId;
    found.source = found.source === "auto" ? "auto" : "manual";
    found.replacedFrom = rec.originalPersonId;
    return { ok: true, assignment: found };
  }

  function save(record) {
    if (!record.id) record.id = global.DutyApp.state.uid("R");
    var result = applyOne(record);
    if (!result.ok) return result;
    global.DutyApp.state.mutate(function (st) {
      var idx = st.replacements.findIndex(function (x) { return x.id === record.id; });
      if (idx >= 0) st.replacements[idx] = record;
      else st.replacements.push(record);
      var a = st.assignments.find(function (x) { return x.id === result.assignment.id; });
      if (a) {
        a.personId = record.replacementPersonId;
        a.replacedFrom = record.originalPersonId;
      }
    }, "근무대체 적용");
    return { ok: true };
  }

  function remove(id) {
    global.DutyApp.state.mutate(function (st) {
      st.replacements = st.replacements.filter(function (x) { return x.id !== id; });
    }, "근무대체 삭제");
  }

  global.DutyApp.replacement = {
    list: list,
    applyOne: applyOne,
    save: save,
    remove: remove
  };
})(window);
