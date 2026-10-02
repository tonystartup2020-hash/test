// Tests for the 健康 tab's pure rules. Run: node --test dashboard/test/
import test from "node:test";
import assert from "node:assert/strict";
import { loadLogic } from "./logic.mjs";

const L = loadLogic([
  "HEALTH", "healthDay", "num", "isTestRow", "normalizeMeal", "normalizeWorkout", "normalizeBody",
  "burnKcal", "workoutBurn", "latestWeight", "kcalLine", "proteinLine", "waterLine",
  "waterRow", "waterTotal", "waterAfter", "waterCreateProps", "hlDayTitle",
  "weekStart", "weekSummary", "canGoNextWeek", "weekLabel",
  "parseWeight", "weightPlan", "weightSeries",
  "workoutEntry", "workoutProps", "workoutTitle", "savedLine", "mealOrderKey", "todayMeals", "todayWorkouts",
]);

const meal = (o) => ({ "標題": "午餐｜便當", "餐別": "午餐", "內容": "便當", "測試資料": "__NO__", url: "https://app.notion.com/p/" + "a".repeat(32), ...o });
const workout = (o) => ({ "標題": "排球課", "類型": "排球課", "測試資料": "__NO__", url: "https://app.notion.com/p/" + "b".repeat(32), ...o });
const body = (o) => ({ "標題": "x", "測試資料": "__NO__", url: "https://app.notion.com/p/" + "c".repeat(32), ...o });
const habit = (o) => ({ "標題": "10/2（五）", "測試資料": "__NO__", url: "https://app.notion.com/p/" + "d".repeat(32), ...o });

test("goals live in one place", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(L.HEALTH)), { kcal: 1850, protein: 140, water: 2600, breakfastWater: 600, targetWeight: 78.3, defaultWeight: 87.7 });
});

test("4am day: a meal at Taipei 9/30 00:30 counts for 9/29", () => {
  assert.equal(L.healthDay("2026-09-29T16:30:00.000Z"), "2026-09-29");
  assert.equal(L.normalizeMeal(meal({ "date:日期:start": "2026-09-29T16:30:00.000Z" })).day, "2026-09-29");
});
test("4am day: Taipei 04:00 is already the new day", () => {
  assert.equal(L.healthDay("2026-09-29T20:00:00.000Z"), "2026-09-30");
});
test("a date-only meal counts on that day, no 4am shift", () => {
  assert.equal(L.normalizeMeal(meal({ "date:日期:start": "2026-10-02" })).day, "2026-10-02");
});
test("UTC times are shown in Taipei time", () => {
  assert.equal(L.normalizeMeal(meal({ "date:日期:start": "2026-09-30T04:15:00.000Z" })).time, "12:15");
});

test("empty number fields (missing keys) count as 0, never NaN", () => {
  const m = L.normalizeMeal(meal({ "date:日期:start": "2026-10-02" }));
  assert.equal(m.kcal, 0);
  assert.equal(m.protein, 0);
  assert.equal(L.num(undefined), 0);
  assert.equal(L.num(""), 0);
  assert.equal(L.num(null), 0);
  const w = L.normalizeWorkout(workout({ "date:日期:start": "2026-10-02" }), 87.7);
  assert.equal(w.minutes, 0);
  assert.equal(w.kcal, 0);
  assert.equal(L.waterRow([habit({ "date:日期:start": "2026-10-02" })], "2026-10-02").stored, 0);
});

test("test rows are excluded: 測試資料 ticked or title starting 【測試】", () => {
  assert.equal(L.isTestRow(meal({ "測試資料": "__YES__" })), true);
  assert.equal(L.isTestRow(meal({ "標題": "【測試】晚餐" })), true);
  assert.equal(L.isTestRow(meal({})), false);
  const rows = [
    meal({ "date:日期:start": "2026-10-02", "估計熱量": 500 }),
    meal({ "date:日期:start": "2026-10-02", "估計熱量": 999, "測試資料": "__YES__" }),
    meal({ "date:日期:start": "2026-10-02", "估計熱量": 999, "標題": "【測試】宵夜" }),
  ];
  const today = L.todayMeals(rows, "2026-10-02");
  assert.equal(today.length, 1);
  assert.equal(today[0].kcal, 500);
  assert.equal(L.latestWeight([body({ "項目": "體重", "體重": 60, "date:日期:start": "2026-10-02", "測試資料": "__YES__" })]), 87.7);
  assert.equal(L.waterRow([habit({ "date:日期:start": "2026-10-02", "喝水量": 900, "測試資料": "__YES__" })], "2026-10-02").id, null);
});

