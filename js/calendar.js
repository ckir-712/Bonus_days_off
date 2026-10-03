(function (global) {
  function parseDate(value) {
    var p = String(value).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function formatDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function today() {
    return formatDate(new Date());
  }

  function addDays(dateStr, days) {
    var d = parseDate(dateStr);
    d.setDate(d.getDate() + days);
    return formatDate(d);
  }

  function dateDiff(startDate, targetDate) {
    var a = parseDate(startDate);
    var b = parseDate(targetDate);
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function inRange(date, start, end) {
    return date >= start && date <= end;
  }

  function weekday(dateStr) {
    return parseDate(dateStr).getDay();
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function monthGrid(year, month) {
    var first = new Date(year, month - 1, 1);
    var startPad = first.getDay();
    var total = daysInMonth(year, month);
    var cells = [];
    var i;
    for (i = 0; i < startPad; i++) {
      var prev = new Date(year, month - 1, 1 - (startPad - i));
      cells.push({ date: formatDate(prev), inMonth: false });
    }
    for (i = 1; i <= total; i++) {
      cells.push({ date: formatDate(new Date(year, month - 1, i)), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      var last = parseDate(cells[cells.length - 1].date);
      last.setDate(last.getDate() + 1);
      cells.push({ date: formatDate(last), inMonth: false });
    }
    return cells;
  }

  function monthKey(dateStr) {
    return String(dateStr || "").slice(0, 7);
  }

  function monthStart(dateStr) {
    return monthKey(dateStr) + "-01";
  }

  function monthEnd(dateStr) {
    var p = String(dateStr || "").split("-");
    return formatDate(new Date(Number(p[0]), Number(p[1]), 0));
  }

  function monthLabel(key) {
    var p = String(key || "").split("-");
    if (p.length < 2) return key || "";
    return Number(p[0]) + "년 " + Number(p[1]) + "월";
  }

  function monthsBetween(startDate, endDate) {
    var out = [];
    var cur = monthKey(startDate);
    var end = monthKey(endDate);
    var guard = 0;
    while (cur && end && cur <= end && guard < 36) {
      out.push(cur);
      var y = Number(cur.slice(0, 4));
      var m = Number(cur.slice(5, 7)) + 1;
      if (m > 12) { m = 1; y += 1; }
      cur = y + "-" + String(m).padStart(2, "0");
      guard += 1;
    }
    return out;
  }

  function joinTime(hour, minute) {
    var h = Math.max(0, Math.min(23, Number(hour) || 0));
    var m = Math.max(0, Math.min(59, Number(minute) || 0));
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function timeText(t) {
    var p = String(t || "00:00").split(":");
    return Number(p[0]) + "시 " + String(p[1] || "00").padStart(2, "0") + "분";
  }

  function rangeDates(start, end) {
    var out = [];
    var cur = start;
    while (cur <= end) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }

  function timeToMin(t) {
    var p = String(t || "00:00").split(":");
    return Number(p[0]) * 60 + Number(p[1] || 0);
  }

  function normalizeRange(start, end) {
    var s = timeToMin(start);
    var e = timeToMin(end);
    if (e <= s) e += 24 * 60;
    return { start: s, end: e };
  }

  function timesOverlap(aStart, aEnd, bStart, bEnd) {
    if (!aStart || !aEnd || !bStart || !bEnd) return false;
    var a = normalizeRange(aStart, aEnd);
    var b = normalizeRange(bStart, bEnd);
    return a.start < b.end && b.start < a.end;
  }

  global.DutyApp = global.DutyApp || {};
  global.DutyApp.calendar = {
    parseDate: parseDate,
    formatDate: formatDate,
    today: today,
    addDays: addDays,
    dateDiff: dateDiff,
    inRange: inRange,
    weekday: weekday,
    daysInMonth: daysInMonth,
    monthGrid: monthGrid,
    monthKey: monthKey,
    monthStart: monthStart,
    monthEnd: monthEnd,
    monthLabel: monthLabel,
    monthsBetween: monthsBetween,
    joinTime: joinTime,
    timeText: timeText,
    rangeDates: rangeDates,
    timeToMin: timeToMin,
    timesOverlap: timesOverlap
  };
})(window);
