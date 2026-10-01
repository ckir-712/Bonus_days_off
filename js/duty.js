(function (global) {
  function state() { return global.DutyApp.state.getState(); }

  function types() {
    return state().dutyTypes.slice();
  }

  function typeById(id) {
    return types().find(function (t) { return t.id === id; });
  }

  function saveType(record) {
    global.DutyApp.state.mutate(function (st) {
      var idx = st.dutyTypes.findIndex(function (t) { return t.id === record.id; });
      if (idx >= 0) st.dutyTypes[idx] = record;
      else st.dutyTypes.push(record);
    }, "근무 종류 저장");
  }

  function removeType(id) {
    if (id === "cctv" || id === "watch" || id === "kitchen" || id === "guard") return;
    global.DutyApp.state.mutate(function (st) {
      st.dutyTypes = st.dutyTypes.filter(function (t) { return t.id !== id; });
    }, "근무 종류 삭제");
  }

  function schedules() {
    return state().dutySchedules.slice();
  }

  function saveSchedule(record) {
    if (!record.id) record.id = global.DutyApp.state.uid("S");
    global.DutyApp.state.mutate(function (st) {
      var idx = st.dutySchedules.findIndex(function (s) { return s.id === record.id; });
      if (idx >= 0) st.dutySchedules[idx] = record;
      else st.dutySchedules.push(record);
    }, "근무 일정 저장");
  }

  function removeSchedule(id) {
    global.DutyApp.state.mutate(function (st) {
      st.dutySchedules = st.dutySchedules.filter(function (s) { return s.id !== id; });
    }, "근무 일정 삭제");
  }

  function assignments(filters) {
    var list = state().assignments.slice();
    filters = filters || {};
    if (filters.date) list = list.filter(function (a) { return a.date === filters.date; });
    if (filters.dutyTypeId) list = list.filter(function (a) { return a.dutyTypeId === filters.dutyTypeId; });
    if (filters.personId) list = list.filter(function (a) { return a.personId === filters.personId; });
    return list.sort(function (a, b) {
      return (a.date + a.startTime).localeCompare(b.date + b.startTime);
    });
  }

  function saveAssignment(record, historyText) {
    if (!record.id) record.id = global.DutyApp.state.uid("A");
    if (!record.source) record.source = "manual";
    global.DutyApp.state.mutate(function (st) {
      var idx = st.assignments.findIndex(function (a) { return a.id === record.id; });
      if (idx >= 0) st.assignments[idx] = record;
      else st.assignments.push(record);
    }, historyText || "근무 배정 저장");
  }

  function removeAssignment(id) {
    global.DutyApp.state.mutate(function (st) {
      st.assignments = st.assignments.filter(function (a) { return a.id !== id; });
    }, "근무 배정 삭제");
  }

  function restrictionOnDate(person, date) {
    if (!person) return "인원 없음";
    if (global.DutyApp.dispatch.personOnDate(person.id, date)) return "파견";
    if (global.DutyApp.leave.personOnDate(person.id, date)) return "휴가";
    if (person.status === "training") return "교육";
    if (person.status === "medical") return "근무제한";
    if (person.status === "dispatch") return "파견";
    if (person.status === "leave") return "휴가";
    if (person.restrictions && person.restrictions.indexOf(date) >= 0) return "근무제한";
    return null;
  }

  function hasSkill(person, dutyType) {
    if (!dutyType || !dutyType.skill) return true;
    return person.skills && person.skills.indexOf(dutyType.skill) >= 0;
  }

  function overlappingAssignments(personId, date, startTime, endTime, ignoreId, extraAssignments) {
    var list = (extraAssignments || state().assignments).filter(function (a) {
      return a.personId === personId && a.date === date && a.id !== ignoreId;
    });
    return list.filter(function (a) {
      return global.DutyApp.calendar.timesOverlap(startTime, endTime, a.startTime, a.endTime);
    });
  }

  function consecutiveCount(personId, date, extraAssignments) {
    var list = extraAssignments || state().assignments;
    var days = 0;
    var cur = global.DutyApp.calendar.addDays(date, -1);
    while (list.some(function (a) { return a.personId === personId && a.date === cur; })) {
      days += 1;
      cur = global.DutyApp.calendar.addDays(cur, -1);
    }
    return days;
  }

  function isAvailableForDuty(personId, date, dutyType, opts) {
    opts = opts || {};
    var person = global.DutyApp.personnel.byId(personId);
    var type = typeof dutyType === "string" ? typeById(dutyType) : dutyType;
    var reasons = [];
    if (!person) {
      return { ok: false, reasons: ["존재하지 않는 인원"] };
    }
    var rest = restrictionOnDate(person, date);
    if (rest) reasons.push(rest);
    if (!hasSkill(person, type)) reasons.push("자격 없음");
    if (opts.startTime && opts.endTime) {
      var overlaps = overlappingAssignments(
        personId, date, opts.startTime, opts.endTime, opts.ignoreId, opts.assignments
      );
      if (overlaps.length) reasons.push("시간 충돌");
    }
    if (opts.checkConsecutive !== false) {
      var maxC = state().settings.maxConsecutiveDays || 2;
      var cons = consecutiveCount(personId, date, opts.assignments);
      if (cons >= maxC) reasons.push("연속근무 한도");
    }
    return { ok: reasons.length === 0, reasons: reasons, person: person };
  }

  function fairnessScore(personId, dutyTypeId, date, extraAssignments) {
    var list = extraAssignments || state().assignments;
    var recentFrom = global.DutyApp.calendar.addDays(date, -14);
    var total = 0, same = 0, recent = 0, recentSame = 0, holiday = 0;
    list.forEach(function (a) {
      if (a.personId !== personId) return;
      total += 1;
      if (a.dutyTypeId === dutyTypeId) same += 1;
      if (a.date >= recentFrom && a.date < date) {
        recent += 1;
        if (a.dutyTypeId === dutyTypeId) recentSame += 1;
      }
      if (global.DutyApp.holiday.isHoliday(a.date)) holiday += 1;
    });
    var cons = consecutiveCount(personId, date, list);
    return total * 4 + same * 6 + recent * 3 + recentSame * 4 + cons * 8 + holiday * 2;
  }

  function pickBest(candidates, date, dutyTypeId, extraAssignments) {
    return candidates.slice().sort(function (a, b) {
      return fairnessScore(a, dutyTypeId, date, extraAssignments) - fairnessScore(b, dutyTypeId, date, extraAssignments);
    });
  }

  global.DutyApp.duty = {
    types: types,
    typeById: typeById,
    saveType: saveType,
    removeType: removeType,
    schedules: schedules,
    saveSchedule: saveSchedule,
    removeSchedule: removeSchedule,
    assignments: assignments,
    saveAssignment: saveAssignment,
    removeAssignment: removeAssignment,
    restrictionOnDate: restrictionOnDate,
    isAvailableForDuty: isAvailableForDuty,
    overlappingAssignments: overlappingAssignments,
    consecutiveCount: consecutiveCount,
    fairnessScore: fairnessScore,
    pickBest: pickBest
  };
})(window);
