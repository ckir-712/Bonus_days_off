(function (global) {
  function run(assignments, range) {
    var st = global.DutyApp.state.getState();
    assignments = assignments || st.assignments;
    range = range || {};
    var errors = [];
    var warnings = [];
    var peopleIds = {};
    st.personnel.forEach(function (p) { peopleIds[p.id] = true; });
    var dutyIds = {};
    st.dutyTypes.forEach(function (t) { dutyIds[t.id] = true; });

    var rot = st.rotationSettings;
    if (!rot.startDate || !rot.cycleDays || rot.cycleDays < 1) {
      errors.push({ code: "rotation", message: "교대주기 설정이 올바르지 않습니다." });
    }
    var aCount = (st.dutyGroups.cctv || []).length;
    var bCount = (st.dutyGroups.watch || []).length;
    if (aCount + bCount === 0) {
      warnings.push({ code: "groups", message: "CCTV/불침번 조가 편성되지 않았습니다." });
    } else if (Math.abs(aCount - bCount) > 1) {
      warnings.push({ code: "groups", message: "조 인원 차이가 1명을 넘습니다. A:" + aCount + " B:" + bCount });
    }

    assignments.forEach(function (a) {
      if (range.startDate && (a.date < range.startDate || a.date > range.endDate)) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) {
        errors.push({ code: "date", message: "잘못된 날짜: " + a.date, assignment: a });
      }
      if (!peopleIds[a.personId]) {
        errors.push({ code: "person", message: "존재하지 않는 인원 " + a.personId, assignment: a });
        return;
      }
      if (!dutyIds[a.dutyTypeId]) {
        errors.push({ code: "duty", message: "존재하지 않는 근무 " + a.dutyTypeId, assignment: a });
      }
      var person = global.DutyApp.personnel.byId(a.personId);
      var rest = global.DutyApp.duty.restrictionOnDate(person, a.date);
      if (rest === "파견") {
        errors.push({
          code: "dispatch",
          message: "오류\n" + person.name + "\n" + a.date + "\n상태: 파견\n배정된 근무: " + ((global.DutyApp.duty.typeById(a.dutyTypeId) || {}).name || a.dutyTypeId) + " " + a.startTime + "~" + a.endTime + "\n파견 기간과 근무일이 중복됩니다.",
          assignment: a
        });
      } else if (rest === "휴가") {
        errors.push({ code: "leave", message: person.name + " 휴가 중 근무 (" + a.date + ")", assignment: a });
      } else if (rest === "교육") {
        errors.push({ code: "training", message: person.name + " 교육 중 근무 (" + a.date + ")", assignment: a });
      } else if (rest) {
        errors.push({ code: "restrict", message: person.name + " " + rest + " 중 근무 (" + a.date + ")", assignment: a });
      }
      var type = global.DutyApp.duty.typeById(a.dutyTypeId);
      if (type && type.skill && (!person.skills || person.skills.indexOf(type.skill) < 0)) {
        errors.push({ code: "skill", message: person.name + " 근무 자격 오류 (" + type.name + ")", assignment: a });
      }
      if (a.dutyTypeId === "cctv" || a.dutyTypeId === "watch") {
        var role = global.DutyApp.cctv.roleOfPerson(a.personId, a.date);
        if (role && role !== a.dutyTypeId) {
          warnings.push({ code: "group-role", message: person.name + "은(는) 해당일 담당 조가 아닌데 " + a.dutyTypeId + "에 배정됨", assignment: a });
        }
      }
    });

    var byPersonDate = {};
    assignments.forEach(function (a) {
      if (range.startDate && (a.date < range.startDate || a.date > range.endDate)) return;
      var key = a.personId + "|" + a.date;
      byPersonDate[key] = byPersonDate[key] || [];
      byPersonDate[key].push(a);
    });
    Object.keys(byPersonDate).forEach(function (key) {
      var list = byPersonDate[key];
      var i, j;
      for (i = 0; i < list.length; i++) {
        for (j = i + 1; j < list.length; j++) {
          if (global.DutyApp.calendar.timesOverlap(list[i].startTime, list[i].endTime, list[j].startTime, list[j].endTime)) {
            var p = global.DutyApp.personnel.label(list[i].personId);
            errors.push({
              code: "overlap",
              message: p + " 동일 시간 중복 (" + list[i].date + " " + list[i].dutyTypeId + "/" + list[j].dutyTypeId + ")",
              assignment: list[i]
            });
          }
        }
      }
    });

    st.replacements.forEach(function (r) {
      var check = global.DutyApp.duty.isAvailableForDuty(r.replacementPersonId, r.date, r.dutyId, { assignments: assignments });
      if (!check.ok) {
        errors.push({ code: "replacement", message: "대체자 충돌: " + global.DutyApp.personnel.label(r.replacementPersonId) + " / " + r.date + " / " + check.reasons.join(", ") });
      }
    });

    var maxC = st.settings.maxConsecutiveDays || 2;
    st.personnel.forEach(function (p) {
      var days = {};
      assignments.forEach(function (a) {
        if (a.personId === p.id) days[a.date] = true;
      });
      var sorted = Object.keys(days).sort();
      var runLen = 1;
      var i;
      for (i = 1; i < sorted.length; i++) {
        if (global.DutyApp.calendar.dateDiff(sorted[i - 1], sorted[i]) === 1) runLen += 1;
        else runLen = 1;
        if (runLen > maxC) {
          warnings.push({ code: "consecutive", message: p.name + " 과도한 연속근무 (" + runLen + "일)" });
          break;
        }
      }
    });

    return { valid: errors.length === 0, errors: errors, warnings: warnings };
  }

  global.DutyApp.validation = { run: run };
})(window);
