(function (global) {
  function state() { return global.DutyApp.state.getState(); }

  function getRotationCycle(startDate, targetDate, cycleDays) {
    cycleDays = cycleDays || 45;
    var days = global.DutyApp.calendar.dateDiff(startDate, targetDate);
    if (days < 0) return null;
    return Math.floor(days / cycleDays);
  }

  function getDutyGroupRoles(cycle) {
    if (cycle === null || cycle === undefined) return null;
    if (cycle % 2 === 0) return { groupA: "cctv", groupB: "watch" };
    return { groupA: "watch", groupB: "cctv" };
  }

  function cycleInfo(date) {
    var rot = state().rotationSettings;
    var cycle = getRotationCycle(rot.startDate, date, rot.cycleDays);
    var roles = getDutyGroupRoles(cycle);
    if (cycle === null) {
      return { cycle: null, roles: null, periodStart: null, periodEnd: null, nextRotation: rot.startDate, remaining: null };
    }
    var periodStart = global.DutyApp.calendar.addDays(rot.startDate, cycle * rot.cycleDays);
    var periodEnd = global.DutyApp.calendar.addDays(periodStart, rot.cycleDays - 1);
    var nextRotation = global.DutyApp.calendar.addDays(periodStart, rot.cycleDays);
    var remaining = global.DutyApp.calendar.dateDiff(date, nextRotation);
    return {
      cycle: cycle,
      cycleLabel: (cycle + 1) + "주기",
      roles: roles,
      periodStart: periodStart,
      periodEnd: periodEnd,
      nextRotation: nextRotation,
      remaining: remaining,
      cctvGroup: roles.groupA === "cctv" ? "A" : "B",
      watchGroup: roles.groupA === "watch" ? "A" : "B"
    };
  }

  function isRotationDay(date) {
    var rot = state().rotationSettings;
    var days = global.DutyApp.calendar.dateDiff(rot.startDate, date);
    return days >= 0 && days % rot.cycleDays === 0;
  }

  function membersOf(groupKey) {
    if (groupKey === "A" || groupKey === "cctv") return (state().dutyGroups.cctv || []).slice();
    return (state().dutyGroups.watch || []).slice();
  }

  function groupOfPerson(personId) {
    if ((state().dutyGroups.cctv || []).indexOf(personId) >= 0) return "A";
    if ((state().dutyGroups.watch || []).indexOf(personId) >= 0) return "B";
    return null;
  }

  function roleOfPerson(personId, date) {
    var g = groupOfPerson(personId);
    var info = cycleInfo(date);
    if (!g || !info.roles) return null;
    if (g === "A") return info.roles.groupA;
    return info.roles.groupB;
  }

  function groupForRole(date, role) {
    var info = cycleInfo(date);
    if (!info.roles) return [];
    if (info.roles.groupA === role) return membersOf("A");
    return membersOf("B");
  }

  function availableMembers(date, role) {
    return groupForRole(date, role).filter(function (id) {
      return global.DutyApp.duty.isAvailableForDuty(id, date, role).ok;
    });
  }

  function autoFormGroups() {
    var people = global.DutyApp.personnel.list().map(function (p) { return p.id; });
    var a = [];
    var b = [];
    people.forEach(function (id, i) {
      if (i % 2 === 0) a.push(id);
      else b.push(id);
    });
    if (Math.abs(a.length - b.length) > 1) {
      if (a.length > b.length + 1) b.push(a.pop());
      if (b.length > a.length + 1) a.push(b.pop());
    }
    global.DutyApp.state.mutate(function (st) {
      st.dutyGroups.cctv = a;
      st.dutyGroups.watch = b;
      st.settings.groupMode = "auto";
    }, "CCTV/불침번 자동 조편성");
  }

  function resetGroups() {
    global.DutyApp.state.mutate(function (st) {
      st.dutyGroups.cctv = [];
      st.dutyGroups.watch = [];
    }, "조 편성 초기화");
  }

  function movePerson(personId, toGroup) {
    global.DutyApp.state.mutate(function (st) {
      st.dutyGroups.cctv = st.dutyGroups.cctv.filter(function (x) { return x !== personId; });
      st.dutyGroups.watch = st.dutyGroups.watch.filter(function (x) { return x !== personId; });
      if (toGroup === "A") st.dutyGroups.cctv.push(personId);
      if (toGroup === "B") st.dutyGroups.watch.push(personId);
      st.settings.groupMode = "manual";
    }, "조 편성 변경");
  }

  function slots() {
    return state().settings.cctvSlots || [];
  }

  function neededOn(date) {
    return slots().map(function (s) {
      return {
        dutyTypeId: "cctv",
        date: date,
        startTime: s.startTime,
        endTime: s.endTime,
        requiredPersonnel: s.requiredPersonnel,
        slot: s.startTime + "~" + s.endTime
      };
    });
  }

  global.DutyApp.cctv = {
    getRotationCycle: getRotationCycle,
    getDutyGroupRoles: getDutyGroupRoles,
    cycleInfo: cycleInfo,
    isRotationDay: isRotationDay,
    membersOf: membersOf,
    groupOfPerson: groupOfPerson,
    roleOfPerson: roleOfPerson,
    groupForRole: groupForRole,
    availableMembers: availableMembers,
    autoFormGroups: autoFormGroups,
    resetGroups: resetGroups,
    movePerson: movePerson,
    slots: slots,
    neededOn: neededOn
  };
})(window);
