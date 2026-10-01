(function (global) {
  var STORAGE_KEY = "militaryDutyData";
  var HISTORY_LIMIT = 80;

  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultDutyTypes() {
    return [
      { id: "cctv", name: "CCTV", category: "rotation", defaultStart: "22:00", defaultEnd: "02:00", requiredPersonnel: 2, skill: "" },
      { id: "watch", name: "불침번", category: "rotation", defaultStart: "22:00", defaultEnd: "02:00", requiredPersonnel: 2, skill: "" },
      { id: "kitchen", name: "취사지원", category: "general", defaultStart: "05:30", defaultEnd: "08:00", requiredPersonnel: 3, skill: "kitchen" },
      { id: "guard", name: "경계근무", category: "general", defaultStart: "22:00", defaultEnd: "00:00", requiredPersonnel: 2, skill: "" },
      { id: "other", name: "기타 근무", category: "general", defaultStart: "09:00", defaultEnd: "17:00", requiredPersonnel: 1, skill: "" }
    ];
  }

  function defaultHolidays() {
    return [
      { date: "2026-01-01", name: "신정", type: "national" },
      { date: "2026-02-16", name: "설날", type: "national" },
      { date: "2026-02-17", name: "설날", type: "national" },
      { date: "2026-02-18", name: "설날", type: "national" },
      { date: "2026-03-01", name: "삼일절", type: "national" },
      { date: "2026-05-05", name: "어린이날", type: "national" },
      { date: "2026-05-24", name: "부처님오신날", type: "national" },
      { date: "2026-06-06", name: "현충일", type: "national" },
      { date: "2026-08-15", name: "광복절", type: "national" },
      { date: "2026-09-24", name: "추석", type: "national" },
      { date: "2026-09-25", name: "추석", type: "national" },
      { date: "2026-09-26", name: "추석", type: "national" },
      { date: "2026-10-03", name: "개천절", type: "national" },
      { date: "2026-10-09", name: "한글날", type: "national" },
      { date: "2026-12-25", name: "성탄절", type: "national" },
      { date: "2026-10-01", name: "국군의 날", type: "military" }
    ];
  }

  function samplePersonnel() {
    var ranks = ["병장", "상병", "일병", "이등병", "하사"];
    var names = [
      "홍길동", "김철수", "이영희", "박민수", "최영수", "정우성",
      "강태양", "윤서준", "조민재", "한지훈", "오지훈", "신동욱",
      "배성호", "임재현", "문성민", "서준호"
    ];
    return names.map(function (name, i) {
      var n = i + 1;
      var id = "P" + String(n).padStart(3, "0");
      return {
        id: id,
        name: name,
        rank: ranks[i % ranks.length],
        company: "1중대",
        platoon: (i % 2 === 0 ? "1소대" : "2소대"),
        position: i === 0 ? "분대장" : "분대원",
        status: "active",
        skills: i % 3 === 0 ? ["kitchen"] : [],
        restrictions: [],
        memo: ""
      };
    });
  }

  function emptyState() {
    return {
      version: "1.0.0",
      personnel: [],
      leaves: [],
      dispatches: [],
      holidays: defaultHolidays(),
      dutyTypes: defaultDutyTypes(),
      dutySchedules: [],
      assignments: [],
      replacements: [],
      dutyGroups: { cctv: [], watch: [] },
      groupMeta: { A: "CCTV조", B: "불침번조" },
      rotationSettings: { startDate: "2026-10-01", cycleDays: 45 },
      settings: {
        maxConsecutiveDays: 2,
        protectManualAssignments: true,
        groupMode: "manual",
        cctvSlots: [
          { startTime: "18:00", endTime: "22:00", requiredPersonnel: 2 },
          { startTime: "22:00", endTime: "02:00", requiredPersonnel: 2 },
          { startTime: "02:00", endTime: "06:00", requiredPersonnel: 2 }
        ],
        watchSlots: [
          { startTime: "22:00", endTime: "02:00", requiredPersonnel: 2 },
          { startTime: "02:00", endTime: "06:00", requiredPersonnel: 2 }
        ],
        kitchenSlots: [
          { id: "morning", label: "아침", startTime: "05:30", endTime: "08:00", requiredPersonnel: 3 }
        ],
        guardSlots: [
          { startTime: "22:00", endTime: "00:00", requiredPersonnel: 2 }
        ]
      },
      history: [],
      lastAutoSnapshot: null
    };
  }

  function sampleState() {
    var state = emptyState();
    state.personnel = samplePersonnel();
    var ids = state.personnel.map(function (p) { return p.id; });
    var mid = Math.ceil(ids.length / 2);
    state.dutyGroups.cctv = ids.slice(0, mid);
    state.dutyGroups.watch = ids.slice(mid);
    state.leaves = [
      { id: uid("L"), personId: "P003", startDate: "2026-10-05", endDate: "2026-10-07", type: "leave", memo: "정기휴가" }
    ];
    state.dispatches = [
      { id: uid("D"), personId: "P002", startDate: "2026-10-01", endDate: "2026-11-15", type: "dispatch", memo: "교육파견" }
    ];
    return state;
  }

  var appState = emptyState();
  var listeners = [];

  function notify() {
    listeners.forEach(function (fn) { fn(appState); });
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {}
    notify();
  }

  function addHistory(text) {
    appState.history = appState.history || [];
    appState.history.unshift({ at: new Date().toISOString(), text: text });
    appState.history = appState.history.slice(0, HISTORY_LIMIT);
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        appState = Object.assign(emptyState(), parsed);
        appState.dutyGroups = Object.assign({ cctv: [], watch: [] }, appState.dutyGroups);
        appState.settings = Object.assign(emptyState().settings, appState.settings);
        appState.rotationSettings = Object.assign(emptyState().rotationSettings, appState.rotationSettings);
        return;
      }
    } catch (e) {}
    appState = sampleState();
    persist();
  }

  function setState(next, historyText) {
    appState = next;
    if (historyText) addHistory(historyText);
    persist();
  }

  function mutate(fn, historyText) {
    fn(appState);
    if (historyText) addHistory(historyText);
    persist();
  }

  function getState() {
    return appState;
  }

  function resetToSample() {
    appState = sampleState();
    addHistory("샘플 데이터로 초기화");
    persist();
  }

  function resetEmpty() {
    appState = emptyState();
    addHistory("데이터 전체 초기화");
    persist();
  }

  function importData(data) {
    var next = Object.assign(emptyState(), data);
    next.dutyGroups = Object.assign({ cctv: [], watch: [] }, next.dutyGroups);
    next.settings = Object.assign(emptyState().settings, next.settings || {});
    next.rotationSettings = Object.assign(emptyState().rotationSettings, next.rotationSettings || {});
    appState = next;
    addHistory("JSON 가져오기 완료");
    persist();
  }

  function exportData() {
    var data = clone(appState);
    data.version = data.version || "1.0.0";
    return data;
  }

  function snapshotForUndo() {
    appState.lastAutoSnapshot = clone(appState.assignments);
    persist();
  }

  function restoreAutoSnapshot() {
    if (!appState.lastAutoSnapshot) return false;
    appState.assignments = clone(appState.lastAutoSnapshot);
    addHistory("자동배정 취소");
    persist();
    return true;
  }

  function subscribe(fn) {
    listeners.push(fn);
  }

  global.DutyApp = global.DutyApp || {};
  global.DutyApp.state = {
    STORAGE_KEY: STORAGE_KEY,
    uid: uid,
    clone: clone,
    load: load,
    persist: persist,
    getState: getState,
    setState: setState,
    mutate: mutate,
    addHistory: addHistory,
    resetToSample: resetToSample,
    resetEmpty: resetEmpty,
    importData: importData,
    exportData: exportData,
    snapshotForUndo: snapshotForUndo,
    restoreAutoSnapshot: restoreAutoSnapshot,
    subscribe: subscribe,
    emptyState: emptyState,
    sampleState: sampleState
  };
})(window);