test("burn formula: the four worked examples at 87.7 kg", () => {
  assert.equal(L.workoutBurn("排球課", 120, 87.7), 530);
  assert.equal(L.workoutBurn("排球（朋友）", 120, 87.7), 530);
  assert.equal(L.workoutBurn("健身房", 60, 87.7), 220); // no split: all weights
  assert.equal(L.workoutBurn("健身房", 0, 87.7, { lift: 0, cardio: 30 }), 260);
  assert.equal(L.workoutBurn("走路", 30, 87.7), 140);
});
test("burn formula: gym 60 weights + 30 cardio = 480", () => {
  assert.equal(L.workoutBurn("健身房", 90, 87.7, { lift: 60, cardio: 30 }), 480);
});
test("burn formula never goes below 0 and rounds to 10", () => {
  assert.equal(L.burnKcal(4, 87.7, -30), 0);
  assert.equal(L.workoutBurn("復健", 45, 87.7) % 10, 0);
  assert.equal(L.workoutBurn("其他", 60, 87.7), 260);
});

test("a stored 消耗大卡 is used; without it the burn is computed", () => {
  assert.equal(L.normalizeWorkout(workout({ "時長": 120, "消耗大卡": 400, "date:日期:start": "2026-10-02" }), 87.7).kcal, 400);
  assert.equal(L.normalizeWorkout(workout({ "時長": 120, "date:日期:start": "2026-10-02" }), 87.7).kcal, 530);
  assert.equal(L.normalizeWorkout(workout({ "類型": "健身房", "時長": 90, "date:日期:start": "2026-10-02" }), 87.7).kcal, 330);
});

test("weight for the formula: latest body record with a weight, else 87.7", () => {
  assert.equal(L.latestWeight([]), 87.7);
  assert.equal(L.latestWeight([body({ "項目": "腳踝", "腳踝痛": 3, "date:日期:start": "2026-10-01" })]), 87.7);
  assert.equal(L.latestWeight([
    body({ "項目": "InBody", "體重": 87.7, "date:日期:start": "2026-04-14" }),
    body({ "項目": "體重", "體重": 86.9, "date:日期:start": "2026-10-05" }),
    body({ "項目": "腳踝", "date:日期:start": "2026-10-06" }),
  ]), 86.9);
});

test("today lines: kcal left / over, protein, water", () => {
  assert.equal(L.kcalLine(1200), "還剩約 650 大卡");
  assert.equal(L.kcalLine(2200), "超過約 350 大卡");
  assert.equal(L.proteinLine(129), "還差 11 公克");
  assert.equal(L.proteinLine(140), "達標");
  assert.equal(L.proteinLine(155), "達標");
  assert.equal(L.waterLine(2599), "還差 1 cc");
  assert.equal(L.waterLine(2600), "達標");
});

test("water: breakfast ticked adds 600, not ticked adds nothing", () => {
  assert.equal(L.waterTotal(1000, true), 1600);
  assert.equal(L.waterTotal(1000, false), 1000);
  assert.equal(L.waterTotal(undefined, true), 600);
  const r = L.waterRow([habit({ "date:日期:start": "2026-10-02", "健康早餐": "__YES__", "喝水量": 500 })], "2026-10-02");
  assert.equal(r.stored, 500);
  assert.equal(r.breakfast, true);
  assert.equal(r.id, "d".repeat(32));
});
test("water: 2,599 is not enough, 2,600 is", () => {
  assert.equal(L.waterLine(L.waterTotal(1999, true)), "還差 1 cc");
  assert.equal(L.waterLine(L.waterTotal(2000, true)), "達標");
});
test("water: undo never goes negative", () => {
  assert.equal(L.waterAfter(300, -500), 0);
  assert.equal(L.waterAfter(1000, -500), 500);
  assert.equal(L.waterAfter(undefined, 600), 600);
});
test("water: a new habit row gets the habit title format and a date-only date", () => {
  assert.equal(L.hlDayTitle("2026-10-03"), "10/3（六）");
  assert.deepEqual(JSON.parse(JSON.stringify(L.waterCreateProps("2026-10-03", 500))),
    { "標題": "10/3（六）", "date:日期:start": "2026-10-03", "date:日期:is_datetime": 0, "喝水量": 500 });
});

