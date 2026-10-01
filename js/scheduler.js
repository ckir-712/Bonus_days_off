(function (global) {
  var lastPreview = null;

  function defaultNeeds(date) {
    var list = [];
    global.DutyApp.cctv.neededOn(date).forEach(function (n) { list.push(n); });
    global.DutyApp.watch.neededOn(date).forEach(function (n) { list.push(n); });
    global.DutyApp.kitchen.neededOn(date).forEach(function (n) { list.push(n); });
    global.DutyApp.guard.neededOn(date).forEach(function (n) { list.push(n); });
    global.DutyApp.duty.schedules().filter(function (s) {
      return s.date === date && s.dutyTypeId === "other";
    }).forEach(function (s) { list.push(s); });
    return list;
  }

  function assignNeed(need, pool, working) {
    var result = { created: [], shortage: null, notes: [] };
    var alreadyList = working.filter(function (a) {
      return a.date === need.date && a.dutyTypeId === need.dutyTypeId && a.startTime === need.startTime && a.endTime === need.endTime;
    });
    var already = alreadyList.length;
    var remain = Math.max(0, (need.requiredPersonnel || 1) - already);
    var used = {};
    alreadyList.forEach(function (a) { used[a.personId] = true; });
    var rotation = need.dutyTypeId === "cctv" || need.dutyTypeId === "watch";
    var i;
    for (i = 0; i < remain; i++) {
      var candidates = pool.filter(function (id) {
        if (used[id]) return false;
        return global.DutyApp.duty.isAvailableForDuty(id, need.date, need.dutyTypeId, {
          startTime: need.startTime,
          endTime: need.endTime,
          assignments: working,
          checkConsecutive: !rotation
        }).ok;
      });
      if (rotation) {
        candidates.sort(function (a, b) {
          function n(id) {
            return working.filter(function (x) { return x.personId === id && x.dutyTypeId === need.dutyTypeId; }).length;
          }
          return n(a) - n(b);
        });
      } else {
        candidates = global.DutyApp.duty.pickBest(candidates, need.date, need.dutyTypeId, working);
      }
      var pick = candidates[0];
      if (!pick) {
        result.shortage = {
          date: need.date,
          dutyTypeId: need.dutyTypeId,
          slot: need.slot || (need.startTime + "~" + need.endTime),
          required: need.requiredPersonnel,
          available: already + i,
          missing: remain - i,
          message: "근무 가능 인원 부족\n" + need.date + "\n" + (global.DutyApp.duty.typeById(need.dutyTypeId) || {}).name + "\n필요: " + need.requiredPersonnel + "명\n가능: " + (already + i) + "명\n" + (remain - i) + "명 부족합니다."
        };
        break;
      }
      used[pick] = true;
      result.created.push({
        id: global.DutyApp.state.uid("A"),
        date: need.date,
        dutyTypeId: need.dutyTypeId,
        personId: pick,
        startTime: need.startTime,
        endTime: need.endTime,
        slot: need.slot || "",
        source: "auto"
      });
      working.push(result.created[result.created.length - 1]);
    }
    return result;
  }

  function run(startDate, endDate, apply) {
    var st = global.DutyApp.state.getState();
    var protect = !!st.settings.protectManualAssignments;
    var dates = global.DutyApp.calendar.rangeDates(startDate, endDate);
    var kept = st.assignments.filter(function (a) {
      if (a.date < startDate || a.date > endDate) return true;
      return protect && a.source === "manual";
    });
    var working = global.DutyApp.state.clone(kept);
    var created = [];
    var shortages = [];
    var notes = [];

    dates.forEach(function (date) {
      global.DutyApp.holiday.isHoliday(date);
      global.DutyApp.cctv.cycleInfo(date);
      global.DutyApp.leave.onDate(date);
      global.DutyApp.dispatch.onDate(date);

      var cctvNeeds = global.DutyApp.cctv.neededOn(date);
      var watchNeeds = global.DutyApp.watch.neededOn(date);
      cctvNeeds.forEach(function (need) {
        var pool = global.DutyApp.cctv.availableMembers(date, "cctv");
        var r = assignNeed(need, pool, working);
        created = created.concat(r.created);
        if (r.shortage) shortages.push(r.shortage);
      });
      watchNeeds.forEach(function (need) {
        var pool = global.DutyApp.cctv.availableMembers(date, "watch");
        var r = assignNeed(need, pool, working);
        created = created.concat(r.created);
        if (r.shortage) shortages.push(r.shortage);
      });

      var general = []
        .concat(global.DutyApp.kitchen.neededOn(date))
        .concat(global.DutyApp.guard.neededOn(date))
        .concat(global.DutyApp.duty.schedules().filter(function (s) {
          return s.date === date && s.dutyTypeId !== "cctv" && s.dutyTypeId !== "watch" && s.dutyTypeId !== "kitchen" && s.dutyTypeId !== "guard";
        }));
      general.forEach(function (need) {
        var pool = global.DutyApp.personnel.list().map(function (p) { return p.id; });
        var r = assignNeed(need, pool, working);
        created = created.concat(r.created);
        if (r.shortage) shortages.push(r.shortage);
      });
    });

    st.replacements.forEach(function (rep) {
      if (rep.date < startDate || rep.date > endDate) return;
      global.DutyApp.replacement.applyOne(rep, working);
    });

    var validation = global.DutyApp.validation.run(working, { startDate: startDate, endDate: endDate });
    var summary = {
      total: created.length,
      ok: created.length - shortages.length,
      warn: validation.warnings.length,
      unassigned: shortages.length,
      conflict: validation.errors.length
    };

    lastPreview = {
      startDate: startDate,
      endDate: endDate,
      assignments: working,
      created: created,
      shortages: shortages,
      notes: notes,
      validation: validation,
      summary: summary
    };

    if (apply) {
      global.DutyApp.state.snapshotForUndo();
      global.DutyApp.state.mutate(function (s) {
        s.assignments = working;
        s.shortages = shortages;
      }, "자동배정 적용 " + startDate + " ~ " + endDate);
    }

    return lastPreview;
  }

  function getPreview() {
    return lastPreview;
  }

  global.DutyApp.scheduler = {
    run: run,
    getPreview: getPreview,
    defaultNeeds: defaultNeeds
  };
})(window);
