(function (global) {
  var lastPreview = null;

  function sameSlot(assignment, need) {
    if (assignment.slotKey && need.slotKey && assignment.slotKey === need.slotKey) return true;
    if (assignment.startTime && need.startTime && assignment.startTime === need.startTime && assignment.endTime === need.endTime) return true;
    if (need.slot && assignment.slot && assignment.slot === need.slot) return true;
    return false;
  }

  function bucketOf(assignment) {
    if (assignment.bucket) return assignment.bucket;
    if (assignment.dutyTypeId === "cctv") return global.DutyApp.cctv.nextDayBucket(assignment.date);
    if (assignment.dutyTypeId === "kitchen") return global.DutyApp.holiday.kitchenDayKind(assignment.date);
    return "";
  }

  function monthCount(personId, need, working, matcher) {
    var month = need.monthKey || need.date.slice(0, 7);
    var n = 0;
    working.forEach(function (a) {
      if (a.personId !== personId || a.dutyTypeId !== need.dutyTypeId) return;
      if (a.date.slice(0, 7) !== month) return;
      if (!matcher || matcher(a)) n += 1;
    });
    return n;
  }

  function fairRank(personId, need, working) {
    var mode = need.fairMode || "general";
    if (mode === "cctv") {
      var itemBucket = monthCount(personId, need, working, function (a) {
        return sameSlot(a, need) && bucketOf(a) === need.bucket;
      });
      var bucketTotal = monthCount(personId, need, working, function (a) {
        return bucketOf(a) === need.bucket;
      });
      var all = monthCount(personId, need, working);
      return itemBucket * 100 + bucketTotal * 10 + all;
    }
    if (mode === "kitchen") {
      var itemKind = monthCount(personId, need, working, function (a) {
        return sameSlot(a, need) && bucketOf(a) === need.bucket;
      });
      var kindTotal = monthCount(personId, need, working, function (a) {
        return bucketOf(a) === need.bucket;
      });
      return itemKind * 100 + kindTotal * 10 + monthCount(personId, need, working);
    }
    if (mode === "watch") {
      var shiftCount = monthCount(personId, need, working, function (a) { return sameSlot(a, need); });
      return shiftCount * 100 + monthCount(personId, need, working);
    }
    return global.DutyApp.duty.fairnessScore(personId, need.dutyTypeId, need.date, working);
  }

  function needsOn(date) {
    var list = [];
    global.DutyApp.duty.types().forEach(function (t) {
      if (t.id === "cctv") {
        global.DutyApp.cctv.neededOn(date).forEach(function (n) { list.push(n); });
        return;
      }
      if (t.id === "watch") {
        global.DutyApp.watch.neededOn(date).forEach(function (n) { list.push(n); });
        return;
      }
      if (t.id === "kitchen" || t.timed === false) {
        global.DutyApp.kitchen.neededOn(date).forEach(function (n) { list.push(n); });
        return;
      }
      var extra = global.DutyApp.duty.schedules().filter(function (s) {
        return s.date === date && s.dutyTypeId === t.id;
      });
      if (extra.length) {
        extra.forEach(function (s) {
          list.push({
            dutyTypeId: t.id,
            date: date,
            startTime: s.startTime,
            endTime: s.endTime,
            requiredPersonnel: Number(s.requiredPersonnel) || 1,
            slot: global.DutyApp.duty.shiftText({ order: s.order || 1, startTime: s.startTime, endTime: s.endTime }),
            slotKey: s.id,
            monthKey: date.slice(0, 7),
            fairMode: "general"
          });
        });
        return;
      }
      (t.shifts || []).forEach(function (sh) {
        list.push({
          dutyTypeId: t.id,
          date: date,
          startTime: sh.startTime,
          endTime: sh.endTime,
          requiredPersonnel: Number(sh.requiredPersonnel) || 1,
          slot: sh.label,
          slotKey: sh.id,
          order: sh.order,
          monthKey: date.slice(0, 7),
          fairMode: "general"
        });
      });
    });
    return list;
  }

  function defaultNeeds(date) {
    return needsOn(date);
  }

  function poolFor(need) {
    if (need.dutyTypeId === "cctv" || need.dutyTypeId === "watch") {
      return global.DutyApp.cctv.availableMembers(need.date, need.dutyTypeId);
    }
    return global.DutyApp.personnel.list().map(function (p) { return p.id; });
  }

  function assignNeed(need, pool, working) {
    var result = { created: [], shortage: null };
    var alreadyList = working.filter(function (a) {
      return a.date === need.date && a.dutyTypeId === need.dutyTypeId && sameSlot(a, need);
    });
    var already = alreadyList.length;
    var remain = Math.max(0, (need.requiredPersonnel || 1) - already);
    var used = {};
    alreadyList.forEach(function (a) { used[a.personId] = true; });
    var rotation = need.dutyTypeId === "cctv" || need.dutyTypeId === "watch";
    var name = (global.DutyApp.duty.typeById(need.dutyTypeId) || {}).name || need.dutyTypeId;
    var slotLabel = need.slot || ((need.startTime && need.endTime) ? (need.startTime + "~" + need.endTime) : name);
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
      candidates.sort(function (a, b) {
        var diff = fairRank(a, need, working) - fairRank(b, need, working);
        if (diff !== 0) return diff;
        return String(a).localeCompare(String(b));
      });
      var pick = candidates[0];
      if (!pick) {
        result.shortage = {
          date: need.date,
          dutyTypeId: need.dutyTypeId,
          slot: slotLabel,
          required: need.requiredPersonnel,
          available: already + i,
          missing: remain - i,
          message: "근무 가능 인원 부족\n" + need.date + "\n" + name + " " + slotLabel + "\n필요: " + need.requiredPersonnel + "명\n가능: " + (already + i) + "명\n" + (remain - i) + "명 부족합니다."
        };
        break;
      }
      used[pick] = true;
      var created = {
        id: global.DutyApp.state.uid("A"),
        date: need.date,
        dutyTypeId: need.dutyTypeId,
        personId: pick,
        startTime: need.startTime || "",
        endTime: need.endTime || "",
        slot: need.slot || "",
        slotKey: need.slotKey || "",
        bucket: need.bucket || "",
        source: "auto"
      };
      result.created.push(created);
      working.push(created);
    }
    return result;
  }

  function signature(list) {
    return list.map(function (a) {
      return [
        a.date, a.dutyTypeId, a.personId, a.startTime || "", a.endTime || "",
        a.slotKey || "", a.slot || "", a.bucket || "", a.source || ""
      ].join("~");
    }).sort().join("\n");
  }

  function build(startDate, endDate, typeFilter) {
    var st = global.DutyApp.state.getState();
    var protect = !!st.settings.protectManualAssignments;
    var dates = global.DutyApp.calendar.rangeDates(startDate, endDate);
    var kept = st.assignments.filter(function (a) {
      var inRange = a.date >= startDate && a.date <= endDate;
      var typed = !typeFilter || typeFilter.indexOf(a.dutyTypeId) >= 0;
      if (!inRange || !typed) return true;
      return protect && a.source === "manual";
    });
    var working = global.DutyApp.state.clone(kept);
    var created = [];
    var shortages = [];
    dates.forEach(function (date) {
      global.DutyApp.holiday.isHoliday(date);
      global.DutyApp.cctv.cycleInfo(date);
      global.DutyApp.leave.onDate(date);
      global.DutyApp.dispatch.onDate(date);
      needsOn(date).forEach(function (need) {
        if (typeFilter && typeFilter.indexOf(need.dutyTypeId) < 0) return;
        var result = assignNeed(need, poolFor(need), working);
        created = created.concat(result.created);
        if (result.shortage) shortages.push(result.shortage);
      });
    });
    if (!typeFilter) {
      st.replacements.forEach(function (rep) {
        if (rep.date < startDate || rep.date > endDate) return;
        global.DutyApp.replacement.applyOne(rep, working);
      });
    }
    return { working: working, created: created, shortages: shortages, kept: kept };
  }

  function commit(working, shortages, historyText, range) {
    var before = signature(global.DutyApp.state.getState().assignments);
    if (before === signature(working)) return false;
    global.DutyApp.state.mutate(function (s) {
      s.assignments = working;
      if (range) {
        s.shortages = (s.shortages || []).filter(function (x) {
          var inRange = x.date >= range.start && x.date <= range.end;
          var typed = !range.types || range.types.indexOf(x.dutyTypeId) >= 0;
          return !(inRange && typed);
        }).concat(shortages);
      } else {
        s.shortages = shortages;
      }
    }, historyText);
    return true;
  }

  function run(startDate, endDate, apply, opts) {
    opts = opts || {};
    var built = build(startDate, endDate, opts.types || null);
    var validation = global.DutyApp.validation.run(built.working, { startDate: startDate, endDate: endDate });
    lastPreview = {
      startDate: startDate,
      endDate: endDate,
      assignments: built.working,
      created: built.created,
      shortages: built.shortages,
      notes: [],
      validation: validation,
      summary: {
        total: built.created.length,
        ok: built.created.length,
        warn: validation.warnings.length,
        unassigned: built.shortages.length,
        conflict: validation.errors.length
      }
    };
    if (apply) {
      global.DutyApp.state.snapshotForUndo();
      commit(built.working, built.shortages, "자동배정 적용 " + startDate + " ~ " + endDate, {
        start: startDate,
        end: endDate,
        types: opts.types || null
      });
    }
    return lastPreview;
  }

  function applyRange(startDate, endDate, types, historyText) {
    var built = build(startDate, endDate, types);
    var changed = commit(built.working, built.shortages, historyText, {
      start: startDate,
      end: endDate,
      types: types
    });
    return { changed: changed, created: built.created.length, shortages: built.shortages.length };
  }

  function fillGaps(startDate, endDate, types, historyText) {
    var working = global.DutyApp.state.clone(global.DutyApp.state.getState().assignments);
    var shortages = [];
    global.DutyApp.calendar.rangeDates(startDate, endDate).forEach(function (date) {
      needsOn(date).forEach(function (need) {
        if (types.indexOf(need.dutyTypeId) < 0) return;
        var result = assignNeed(need, poolFor(need), working);
        if (result.shortage) shortages.push(result.shortage);
      });
    });
    return commit(working, shortages, historyText, { start: startDate, end: endDate, types: types });
  }

  function autoMaintain() {
    var today = global.DutyApp.calendar.today();
    var end = global.DutyApp.calendar.monthEnd(today);
    var start = global.DutyApp.calendar.monthStart(today);
    if (end < today) return;
    applyRange(today, end, ["cctv", "watch"], "CCTV/불침번 자동 수정 " + today + " ~ " + end);
    if (start < today) fillGaps(start, global.DutyApp.calendar.addDays(today, -1), ["kitchen"], "취사지원 이번 달 빈 날 배정");
    applyRange(today, end, ["kitchen"], "취사지원 자동 배정 " + today + " ~ " + end);
  }

  function assignKitchenMonth(monthKey) {
    var start = monthKey + "-01";
    var end = global.DutyApp.calendar.monthEnd(start);
    return applyRange(start, end, ["kitchen"], "취사지원 월 배정 " + monthKey);
  }

  function getPreview() {
    return lastPreview;
  }

  global.DutyApp.scheduler = {
    run: run,
    getPreview: getPreview,
    defaultNeeds: defaultNeeds,
    autoMaintain: autoMaintain,
    assignKitchenMonth: assignKitchenMonth,
    applyRange: applyRange
  };
})(window);