test("week: Sunday 2026-10-04 belongs to the week starting Monday 9/28", () => {
  assert.equal(L.weekStart("2026-10-04"), "2026-09-28");
  assert.equal(L.weekStart("2026-09-28"), "2026-09-28");
  assert.equal(L.weekStart("2026-10-05"), "2026-10-05");
  assert.equal(L.weekLabel("2026-09-28"), "9/28（一）– 10/4（日）");
});
test("week: average only counts days with meals logged; future days are left out", () => {
  const meals = [
    meal({ "date:日期:start": "2026-09-28", "估計熱量": 1800, "估計蛋白質": 150 }),
    meal({ "date:日期:start": "2026-09-30", "估計熱量": 1000, "估計蛋白質": 60 }),
    meal({ "date:日期:start": "2026-09-30T10:00:00.000Z", "估計熱量": 600, "估計蛋白質": 30 }),
    meal({ "date:日期:start": "2026-10-03", "估計熱量": 5000, "估計蛋白質": 300 }), // after "today"
  ].map((r) => L.normalizeMeal(r));
  const workouts = [
    L.normalizeWorkout(workout({ "date:日期:start": "2026-09-29T11:15:00.000Z", "時長": 120 }), 87.7),
    L.normalizeWorkout(workout({ "date:日期:start": "2026-10-03T01:00:00.000Z", "時長": 120 }), 87.7),
  ];
  const habits = [
    habit({ "date:日期:start": "2026-09-28", "喝水量": 2000, "健康早餐": "__YES__" }),
    habit({ "date:日期:start": "2026-09-29", "喝水量": 2599 }),
    habit({ "date:日期:start": "2026-10-03", "喝水量": 3000 }),
  ];
  const w = L.weekSummary("2026-09-28", "2026-10-02", meals, workouts, habits);
  assert.equal(w.avgKcal, 1700); // (1800 + 1600) / 2
  assert.equal(w.loggedDays, 2);
  assert.equal(w.proteinDays, 1);
  assert.equal(w.waterDays, 1); // 9/28: 2000 + 600 breakfast
  assert.equal(w.workoutCount, 1);
  assert.equal(w.burnTotal, 530);
  assert.equal(w.days.length, 7);
  assert.equal(w.days[5].future, true);
  assert.equal(w.days[1].logged, false);
});
test("week: a week with nothing logged does not divide by zero", () => {
  const w = L.weekSummary("2026-09-21", "2026-10-02", [], [], []);
  assert.equal(w.avgKcal, null);
  assert.equal(w.proteinDays, 0);
  assert.equal(w.burnTotal, 0);
});
test("week: cannot move into the future", () => {
  assert.equal(L.canGoNextWeek("2026-09-28", "2026-10-02"), false);
  assert.equal(L.canGoNextWeek("2026-09-21", "2026-10-02"), true);
});

test("weight: same Taipei day already has a 體重 row → update it", () => {
  const rows = [body({ "項目": "體重", "體重": 88, "date:日期:start": "2026-10-05", url: "https://app.notion.com/p/" + "e".repeat(32) })];
  const p = L.weightPlan(rows, "2026-10-05", 87.6);
  assert.equal(p.action, "update");
  assert.equal(p.id, "e".repeat(32));
  assert.deepEqual(JSON.parse(JSON.stringify(p.props)), { "體重": 87.6 });
});
test("weight: only an InBody row that day → create a new 體重 row", () => {
  const rows = [body({ "項目": "InBody", "體重": 88, "date:日期:start": "2026-10-05" })];
  const p = L.weightPlan(rows, "2026-10-05", 87.6);
  assert.equal(p.action, "create");
  assert.deepEqual(JSON.parse(JSON.stringify(p.props)),
    { "標題": "2026-10-05 體重", "date:日期:start": "2026-10-05", "date:日期:is_datetime": 0, "項目": "體重", "體重": 87.6 });
});
test("weight: a test 體重 row the same day is ignored", () => {
  const rows = [body({ "項目": "體重", "體重": 88, "date:日期:start": "2026-10-05", "測試資料": "__YES__" })];
  assert.equal(L.weightPlan(rows, "2026-10-05", 87.6).action, "create");
});
test("weight input: one decimal, sane range", () => {
  assert.equal(L.parseWeight("87.46"), 87.5);
  assert.equal(L.parseWeight("88"), 88);
  assert.equal(L.parseWeight(""), null);
  assert.equal(L.parseWeight("8.8"), null);
});
test("weight curve: 體重 and InBody, oldest first, no test rows or ankle rows", () => {
  const s = L.weightSeries([
    body({ "項目": "體重", "體重": 86.9, "date:日期:start": "2026-10-05" }),
    body({ "項目": "腳踝", "腳踝痛": 3, "date:日期:start": "2026-10-04" }),
    body({ "項目": "InBody", "體重": 87.7, "date:日期:start": "2026-04-14" }),
    body({ "項目": "體重", "體重": 80, "date:日期:start": "2026-10-03", "測試資料": "__YES__" }),
  ]);
  assert.deepEqual([...s].map((p) => [p.day, p.kg]), [["2026-04-14", 87.7], ["2026-10-05", 86.9]]);
});

