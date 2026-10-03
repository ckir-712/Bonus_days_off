(function (global) {
  var view = null;
  var modalRoot = null;
  var uiState = {
    page: "dashboard",
    year: 2026,
    month: 10,
    rosterDate: "2026-10-01",
    rosterCompany: "",
    rosterStatus: "",
    rosterQuery: "",
    schedStart: "2026-10-01",
    schedEnd: "2026-10-31",
    preview: null,
    selectedDate: "2026-10-01",
    showDispatchHistory: false,
    archiveMonths: {},
    kitchenMonth: "2026-10",
    countMonth: "2026-10"
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function personOptions(selected) {
    return global.DutyApp.personnel.list().map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === selected ? " selected" : "") + ">" + esc(p.rank + " " + p.name) + "</option>";
    }).join("");
  }

  function statusBadge(status) {
    return '<span class="badge ' + esc(status) + '">' + esc(statusLabel(status)) + "</span>";
  }

  function statusLabel(s) {
    return { active: "정상", leave: "휴가", dispatch: "파견", training: "교육", medical: "근무제한", other: "기타" }[s] || s;
  }

  function openModal(html) {
    modalRoot.innerHTML = '<div class="modal-back"><div class="modal">' + html + "</div></div>";
  }

  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function head(title, sub, actions) {
    return '<div class="page-head"><div><h2>' + esc(title) + "</h2><p>" + esc(sub || "") + "</p></div><div class='row no-print'>" + (actions || "") + "</div></div>";
  }

  function renderDashboard() {
    var today = global.DutyApp.calendar.today();
    var people = global.DutyApp.personnel.list();
    var leaves = global.DutyApp.leave.onDate(today);
    var dispatches = global.DutyApp.dispatch.onDate(today);
    var assigns = global.DutyApp.duty.assignments({ date: today });
    var info = global.DutyApp.cctv.cycleInfo(today);
    var val = global.DutyApp.validation.run(null, { startDate: today, endDate: today });
    var shortages = (global.DutyApp.state.getState().shortages || []).filter(function (s) { return s.date === today; });
    function cnt(type) { return assigns.filter(function (a) { return a.dutyTypeId === type; }).length; }
    var cards = [
      ["전체 인원", people.length, ""],
      ["현재 휴가자", leaves.length, ""],
      ["현재 파견자", dispatches.length, ""],
      ["오늘 전체 근무자", assigns.length, ""],
      ["오늘 CCTV", cnt("cctv"), ""],
      ["오늘 불침번", cnt("watch"), ""],
      ["오늘 취사지원", cnt("kitchen"), ""],
      ["미배정", shortages.length, ""],
      ["충돌", val.errors.length, ""]
    ].map(function (c) {
      return '<div class="card"><div class="stat-label">' + c[0] + '</div><div class="stat-value">' + c[1] + "</div></div>";
    }).join("");
    var rot = info.cycle === null
      ? "<p>교대 시작일 이전입니다. 시작일: " + esc(global.DutyApp.state.getState().rotationSettings.startDate) + "</p>"
      : '<div class="grid two"><div><div>현재 주기</div><strong>' + esc(info.cycleLabel) + "</strong></div>" +
        "<div>기간<br><strong>" + info.periodStart + " ~ " + info.periodEnd + "</strong></div>" +
        "<div>CCTV 담당<br><strong>" + info.cctvGroup + "조</strong></div>" +
        "<div>불침번 담당<br><strong>" + info.watchGroup + "조</strong></div>" +
        "<div>다음 교대일<br><strong>" + info.nextRotation + "</strong></div>" +
        "<div>남은 일수<br><strong>" + info.remaining + "일</strong></div></div>";
    var hist = (global.DutyApp.state.getState().history || []).slice(0, 8).map(function (h) {
      return "<li>" + esc(h.at.slice(11, 16) + " " + h.text) + "</li>";
    }).join("") || "<li>기록 없음</li>";
    return head("대시보드", "오늘 " + today + " · CCTV, 불침번, 취사지원은 오늘 이후 일정이 자동으로 맞춰집니다.") +
      '<div class="grid cards">' + cards + "</div>" +
      '<div class="grid two" style="margin-top:14px"><div class="card"><h3>CCTV / 불침번 현황</h3>' + rot + "</div>" +
      '<div class="card"><h3>최근 변경 이력</h3><ul>' + hist + "</ul></div></div>";
  }

  function renderPersonnel() {
    var rows = global.DutyApp.personnel.list().map(function (p) {
      return "<tr><td>" + esc(p.id) + "</td><td>" + esc(p.rank) + "</td><td>" + esc(p.name) + "</td><td>" + esc(p.company) + "</td><td>" + esc(p.platoon) + "</td><td>" + statusBadge(p.status) + "</td>" +
        '<td><button class="btn" data-action="edit-person" data-id="' + p.id + '">수정</button> <button class="btn danger" data-action="del-person" data-id="' + p.id + '">삭제</button></td></tr>';
    }).join("");
    return head("전체 인원", "소속 인원을 등록하고 상태를 관리합니다.",
      '<button class="btn primary" data-action="new-person">인원 등록</button>') +
      '<div class="card"><table><thead><tr><th>ID</th><th>계급</th><th>성명</th><th>중대</th><th>소대</th><th>상태</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7">인원 없음</td></tr>') + "</tbody></table></div>";
  }

  function personForm(p) {
    p = p || { id: global.DutyApp.personnel.nextId(), name: "", rank: "이등병", company: "1중대", platoon: "1소대", position: "분대원", status: "active", skills: [], memo: "" };
    return "<h3>인원</h3><div class='grid two'>" +
      field("ID", '<input id="f-id" value="' + esc(p.id) + '">') +
      field("성명", '<input id="f-name" value="' + esc(p.name) + '">') +
      field("계급", '<input id="f-rank" value="' + esc(p.rank) + '">') +
      field("중대", '<input id="f-company" value="' + esc(p.company) + '">') +
      field("소대", '<input id="f-platoon" value="' + esc(p.platoon) + '">') +
      field("직책", '<input id="f-position" value="' + esc(p.position) + '">') +
      field("상태", '<select id="f-status"><option value="active">정상</option><option value="leave">휴가</option><option value="dispatch">파견</option><option value="training">교육</option><option value="medical">근무제한</option><option value="other">기타</option></select>') +
      field("자격(쉼표)", '<input id="f-skills" value="' + esc((p.skills || []).join(",")) + '">') +
      "</div>" + field("메모", '<textarea id="f-memo">' + esc(p.memo) + "</textarea>") +
      '<div class="row" style="margin-top:12px"><button class="btn primary" data-action="save-person">저장</button><button class="btn" data-action="close-modal">닫기</button></div>';
  }

  function field(label, inner) {
    return '<div class="field grow"><label>' + esc(label) + "</label>" + inner + "</div>";
  }

  function renderLeave() {
    var rows = global.DutyApp.leave.list().map(function (r) {
      return "<tr><td>" + esc(global.DutyApp.personnel.label(r.personId)) + "</td><td>" + esc(r.startDate) + "</td><td>" + esc(r.endDate) + "</td><td>" + esc(r.memo || "") + "</td>" +
        '<td><button class="btn danger" data-action="del-leave" data-id="' + r.id + '">삭제</button></td></tr>';
    }).join("");
    return head("휴가 관리", "휴가 기간에는 모든 자동배정에서 제외됩니다.") +
      '<div class="card"><div class="row">' +
      field("인원", '<select id="leave-person">' + personOptions() + "</select>") +
      field("시작", '<input type="date" id="leave-start">') +
      field("종료", '<input type="date" id="leave-end">') +
      field("메모", '<input id="leave-memo">') +
      '<button class="btn primary" data-action="add-leave">등록</button></div></div>' +
      '<div class="card" style="margin-top:12px"><table><thead><tr><th>인원</th><th>시작</th><th>종료</th><th>메모</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5">없음</td></tr>') + "</tbody></table></div>";
  }

  function dispatchRows(records, removable) {
    return records.map(function (r) {
      var today = global.DutyApp.calendar.today();
      var stateText = r.endDate < today ? "종료" : (r.startDate > today ? "예정" : "파견중");
      var action = removable
        ? '<button class="btn danger" data-action="del-dispatch" data-id="' + r.id + '">삭제</button>'
        : "";
      return "<tr><td>" + esc(global.DutyApp.personnel.label(r.personId)) + "</td><td>" + esc(r.startDate) + "</td><td>" + esc(r.endDate) + "</td><td>" + esc(stateText) + "</td><td>" + esc(r.memo || "") + "</td><td>" + action + "</td></tr>";
    }).join("");
  }

  function renderDispatch() {
    global.DutyApp.dispatch.archiveEnded();
    var current = global.DutyApp.dispatch.currentList();
    var upcoming = global.DutyApp.dispatch.upcomingList();
    var historyBtn = uiState.showDispatchHistory ? "현재 파견만 보기" : "이전 기록 보기";
    var historyHtml = "";
    if (uiState.showDispatchHistory) {
      var groups = global.DutyApp.dispatch.archiveByMonth();
      var keys = Object.keys(groups).sort().reverse();
      historyHtml = '<div class="card" style="margin-top:12px"><h3>이전 기록</h3><p class="summary-line">끝난 파견은 월별로 접혀 있습니다. 월을 누르면 그 달 기록이 열립니다.</p>' +
        (keys.map(function (key) {
          var open = !!uiState.archiveMonths[key];
          var body = open
            ? '<table><thead><tr><th>인원</th><th>시작</th><th>종료</th><th>상태</th><th>메모</th><th></th></tr></thead><tbody>' + dispatchRows(groups[key], false) + "</tbody></table>"
            : "";
          return '<button class="btn fold" data-action="toggle-archive-month" data-month="' + esc(key) + '">' +
            esc(global.DutyApp.calendar.monthLabel(key)) + " · " + groups[key].length + "건 · " + (open ? "접기" : "펼치기") + "</button>" + body;
        }).join("") || "<p>이전 기록 없음</p>") + "</div>";
    }
    return head("파견 관리", "끝나면 현재 목록에서 빠지고 이전 기록으로 옮겨집니다. 조 편성은 유지되며, 파견 기간만 자동배정에서 제외됩니다.",
      '<button class="btn" data-action="toggle-dispatch-history">' + historyBtn + "</button>") +
      '<div class="card"><div class="row">' +
      field("인원", '<select id="disp-person">' + personOptions() + "</select>") +
      field("시작", '<input type="date" id="disp-start">') +
      field("종료", '<input type="date" id="disp-end">') +
      field("메모", '<input id="disp-memo">') +
      '<button class="btn primary" data-action="add-dispatch">등록</button></div></div>' +
      '<div class="card" style="margin-top:12px"><h3>현재 파견</h3><table><thead><tr><th>인원</th><th>시작</th><th>종료</th><th>상태</th><th>메모</th><th></th></tr></thead><tbody>' +
      (dispatchRows(current, true) || '<tr><td colspan="6">현재 파견 인원 없음</td></tr>') + "</tbody></table></div>" +
      '<div class="card" style="margin-top:12px"><h3>예정 파견</h3><table><thead><tr><th>인원</th><th>시작</th><th>종료</th><th>상태</th><th>메모</th><th></th></tr></thead><tbody>' +
      (dispatchRows(upcoming, true) || '<tr><td colspan="6">예정 없음</td></tr>') + "</tbody></table></div>" +
      historyHtml;
  }

  function renderDutyTypes() {
    var blocks = global.DutyApp.duty.types().map(function (t) {
      if (t.timed === false) {
        var items = (t.items || []).map(function (item) {
          return "<tr><td>" + esc(item.label) + "</td><td>" + item.requiredPersonnel + "명</td><td>시간 없음</td>" +
            '<td><button class="btn danger" data-action="del-kitchen-item" data-id="' + item.id + '">삭제</button></td></tr>';
        }).join("");
        return "<h3>" + esc(t.name) + "</h3><p class='summary-line'>시작·종료 시간이 없습니다. 평일과 주말을 나눠 항목마다 따로 맞춥니다.</p><table><thead><tr><th>항목</th><th>인원</th><th>시간</th><th></th></tr></thead><tbody>" +
          (items || '<tr><td colspan="4">항목 없음</td></tr>') + "</tbody></table>";
      }
      var shifts = (t.shifts || []).slice().sort(function (a, b) { return Number(a.order) - Number(b.order); }).map(function (s) {
        return "<tr><td>" + esc(global.DutyApp.duty.shiftText(s)) + "</td><td>" + s.requiredPersonnel + "명</td>" +
          '<td><button class="btn danger" data-action="del-shift" data-type="' + t.id + '" data-id="' + s.id + '">삭제</button></td></tr>';
      }).join("");
      return "<h3>" + esc(t.name) + "</h3><table><thead><tr><th>번초</th><th>인원</th><th></th></tr></thead><tbody>" +
        (shifts || '<tr><td colspan="3">번초 없음</td></tr>') + "</tbody></table>";
    }).join("");
    var timedOptions = global.DutyApp.duty.types().filter(function (t) { return t.timed !== false; }).map(function (t) {
      return '<option value="' + t.id + '">' + esc(t.name) + "</option>";
    }).join("");
    var extra = global.DutyApp.duty.schedules().map(function (s) {
      return "<tr><td>" + esc(s.date) + "</td><td>" + esc((global.DutyApp.duty.typeById(s.dutyTypeId) || {}).name || s.dutyTypeId) + "</td><td>" + esc(s.startTime) + "~" + esc(s.endTime) + "</td><td>" + s.requiredPersonnel + "</td>" +
        '<td><button class="btn danger" data-action="del-schedule" data-id="' + s.id + '">삭제</button></td></tr>';
    }).join("");
    return head("근무 종류", "시간 있는 근무는 n번초와 시작·종료 시각으로 추가합니다. 추가한 번초는 매일 배정에 쓰입니다.") +
      '<div class="card">' + blocks + "</div>" +
      '<div class="card" style="margin-top:12px"><h3>근무 종류 추가</h3><div class="row">' +
      field("이름", '<input id="type-name" placeholder="예: 당직">') +
      '<button class="btn primary" data-action="add-duty-type">종류 추가</button></div></div>' +
      '<div class="card" style="margin-top:12px"><h3>번초 추가</h3><div class="row">' +
      field("근무", '<select id="sh-type">' + timedOptions + "</select>") +
      field("몇 번초", '<input type="number" id="sh-order" min="1" value="1">') +
      field("시작 시", '<input type="number" id="sh-h1" min="0" max="23" value="22">') +
      field("시작 분", '<input type="number" id="sh-m1" min="0" max="59" value="0">') +
      field("종료 시", '<input type="number" id="sh-h2" min="0" max="23" value="0">') +
      field("종료 분", '<input type="number" id="sh-m2" min="0" max="59" value="0">') +
      field("인원", '<input type="number" id="sh-req" min="1" value="1">') +
      '<button class="btn primary" data-action="add-shift">번초 추가</button></div>' +
      "<p class='summary-line'>같은 번호가 있으면 그 번초의 시간이 바뀝니다. 예: 1번초 22시 00분부터 00시 00분까지.</p></div>" +
      '<div class="card" style="margin-top:12px"><h3>취사지원 항목 추가</h3><div class="row">' +
      field("항목", '<input id="kit-label" placeholder="아침">') +
      field("인원", '<input type="number" id="kit-req" min="1" value="3">') +
      '<button class="btn primary" data-action="add-kitchen-item">항목 추가</button></div>' +
      "<p class='summary-line'>취사지원은 시각이 없습니다. 평일 횟수와 주말 횟수를 항목별로 따로 맞춥니다.</p></div>" +
      '<div class="card" style="margin-top:12px"><h3>특정 날짜만 지정</h3><p class="summary-line">일반 근무는 이 날짜에 한해 매일 번초 대신 이 시간이 쓰입니다.</p><div class="row">' +
      field("날짜", '<input type="date" id="sch-date">') +
      field("종류", '<select id="sch-type">' + timedOptions + "</select>") +
      field("시작", '<input id="sch-start" value="09:00">') +
      field("종료", '<input id="sch-end" value="17:00">') +
      field("인원", '<input type="number" id="sch-req" value="1">') +
      '<button class="btn primary" data-action="add-schedule">추가</button></div>' +
      "<table style='margin-top:10px'><thead><tr><th>날짜</th><th>종류</th><th>시간</th><th>인원</th><th></th></tr></thead><tbody>" +
      (extra || '<tr><td colspan="5">지정 일정 없음</td></tr>') + "</tbody></table></div>";
  }

  function assignmentWhen(a) {
    if (a.dutyTypeId === "kitchen" || (!a.startTime && !a.endTime)) {
      var kind = a.bucket || global.DutyApp.holiday.kitchenDayKind(a.date);
      return (a.slot || "항목") + " · " + global.DutyApp.kitchen.kindLabel(kind);
    }
    var type = global.DutyApp.duty.typeById(a.dutyTypeId);
    var shift = type && (type.shifts || []).find(function (s) { return s.id === a.slotKey; });
    if (shift) return global.DutyApp.duty.shiftText(shift);
    if (a.slot && a.startTime) return a.slot + " " + a.startTime + "~" + a.endTime;
    return (a.startTime || "") + (a.endTime ? "~" + a.endTime : "");
  }

  function assignmentTable(type, monthKey) {
    var rows = global.DutyApp.duty.assignments({ dutyTypeId: type }).filter(function (a) {
      return !monthKey || a.date.slice(0, 7) === monthKey;
    }).map(function (a) {
      return "<tr><td>" + esc(a.date) + "</td><td>" + esc(assignmentWhen(a)) + "</td><td>" + esc(global.DutyApp.personnel.label(a.personId)) + "</td><td>" + esc(a.source) + "</td>" +
        '<td><button class="btn danger" data-action="del-assign" data-id="' + a.id + '">삭제</button></td></tr>';
    }).join("");
    return '<div class="card" style="margin-top:12px"><h3>배정 목록</h3><div class="table-wrap"><table><thead><tr><th>날짜</th><th>내용</th><th>인원</th><th>출처</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5">없음</td></tr>') + "</tbody></table></div></div>";
  }

  function manualAssignForm(type) {
    var dutyType = global.DutyApp.duty.typeById(type);
    if (dutyType && dutyType.timed === false) {
      var options = (dutyType.items || []).map(function (item) {
        return '<option value="' + item.id + '">' + esc(item.label) + "</option>";
      }).join("");
      return '<div class="card"><h3>수동 배정</h3><div class="row">' +
        field("날짜", '<input type="date" id="ma-date" value="' + esc(uiState.selectedDate) + '">') +
        field("항목", '<select id="ma-item">' + options + "</select>") +
        field("인원", '<select id="ma-person">' + personOptions() + "</select>") +
        '<button class="btn primary" data-action="manual-assign" data-type="' + type + '">수동 배정</button></div></div>';
    }
    return '<div class="card"><h3>수동 배정</h3><div class="row">' +
      field("날짜", '<input type="date" id="ma-date" value="' + esc(uiState.selectedDate) + '">') +
      field("시작", '<input id="ma-start" value="22:00">') +
      field("종료", '<input id="ma-end" value="02:00">') +
      field("인원", '<select id="ma-person">' + personOptions() + "</select>") +
      '<button class="btn primary" data-action="manual-assign" data-type="' + type + '">수동 배정</button></div></div>';
  }

  function slotBag(row, id, label) {
    return row.bySlot[id] || row.bySlot[label] || { weekday: 0, friday: 0, weekend: 0, all: 0 };
  }

  function monthPicker(id, value) {
    return field("월", '<input type="month" id="' + id + '" value="' + esc(value) + '">');
  }

  function groupList(ids, date, role) {
    return ids.map(function (id) {
      var p = global.DutyApp.personnel.byId(id);
      var av = global.DutyApp.duty.isAvailableForDuty(id, date, role, { checkConsecutive: false });
      var mark = av.ok ? '<span class="badge ok">가능</span>' : '<span class="badge error">' + esc(av.reasons.join(", ")) + "</span>";
      return '<div class="list-item"><div>' + esc(p ? p.rank + " " + p.name : id) + "</div><div>" + mark +
        ' <button class="btn" data-action="move-group" data-id="' + id + '" data-to="A">A조</button>' +
        ' <button class="btn" data-action="move-group" data-id="' + id + '" data-to="B">B조</button>' +
        ' <button class="btn" data-action="move-group" data-id="' + id + '" data-to="">제외</button></div></div>';
    }).join("") || '<div class="list-item">없음</div>';
  }

  function renderRotationPage(kind) {
    var date = uiState.selectedDate;
    var info = global.DutyApp.cctv.cycleInfo(date);
    var st = global.DutyApp.state.getState();
    var a = st.dutyGroups.cctv || [];
    var b = st.dutyGroups.watch || [];
    var status = info.cycle === null
      ? "<div class='notice warn'>선택한 날짜가 교대 시작일 이전입니다.</div>"
      : '<div class="grid cards">' +
        card("현재 주기", info.cycleLabel) +
        card("기간", info.periodStart + " ~ " + info.periodEnd) +
        card("CCTV 담당", info.cctvGroup + "조") +
        card("불침번 담당", info.watchGroup + "조") +
        card("다음 교대일", info.nextRotation) + "</div>";
    var title = kind === "cctv" ? "CCTV" : "불침번";
    var month = uiState.countMonth;
    var counts = global.DutyApp.statistics.monthlyDutyCounts(kind, month);
    var countHtml = kind === "cctv" ? cctvCountTable(counts, month) : watchCountTable(counts, month);
    var note = kind === "cctv"
      ? "지난 날짜는 그대로 두고, 오늘부터 이번 달 끝까지 다시 맞춥니다. 다음날 평일·금요일·주말 횟수를 번초마다 따로 맞춥니다."
      : "지난 날짜는 그대로 두고, 오늘부터 이번 달 끝까지 다시 맞춥니다. 번초별 횟수를 맞춥니다.";
    return head(title, "조 구성과 날짜별 역할은 분리되어 있습니다. 파견/휴가자는 조에 남아 있으나 해당일 배정에서 제외됩니다. " + note,
      '<input type="date" id="rot-date" value="' + date + '"><button class="btn" data-action="set-rot-date">날짜 적용</button> ' +
      '<button class="btn primary" data-action="auto-groups">자동 조편성</button> ' +
      '<button class="btn" data-action="reset-groups">조 초기화</button> ' +
      '<button class="btn" data-action="print">인쇄</button>') +
      '<div class="card"><h3>CCTV / 불침번 교대 현황</h3>' + status + "</div>" +
      '<div class="split" style="margin-top:12px"><div class="card"><h3>A조 · ' + esc(st.groupMeta.A) + " (" + a.length + "명)</h3><div class='list-box'>" + groupList(a, date, "cctv") + "</div></div>" +
      "<div class='card'><h3>B조 · " + esc(st.groupMeta.B) + " (" + b.length + "명)</h3><div class='list-box'>" + groupList(b, date, "watch") + "</div></div></div>" +
      '<div class="card" style="margin-top:12px"><div class="row">' +
      monthPicker("count-month", month) +
      '<button class="btn" data-action="set-count-month">월 조회</button></div>' + countHtml + "</div>" +
      manualAssignForm(kind) + assignmentTable(kind, month);
  }

  function cctvCountTable(counts, month) {
    var shifts = global.DutyApp.cctv.shifts();
    var summary = counts.map(function (row) {
      return "<tr><td>" + esc(row.rank + " " + row.name) + "</td><td>" + row.byBucket.weekday + "</td><td>" + row.byBucket.friday + "</td><td>" + row.byBucket.weekend + "</td><td>" + row.total + "</td></tr>";
    }).join("");
    var headCells = shifts.map(function (s) {
      return "<th>" + esc(s.label) + " 평일</th><th>" + esc(s.label) + " 금요일</th><th>" + esc(s.label) + " 주말</th>";
    }).join("");
    var detail = counts.map(function (row) {
      var cells = shifts.map(function (s) {
        var bag = slotBag(row, s.id, s.label);
        return "<td>" + bag.weekday + "</td><td>" + bag.friday + "</td><td>" + bag.weekend + "</td>";
      }).join("");
      return "<tr><td>" + esc(row.rank + " " + row.name) + "</td>" + cells + "<td>" + row.total + "</td></tr>";
    }).join("");
    return "<h3>" + esc(global.DutyApp.calendar.monthLabel(month)) + " CCTV 횟수</h3>" +
      '<div class="table-wrap"><table><thead><tr><th>성명</th><th>다음날 평일</th><th>다음날 금요일</th><th>다음날 주말</th><th>합계</th></tr></thead><tbody>' +
      (summary || '<tr><td colspan="5">없음</td></tr>') + "</tbody></table></div>" +
      "<h3 style='margin-top:14px'>번초별</h3><div class='table-wrap'><table><thead><tr><th>성명</th>" + headCells + "<th>합계</th></tr></thead><tbody>" +
      (detail || "<tr><td colspan='2'>없음</td></tr>") + "</tbody></table></div>";
  }

  function watchCountTable(counts, month) {
    var shifts = global.DutyApp.watch.shifts();
    var headCells = shifts.map(function (s) { return "<th>" + esc(s.label) + "</th>"; }).join("");
    var body = counts.map(function (row) {
      var cells = shifts.map(function (s) { return "<td>" + slotBag(row, s.id, s.label).all + "</td>"; }).join("");
      return "<tr><td>" + esc(row.rank + " " + row.name) + "</td>" + cells + "<td>" + row.total + "</td></tr>";
    }).join("");
    return "<h3>" + esc(global.DutyApp.calendar.monthLabel(month)) + " 불침번 횟수</h3><div class='table-wrap'><table><thead><tr><th>성명</th>" +
      headCells + "<th>합계</th></tr></thead><tbody>" + (body || "<tr><td colspan='2'>없음</td></tr>") + "</tbody></table></div>";
  }

  function card(label, value) {
    return '<div class="card"><div class="stat-label">' + esc(label) + '</div><div class="stat-value" style="font-size:18px">' + esc(value) + "</div></div>";
  }

  function renderKitchen() {
    var month = uiState.kitchenMonth;
    var items = global.DutyApp.kitchen.items();
    var counts = global.DutyApp.statistics.monthlyDutyCounts("kitchen", month);
    var headCells = items.map(function (item) {
      return "<th>" + esc(item.label) + " 평일</th><th>" + esc(item.label) + " 주말</th>";
    }).join("");
    var body = counts.map(function (row) {
      var cells = items.map(function (item) {
        var bag = slotBag(row, item.id, item.label);
        return "<td>" + bag.weekday + "</td><td>" + bag.weekend + "</td>";
      }).join("");
      return "<tr><td>" + esc(row.rank + " " + row.name) + "</td>" + cells +
        "<td>" + row.byBucket.weekday + "</td><td>" + row.byBucket.weekend + "</td><td>" + row.total + "</td></tr>";
    }).join("");
    return head("취사지원", "한 달 단위로 자동 배정합니다. 시작·종료 시간은 없고, 평일 횟수와 주말 횟수를 항목마다 따로 맞춥니다. 휴가자와 파견자는 제외됩니다.",
      '<button class="btn" data-action="print">인쇄</button>') +
      '<div class="card"><div class="row">' +
      monthPicker("kitchen-month", month) +
      '<button class="btn" data-action="set-kitchen-month">월 조회</button>' +
      '<button class="btn primary" data-action="assign-kitchen-month">이 달 자동배정</button></div>' +
      "<h3 style='margin-top:12px'>" + esc(global.DutyApp.calendar.monthLabel(month)) + " 취사지원 횟수</h3>" +
      '<div class="table-wrap"><table><thead><tr><th>성명</th>' + headCells + "<th>평일 합계</th><th>주말 합계</th><th>총합</th></tr></thead><tbody>" +
      (body || "<tr><td colspan='4'>없음</td></tr>") + "</tbody></table></div></div>" +
      manualAssignForm("kitchen") + assignmentTable("kitchen", month);
  }

  function renderGuard() {
    return head("경계근무", "일반적인 근무 일정만 관리합니다. 작전 세부정보는 저장하지 않습니다.", '<button class="btn" data-action="print">인쇄</button>') +
      manualAssignForm("guard") + assignmentTable("guard");
  }

  function renderReplacement() {
    var rows = global.DutyApp.replacement.list().map(function (r) {
      return "<tr><td>" + esc(r.date) + "</td><td>" + esc(global.DutyApp.personnel.label(r.originalPersonId)) + "</td><td>" + esc(global.DutyApp.personnel.label(r.replacementPersonId)) + "</td><td>" + esc(r.dutyId) + "</td><td>" + esc(r.reason || "") + "</td>" +
        '<td><button class="btn danger" data-action="del-rep" data-id="' + r.id + '">삭제</button></td></tr>';
    }).join("");
    return head("근무대체", "대체자도 휴가/파견/충돌/자격 조건을 만족해야 합니다.") +
      '<div class="card"><div class="row">' +
      field("날짜", '<input type="date" id="rep-date">') +
      field("원 근무자", '<select id="rep-from">' + personOptions() + "</select>") +
      field("대체자", '<select id="rep-to">' + personOptions() + "</select>") +
      field("근무", '<select id="rep-duty"><option value="cctv">CCTV</option><option value="watch">불침번</option><option value="kitchen">취사지원</option><option value="guard">경계근무</option><option value="other">기타</option></select>') +
      field("사유", '<input id="rep-reason" value="근무대체">') +
      '<button class="btn primary" data-action="add-rep">적용</button></div><p id="rep-msg" class="stat-sub"></p></div>' +
      '<div class="card" style="margin-top:12px"><table><thead><tr><th>날짜</th><th>원 근무자</th><th>대체자</th><th>근무</th><th>사유</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6">없음</td></tr>') + "</tbody></table></div>";
  }

  function renderScheduler() {
    var p = uiState.preview;
    var summary = "";
    if (p) {
      summary = '<div class="grid cards">' +
        card("총 배정", p.summary.total) +
        card("정상", p.created.length) +
        card("주의", p.summary.warn) +
        card("미배정", p.summary.unassigned) +
        card("충돌", p.summary.conflict) + "</div>";
      summary += '<div class="card" style="margin-top:12px"><h3>미배정 / 부족</h3>' +
        (p.shortages.map(function (s) { return '<pre class="notice warn">' + esc(s.message) + "</pre>"; }).join("") || "<p>없음</p>") + "</div>";
      summary += '<div class="card" style="margin-top:12px"><h3>검증</h3>' +
        (p.validation.errors.map(function (e) { return '<div class="notice error">' + esc(e.message) + "</div>"; }).join("") || '<div class="notice ok">오류 없음</div>') +
        p.validation.warnings.map(function (e) { return '<div class="notice warn">' + esc(e.message) + "</div>"; }).join("") + "</div>";
    }
    return head("자동배정", "미리보기는 실제 데이터를 변경하지 않습니다. 적용 시에만 저장됩니다.") +
      '<div class="card"><div class="row">' +
      field("시작", '<input type="date" id="sc-start" value="' + uiState.schedStart + '">') +
      field("종료", '<input type="date" id="sc-end" value="' + uiState.schedEnd + '">') +
      '<button class="btn" data-action="preview-assign">자동배정 미리보기</button>' +
      '<button class="btn primary" data-action="apply-assign">배정 적용</button>' +
      '<button class="btn warn" data-action="undo-assign">자동배정 취소</button></div>' +
      "<p class='stat-sub'>CCTV는 다음날 평일·금요일·주말 횟수를 따로 맞추고, 취사지원은 평일·주말 횟수를 따로 맞춥니다. 지난 CCTV·불침번 날짜는 유지한 채 오늘 이후만 자동으로 다시 계산됩니다.</p></div>" +
      '<div style="margin-top:12px">' + summary + "</div>";
  }

  function dayStatus(person, date) {
    var rest = global.DutyApp.duty.restrictionOnDate(person, date);
    if (rest === "파견") return "dispatch";
    if (rest === "휴가") return "leave";
    if (rest === "교육") return "training";
    if (rest === "근무제한") return "medical";
    if (person.status === "other") return "other";
    return "active";
  }

  function renderRoster() {
    var date = uiState.rosterDate;
    var people = global.DutyApp.personnel.list().filter(function (p) {
      if (uiState.rosterCompany && p.company !== uiState.rosterCompany) return false;
      if (uiState.rosterStatus && dayStatus(p, date) !== uiState.rosterStatus) return false;
      if (uiState.rosterQuery) {
        var q = uiState.rosterQuery;
        var blob = (p.rank + " " + p.name + " " + p.company + " " + (p.platoon || "")).toLowerCase();
        if (blob.indexOf(q.toLowerCase()) < 0) return false;
      }
      return true;
    });
    var counts = { all: global.DutyApp.personnel.list().length, active: 0, leave: 0, dispatch: 0, training: 0, duty: 0 };
    global.DutyApp.personnel.list().forEach(function (p) {
      var st = dayStatus(p, date);
      if (counts[st] !== undefined) counts[st] += 1;
    });
    var dutyPeople = {};
    global.DutyApp.duty.assignments({ date: date }).forEach(function (a) { dutyPeople[a.personId] = true; });
    counts.duty = Object.keys(dutyPeople).length;
    var rows = people.map(function (p, i) {
      var mine = global.DutyApp.duty.assignments({ date: date, personId: p.id });
      var dutyText = mine.map(function (a) {
        var name = (global.DutyApp.duty.typeById(a.dutyTypeId) || {}).name || a.dutyTypeId;
        return name + " " + assignmentWhen(a);
      }).join(", ");
      var status = dayStatus(p, date);
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(p.company) + "</td><td>" + esc(p.platoon || "") + "</td><td>" + esc(p.rank) + "</td><td>" + esc(p.name) + "</td><td>" + esc(p.position || "") + "</td><td>" + statusBadge(status) + "</td><td>" + (dutyText ? esc(dutyText) : "대기") + "</td><td>" + esc(p.memo || "") + "</td></tr>";
    }).join("");
    var companies = global.DutyApp.personnel.companies().map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === uiState.rosterCompany ? " selected" : "") + ">" + esc(c) + "</option>";
    }).join("");
    var d = global.DutyApp.calendar.parseDate(date);
    var title = d.getFullYear() + "년 " + (d.getMonth() + 1) + "월 " + d.getDate() + "일 전체 인원 연명부";
    return head("전체 인원 연명부", "근무자만 보는 근무 연명부가 아니라, 그날의 전체 인원 상태입니다.", '<button class="btn" data-action="print">인쇄</button>') +
      '<div class="card no-print"><div class="row">' +
      field("날짜", '<input type="date" id="roster-date" value="' + date + '">') +
      field("중대", '<select id="roster-company"><option value="">전체</option>' + companies + "</select>") +
      field("상태", '<select id="roster-status"><option value="">전체</option><option value="active">정상</option><option value="leave">휴가</option><option value="dispatch">파견</option><option value="training">교육</option><option value="medical">근무제한</option></select>') +
      field("검색", '<input id="roster-query" value="' + esc(uiState.rosterQuery) + '" placeholder="이름, 계급">') +
      '<button class="btn primary" data-action="set-roster">조회</button></div></div>' +
      '<div class="card" style="margin-top:12px"><h2>' + esc(title) + "</h2>" +
      '<p class="summary-line">총원 ' + counts.all + " · 정상 " + counts.active + " · 휴가 " + counts.leave + " · 파견 " + counts.dispatch + " · 교육 " + counts.training + " · 당일 근무 " + counts.duty + "</p>" +
      '<div class="table-wrap"><table><thead><tr><th>연번</th><th>중대</th><th>소대</th><th>계급</th><th>성명</th><th>직책</th><th>상태</th><th>당일 근무</th><th>비고</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9">인원 없음</td></tr>') + "</tbody></table></div></div>";
  }

  function renderCalendar() {
    var y = uiState.year, m = uiState.month;
    var heads = ["일", "월", "화", "수", "목", "금", "토"].map(function (d) { return '<div class="cal-head">' + d + "</div>"; }).join("");
    var cells = global.DutyApp.calendar.monthGrid(y, m).map(function (c) {
      var info = global.DutyApp.cctv.cycleInfo(c.date);
      var hol = global.DutyApp.holiday.names(c.date);
      var lv = global.DutyApp.leave.onDate(c.date).length;
      var dp = global.DutyApp.dispatch.onDate(c.date).length;
      var as = global.DutyApp.duty.assignments({ date: c.date });
      var val = global.DutyApp.validation.run(as, { startDate: c.date, endDate: c.date });
      var sh = (global.DutyApp.state.getState().shortages || []).filter(function (s) { return s.date === c.date; }).length;
      var rot = global.DutyApp.cctv.isRotationDay(c.date);
      var cls = "cal-cell" + (c.inMonth ? "" : " muted") + (hol.length ? " holiday" : "") + (rot ? " rotation" : "");
      var role = info.roles ? ("CCTV " + info.cctvGroup + "조 / 불침번 " + info.watchGroup + "조") : "-";
      return '<div class="' + cls + '" data-action="cal-day" data-date="' + c.date + '"><div class="cal-day">' + Number(c.date.slice(8)) + (rot ? ' <span class="badge swap">교대</span>' : "") + "</div>" +
        '<div class="cal-meta">' + (hol.length ? "<div>" + esc(hol.join(", ")) + "</div>" : "") +
        "<div>휴가 " + lv + " · 파견 " + dp + "</div><div>근무 " + as.length + "</div><div>" + esc(role) + "</div>" +
        (sh ? "<div>미배정 " + sh + "</div>" : "") + (val.errors.length ? "<div>충돌 " + val.errors.length + "</div>" : "") + "</div></div>";
    }).join("");
    var holidays = global.DutyApp.holiday.list().map(function (h) {
      return "<tr><td>" + h.date + "</td><td>" + esc(h.name) + "</td><td>" + esc(h.type) + "</td>" +
        '<td><button class="btn danger" data-action="del-hol" data-date="' + h.date + '" data-name="' + esc(h.name) + '">삭제</button></td></tr>';
    }).join("");
    return head("달력", y + "년 " + m + "월",
      '<button class="btn" data-action="cal-prev">이전</button><button class="btn" data-action="cal-next">다음</button><button class="btn" data-action="print">인쇄</button>') +
      '<div class="cal">' + heads + cells + "</div>" +
      '<div class="card" style="margin-top:14px"><h3>휴일 관리 (법정/지정/군 전용)</h3><div class="row">' +
      field("날짜", '<input type="date" id="hol-date">') +
      field("이름", '<input id="hol-name">') +
      field("유형", '<select id="hol-type"><option value="national">법정 공휴일</option><option value="designated">지정 공휴일</option><option value="military">군 전용 휴일</option><option value="unit">부대 자체</option></select>') +
      '<button class="btn primary" data-action="add-hol">추가</button></div>' +
      "<table style='margin-top:10px'><thead><tr><th>날짜</th><th>이름</th><th>유형</th><th></th></tr></thead><tbody>" + holidays + "</tbody></table></div>";
  }

  function renderStats() {
    var rows = global.DutyApp.statistics.personStats().map(function (s) {
      return "<tr><td>" + esc(s.rank + " " + s.name) + "</td><td>" + s.total + "</td><td>" + s.cctv + "</td><td>" + s.watch + "</td><td>" + s.kitchen + "</td><td>" + s.guard + "</td><td>" + s.other + "</td><td>" + s.holiday + "</td></tr>";
    }).join("");
    var g = global.DutyApp.statistics.groupStats().map(function (x) {
      return "<tr><td>" + esc(x.group + " " + x.name) + "</td><td>" + x.cctvDays + "일</td><td>" + x.watchDays + "일</td></tr>";
    }).join("");
    return head("통계", "인원별 근무 횟수와 조 단위 담당 기간", '<button class="btn" data-action="print">인쇄</button>') +
      '<div class="card"><h3>인원별 통계</h3><table><thead><tr><th>성명</th><th>총 근무</th><th>CCTV</th><th>불침번</th><th>취사지원</th><th>경계</th><th>기타</th><th>휴일근무</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="card" style="margin-top:12px"><h3>조 단위 통계 (4주기 기준)</h3><table><thead><tr><th>조</th><th>CCTV 담당 기간</th><th>불침번 담당 기간</th></tr></thead><tbody>' + g + "</tbody></table></div>";
  }

  function renderSettings() {
    var st = global.DutyApp.state.getState();
    return head("설정", "CCTV/불침번 교대와 수동배정 보호") +
      '<div class="card"><div class="row">' +
      field("교대 시작일", '<input type="date" id="set-start" value="' + st.rotationSettings.startDate + '">') +
      field("교대 주기(일)", '<input type="number" id="set-cycle" value="' + st.rotationSettings.cycleDays + '">') +
      field("조 A 이름", '<input id="set-a" value="' + esc(st.groupMeta.A) + '">') +
      field("조 B 이름", '<input id="set-b" value="' + esc(st.groupMeta.B) + '">') +
      field("조 구성 방식", '<select id="set-mode"><option value="auto">자동</option><option value="manual">수동</option></select>') +
      field("최대 연속근무", '<input type="number" id="set-cons" value="' + st.settings.maxConsecutiveDays + '">') +
      field("수동배정 보호", '<select id="set-protect"><option value="true">ON</option><option value="false">OFF</option></select>') +
      '<button class="btn primary" data-action="save-settings">저장</button></div></div>' +
      '<p class="stat-sub">자동 조편성은 가용 대상 인원을 가능한 한 균등하게 나눕니다. 홀수여도 인원 차이는 최대 1명입니다.</p>';
  }

  function renderData() {
    return head("데이터 관리", "모든 데이터는 이 PC의 localStorage에만 저장됩니다. 외부 전송 없음.") +
      '<div class="card row"><button class="btn primary" data-action="export-json">JSON 내보내기</button>' +
      '<label class="btn">JSON 가져오기<input type="file" id="import-file" accept="application/json" hidden></label>' +
      '<button class="btn" data-action="load-sample">샘플 데이터</button>' +
      '<button class="btn danger" data-action="wipe">전체 초기화</button></div>' +
      '<p class="stat-sub">버전 1.1.0 · 키 militaryDutyData</p>';
  }

  function render(page) {
    uiState.page = page || uiState.page;
    var html = "";
    if (uiState.page === "dashboard") html = renderDashboard();
    else if (uiState.page === "personnel") html = renderPersonnel();
    else if (uiState.page === "leave") html = renderLeave();
    else if (uiState.page === "dispatch") html = renderDispatch();
    else if (uiState.page === "dutyTypes") html = renderDutyTypes();
    else if (uiState.page === "kitchen") html = renderKitchen();
    else if (uiState.page === "guard") html = renderGuard();
    else if (uiState.page === "cctv") html = renderRotationPage("cctv");
    else if (uiState.page === "watch") html = renderRotationPage("watch");
    else if (uiState.page === "replacement") html = renderReplacement();
    else if (uiState.page === "scheduler") html = renderScheduler();
    else if (uiState.page === "roster") html = renderRoster();
    else if (uiState.page === "calendar") html = renderCalendar();
    else if (uiState.page === "stats") html = renderStats();
    else if (uiState.page === "settings") html = renderSettings();
    else if (uiState.page === "data") html = renderData();
    else html = renderDashboard();
    view.innerHTML = html;
    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-page") === uiState.page);
    });
    var sel = document.getElementById("f-status");
    if (sel && uiState._editStatus) sel.value = uiState._editStatus;
    var mode = document.getElementById("set-mode");
    if (mode) mode.value = global.DutyApp.state.getState().settings.groupMode || "manual";
    var prot = document.getElementById("set-protect");
    if (prot) prot.value = String(!!global.DutyApp.state.getState().settings.protectManualAssignments);
    var rs = document.getElementById("roster-status");
    if (rs) rs.value = uiState.rosterStatus || "";
    var file = document.getElementById("import-file");
    if (file) {
      file.addEventListener("change", function (e) {
        var f = e.target.files[0];
        if (!f) return;
        global.DutyApp.export.importJson(f, function (err) {
          if (!err && global.DutyApp.scheduler.autoMaintain) global.DutyApp.scheduler.autoMaintain();
          alert(err ? "가져오기 실패" : "가져오기 완료");
          render(uiState.page);
        });
      });
    }
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  function handle(action, el) {
    if (action === "close-modal") { closeModal(); return; }
    if (action === "print") { window.print(); return; }
    if (action === "new-person") {
      openModal(personForm(null));
      var ns = document.getElementById("f-status");
      if (ns) ns.value = "active";
      return;
    }
    if (action === "edit-person") {
      var p = global.DutyApp.personnel.byId(el.getAttribute("data-id"));
      openModal(personForm(p));
      var es = document.getElementById("f-status");
      if (es) es.value = p.status;
      return;
    }
    if (action === "save-person") {
      global.DutyApp.personnel.save({
        id: val("f-id"), name: val("f-name"), rank: val("f-rank"), company: val("f-company"),
        platoon: val("f-platoon"), position: val("f-position"), status: val("f-status"),
        skills: val("f-skills").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
        restrictions: [], memo: val("f-memo")
      });
      closeModal(); render("personnel"); return;
    }
    if (action === "del-person") { global.DutyApp.personnel.remove(el.getAttribute("data-id")); render("personnel"); return; }
    if (action === "add-leave") {
      if (!val("leave-start") || !val("leave-end")) return;
      global.DutyApp.leave.save({ personId: val("leave-person"), startDate: val("leave-start"), endDate: val("leave-end"), memo: val("leave-memo") });
      global.DutyApp.scheduler.autoMaintain();
      render("leave"); return;
    }
    if (action === "del-leave") { global.DutyApp.leave.remove(el.getAttribute("data-id")); global.DutyApp.scheduler.autoMaintain(); render("leave"); return; }
    if (action === "add-dispatch") {
      if (!val("disp-start") || !val("disp-end")) return;
      global.DutyApp.dispatch.save({ personId: val("disp-person"), startDate: val("disp-start"), endDate: val("disp-end"), memo: val("disp-memo") });
      global.DutyApp.scheduler.autoMaintain();
      render("dispatch"); return;
    }
    if (action === "del-dispatch") { global.DutyApp.dispatch.remove(el.getAttribute("data-id")); global.DutyApp.scheduler.autoMaintain(); render("dispatch"); return; }
    if (action === "toggle-dispatch-history") {
      uiState.showDispatchHistory = !uiState.showDispatchHistory;
      render("dispatch"); return;
    }
    if (action === "toggle-archive-month") {
      var monthKey = el.getAttribute("data-month");
      uiState.archiveMonths[monthKey] = !uiState.archiveMonths[monthKey];
      render("dispatch"); return;
    }
    if (action === "add-duty-type") {
      global.DutyApp.duty.addCustomType(val("type-name"));
      render("dutyTypes"); return;
    }
    if (action === "add-shift") {
      var start = global.DutyApp.calendar.joinTime(val("sh-h1"), val("sh-m1"));
      var end = global.DutyApp.calendar.joinTime(val("sh-h2"), val("sh-m2"));
      if (start === end) { alert("시작 시각과 종료 시각이 같습니다."); return; }
      global.DutyApp.duty.upsertShift(val("sh-type"), {
        order: Number(val("sh-order") || 1),
        startTime: start,
        endTime: end,
        requiredPersonnel: Number(val("sh-req") || 1)
      });
      global.DutyApp.scheduler.autoMaintain();
      render("dutyTypes"); return;
    }
    if (action === "del-shift") {
      global.DutyApp.duty.removeShift(el.getAttribute("data-type"), el.getAttribute("data-id"));
      global.DutyApp.scheduler.autoMaintain();
      render("dutyTypes"); return;
    }
    if (action === "add-kitchen-item") {
      global.DutyApp.duty.addKitchenItem({ label: val("kit-label"), requiredPersonnel: Number(val("kit-req") || 1) });
      global.DutyApp.scheduler.autoMaintain();
      render("dutyTypes"); return;
    }
    if (action === "del-kitchen-item") {
      global.DutyApp.duty.removeKitchenItem(el.getAttribute("data-id"));
      global.DutyApp.scheduler.autoMaintain();
      render("dutyTypes"); return;
    }
    if (action === "add-schedule") {
      global.DutyApp.duty.saveSchedule({
        dutyTypeId: val("sch-type"), date: val("sch-date"), startTime: val("sch-start"), endTime: val("sch-end"),
        requiredPersonnel: Number(val("sch-req") || 1)
      });
      render("dutyTypes"); return;
    }
    if (action === "del-schedule") { global.DutyApp.duty.removeSchedule(el.getAttribute("data-id")); render("dutyTypes"); return; }
    if (action === "manual-assign") {
      var type = el.getAttribute("data-type");
      var dutyType = global.DutyApp.duty.typeById(type);
      var untimed = dutyType && dutyType.timed === false;
      var item = untimed ? (dutyType.items || []).find(function (x) { return x.id === val("ma-item"); }) : null;
      var rec = {
        date: val("ma-date"),
        startTime: untimed ? "" : val("ma-start"),
        endTime: untimed ? "" : val("ma-end"),
        personId: val("ma-person"),
        dutyTypeId: type,
        source: "manual",
        slot: item ? item.label : "",
        slotKey: item ? item.id : "",
        bucket: untimed ? global.DutyApp.holiday.kitchenDayKind(val("ma-date")) : (type === "cctv" ? global.DutyApp.cctv.nextDayBucket(val("ma-date")) : "")
      };
      var chk = global.DutyApp.duty.isAvailableForDuty(rec.personId, rec.date, type, { startTime: rec.startTime, endTime: rec.endTime });
      if (!chk.ok) { alert("배정 불가: " + chk.reasons.join(", ")); return; }
      global.DutyApp.duty.saveAssignment(rec, global.DutyApp.personnel.label(rec.personId) + " 수동배정");
      render(uiState.page); return;
    }
    if (action === "del-assign") { global.DutyApp.duty.removeAssignment(el.getAttribute("data-id")); render(uiState.page); return; }
    if (action === "auto-groups") { global.DutyApp.cctv.autoFormGroups(); global.DutyApp.scheduler.autoMaintain(); render(uiState.page); return; }
    if (action === "reset-groups") { global.DutyApp.cctv.resetGroups(); global.DutyApp.scheduler.autoMaintain(); render(uiState.page); return; }
    if (action === "move-group") { global.DutyApp.cctv.movePerson(el.getAttribute("data-id"), el.getAttribute("data-to")); global.DutyApp.scheduler.autoMaintain(); render(uiState.page); return; }
    if (action === "set-rot-date") { uiState.selectedDate = val("rot-date") || uiState.selectedDate; render(uiState.page); return; }
    if (action === "add-rep") {
      var res = global.DutyApp.replacement.save({
        originalPersonId: val("rep-from"), replacementPersonId: val("rep-to"),
        date: val("rep-date"), dutyId: val("rep-duty"), reason: val("rep-reason")
      });
      if (!res.ok) alert(res.reason);
      render("replacement"); return;
    }
    if (action === "del-rep") { global.DutyApp.replacement.remove(el.getAttribute("data-id")); render("replacement"); return; }
    if (action === "preview-assign") {
      uiState.schedStart = val("sc-start"); uiState.schedEnd = val("sc-end");
      uiState.preview = global.DutyApp.scheduler.run(uiState.schedStart, uiState.schedEnd, false);
      render("scheduler"); return;
    }
    if (action === "apply-assign") {
      uiState.schedStart = val("sc-start") || uiState.schedStart;
      uiState.schedEnd = val("sc-end") || uiState.schedEnd;
      uiState.preview = global.DutyApp.scheduler.run(uiState.schedStart, uiState.schedEnd, true);
      render("scheduler"); return;
    }
    if (action === "undo-assign") {
      if (!global.DutyApp.state.restoreAutoSnapshot()) alert("취소할 자동배정 스냅샷이 없습니다.");
      render("scheduler"); return;
    }
    if (action === "set-roster") {
      uiState.rosterDate = val("roster-date") || uiState.rosterDate;
      uiState.rosterCompany = val("roster-company");
      uiState.rosterStatus = val("roster-status");
      uiState.rosterQuery = val("roster-query");
      render("roster"); return;
    }
    if (action === "set-count-month") {
      uiState.countMonth = val("count-month") || uiState.countMonth;
      render(uiState.page); return;
    }
    if (action === "set-kitchen-month") {
      uiState.kitchenMonth = val("kitchen-month") || uiState.kitchenMonth;
      render("kitchen"); return;
    }
    if (action === "assign-kitchen-month") {
      uiState.kitchenMonth = val("kitchen-month") || uiState.kitchenMonth;
      global.DutyApp.scheduler.assignKitchenMonth(uiState.kitchenMonth);
      render("kitchen"); return;
    }
    if (action === "cal-prev") {
      uiState.month -= 1; if (uiState.month < 1) { uiState.month = 12; uiState.year -= 1; }
      render("calendar"); return;
    }
    if (action === "cal-next") {
      uiState.month += 1; if (uiState.month > 12) { uiState.month = 1; uiState.year += 1; }
      render("calendar"); return;
    }
    if (action === "cal-day") { uiState.selectedDate = el.getAttribute("data-date"); uiState.rosterDate = uiState.selectedDate; render("roster"); return; }
    if (action === "add-hol") {
      global.DutyApp.holiday.save({ date: val("hol-date"), name: val("hol-name"), type: val("hol-type") });
      render("calendar"); return;
    }
    if (action === "del-hol") { global.DutyApp.holiday.remove(el.getAttribute("data-date"), el.getAttribute("data-name")); render("calendar"); return; }
    if (action === "save-settings") {
      global.DutyApp.state.mutate(function (s) {
        s.rotationSettings.startDate = val("set-start");
        s.rotationSettings.cycleDays = Number(val("set-cycle") || 45);
        s.groupMeta.A = val("set-a"); s.groupMeta.B = val("set-b");
        s.settings.groupMode = val("set-mode");
        s.settings.maxConsecutiveDays = Number(val("set-cons") || 2);
        s.settings.protectManualAssignments = val("set-protect") === "true";
      }, "설정 저장");
      render("settings"); return;
    }
    if (action === "export-json") { global.DutyApp.export.exportJson(); return; }
    if (action === "load-sample") {
      global.DutyApp.state.resetToSample();
      global.DutyApp.scheduler.autoMaintain();
      render("data"); return;
    }
    if (action === "wipe") {
      if (confirm("모든 로컬 데이터를 지울까요?")) { global.DutyApp.state.resetEmpty(); render("data"); }
      return;
    }
  }

  function init() {
    view = document.getElementById("view");
    modalRoot = document.getElementById("modalRoot");
    document.body.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (t) handle(t.getAttribute("data-action"), t);
      var nav = e.target.closest("[data-page]");
      if (nav && nav.classList.contains("nav-btn")) render(nav.getAttribute("data-page"));
    });
    var today = global.DutyApp.calendar.today();
    uiState.rosterDate = today;
    uiState.selectedDate = today;
    uiState.kitchenMonth = today.slice(0, 7);
    uiState.countMonth = today.slice(0, 7);
    uiState.schedStart = global.DutyApp.calendar.monthStart(today);
    uiState.schedEnd = global.DutyApp.calendar.monthEnd(today);
    global.DutyApp.dispatch.archiveEnded();
    global.DutyApp.scheduler.autoMaintain();
    render("dashboard");
  }

  global.DutyApp.ui = { init: init, render: render, uiState: uiState };
})(window);