test("record a workout: volleyball defaults and the saved line", () => {
  const e = L.workoutEntry({ type: "排球課", minutes: 120, effort: 7, sore: "", learned: "等球到最高點再跳" }, 87.7);
  assert.equal(e.error, undefined);
  assert.equal(e.kcal, 530);
  assert.equal(L.savedLine(e), "已記：排球課 120 分鐘，約 530 大卡");
  const p = JSON.parse(JSON.stringify(L.workoutProps(e, Date.parse("2026-10-02T01:30:00Z"))));
  assert.deepEqual(p, {
    "標題": "排球課", "date:日期:start": "2026-10-02T09:30:00+08:00", "date:日期:is_datetime": 1,
    "類型": "排球課", "時長": 120, "消耗大卡": 530, "原始輸入": "網頁快速記", "累的程度": 7,
    "學到什麼／下次改進": "等球到最高點再跳",
  });
});
test("record a workout: gym stores total minutes, both burns, parts as JSON and a parts title", () => {
  const e = L.workoutEntry({ type: "健身房", lift: 60, cardio: 30, parts: ["腿", "核心", "有氧"], learned: "ignored" }, 87.7);
  assert.equal(e.minutes, 90);
  assert.equal(e.kcal, 480);
  assert.equal(e.title, "健身房｜腿＋核心");
  const p = L.workoutProps(e, Date.parse("2026-10-02T01:30:00Z"));
  assert.equal(p["部位"], JSON.stringify(["腿", "核心", "有氧"]));
  assert.equal(p["學到什麼／下次改進"], undefined);
  assert.equal(L.workoutTitle("健身房", []), "健身房");
  assert.equal(L.workoutTitle("健身房", ["有氧"]), "健身房｜有氧");
  assert.equal(L.workoutTitle("走路", []), "走路");
});
test("record a workout: bad input is refused", () => {
  assert.ok(L.workoutEntry({ type: "走路", minutes: 0 }, 87.7).error);
  assert.ok(L.workoutEntry({ type: "健身房", lift: 0, cardio: 0 }, 87.7).error);
  assert.ok(L.workoutEntry({ type: "跳舞", minutes: 30 }, 87.7).error);
  assert.equal(L.workoutEntry({ type: "走路", minutes: 30, effort: 11 }, 87.7).effort, null);
});

test("today's lists: meals in eating order from 4am, workouts with burn", () => {
  const rows = [
    meal({ "餐別": "宵夜", "date:日期:start": "2026-10-02T16:30:00.000Z" }), // 10/3 00:30 → still 10/2
    meal({ "餐別": "早餐", "date:日期:start": "2026-10-02" }),
    meal({ "餐別": "午餐", "date:日期:start": "2026-10-02T04:15:00.000Z" }),
  ];
  assert.deepEqual([...L.todayMeals(rows, "2026-10-02")].map((m) => m.meal), ["早餐", "午餐", "宵夜"]);
  const ws = L.todayWorkouts([workout({ "date:日期:start": "2026-10-02T11:15:00.000Z", "時長": 120 })], "2026-10-02", 87.7);
  assert.equal(ws.length, 1);
  assert.equal(ws[0].kcal, 530);
});
