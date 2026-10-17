(() => {
  "use strict";
  const STORAGE_KEY = "xiangqian-tasks-v3";
  const LEGACY_STORAGE_KEYS = ["xiangqian-tasks-v2", "xiangqian-tasks-v1"];
  const DAILY_TARGET_DEFAULT = 6;
  const goalCategories = [
    { id: "money", label: "存钱目标", icon: "◈", type: "amount" },
    { id: "skills", label: "技能与证书", icon: "✳", type: "count" },
    { id: "culture", label: "文化内涵", icon: "▤", type: "checklist" },
    { id: "appearance", label: "气质与形象", icon: "✿", type: "checklist" },
    { id: "diet", label: "膳食与健康习惯", icon: "❋", type: "checklist" },
    { id: "investment", label: "理财规划", icon: "↗", type: "checklist" },
    { id: "badminton", label: "羽毛球专项训练", icon: "⌁", type: "checklist" },
    { id: "custom", label: "自定义目标", icon: "◎", type: "checklist" }
  ];
  const initialGoals = [
    {
      id: "goal-savings", name: "存款达到 100 万元", category: "money", description: "记录目前可用于该目标的存款；按实际余额更新，不把预期收益算作已完成。",
      current: 0, target: 1000000, unit: "元",
      items: [
        { name: "盘点目前储蓄并设定每月存款计划", done: false },
        { name: "每月记录实际存款进度", done: false },
        { name: "每季度复核目标进度与计划", done: false }
      ]
    },
    {
      id: "goal-skills", name: "掌握 10 项技能或证书", category: "skills", description: "先添加你认可的技能、课程成果或证书，再逐项记录是否已掌握。",
      current: 0, target: 10, unit: "项",
      items: [
        { name: "添加第 1 项技能 / 证书（编辑填写名称）", done: false },
        { name: "添加第 2 项技能 / 证书（编辑填写名称）", done: false },
        { name: "添加第 3 项技能 / 证书（编辑填写名称）", done: false }
      ]
    },
    {
      id: "goal-culture", name: "持续积累文化内涵", category: "culture", description: "以阅读、学习、表达和复盘留下可观察的积累。可按自己的兴趣修改每一项。",
      items: [
        { name: "制定适合自己的阅读与学习清单", done: false },
        { name: "完成一本书或一门课程并记录心得", done: false },
        { name: "每周写下一段学习体会", done: false },
        { name: "每月整理一次读书或学习笔记", done: false }
      ]
    },
    {
      id: "goal-appearance", name: "养成得体的气质与形象", category: "appearance", description: "围绕仪容、穿着、姿态和表达设定可持续的个人习惯。",
      items: [
        { name: "整理适合自己的日常穿搭与衣物清单", done: false },
        { name: "建立稳定的个人清洁与仪容整理习惯", done: false },
        { name: "每周练习姿态、步态或表达", done: false },
        { name: "每月回顾一次形象管理习惯", done: false }
      ]
    },
    {
      id: "goal-diet", name: "建立适合自己的膳食与健康习惯", category: "diet", description: "记录饮食、作息及自身感受，逐步整理适合自己的饮食安排；不根据体质标签自行诊断或替代专业评估。",
      items: [
        { name: "记录一周饮食、饮水、作息和身体感受", done: false },
        { name: "整理个人饮食偏好与需要留意的食物", done: false },
        { name: "如有不适，向合格医疗专业人员咨询个体建议", done: false },
        { name: "根据个人需求制定并每周复核饮食表", done: false }
      ]
    },
    {
      id: "goal-investment", name: "建立清晰、可复核的理财计划", category: "investment", description: "先盘点收支、风险承受能力和资金用途；记录决策依据并定期复核，不把预期回报视为保证。",
      items: [
        { name: "记录每月收入、支出与现金流", done: false },
        { name: "整理应急资金、负债与资金期限", done: false },
        { name: "写下个人风险承受能力与投资规则", done: false },
        { name: "每季度复核资产配置与实际风险", done: false }
      ]
    },
    {
      id: "goal-badminton", name: "持续提升羽毛球专项能力", category: "badminton", description: "把专项训练拆成脚步、技术、体能与实战复盘，按实际训练情况调整。",
      items: [
        { name: "制定每周羽毛球训练安排", done: false },
        { name: "练习启动、并步与场上移动步法", done: false },
        { name: "练习高远球、吊球、网前球和发接发", done: false },
        { name: "记录对抗练习中的失误与改进点", done: false }
      ]
    }
  ];
  const periods = [
    { id: "daily", label: "每日任务", icon: "☀", subtitle: "当天的每一项完成，都会记在真实日期里。" },
    { id: "weekly", label: "每周任务", icon: "◷", subtitle: "以周一至周日的七个自然日汇总。" },
    { id: "monthly", label: "每月任务", icon: "▦", subtitle: "每周汇总当周日期，并累计成自然月。" },
    { id: "yearly", label: "每年任务", icon: "✳", subtitle: "每月汇总每日清单，并累计成自然年。" },
    { id: "threeYear", label: "3 年计划", icon: "⌁", years: 3, subtitle: "按自然年、月份和日期逐层累计。" },
    { id: "fiveYear", label: "5 年计划", icon: "⌑", years: 5, subtitle: "按自然年、月份和日期逐层累计。" },
    { id: "tenYear", label: "10 年愿景", icon: "◎", years: 10, subtitle: "按自然年、月份和日期逐层累计。" }
  ];
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[char]);
  const safeExternalUrl = value => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  };
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const todayKey = dateKey(new Date());
  let toastTimeout;
  let mentorServiceAvailable = false;

  function parseDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  function shiftDate(value, days) {
    const date = parseDate(value);
    date.setDate(date.getDate() + days);
    return dateKey(date);
  }

  function emptyState() {
    return {
      goal: { title: "成为更好的自己", description: "不必一下子到达。照顾好今天的自己，未来就会慢慢展开。" },
      goals: initialGoals.map(goal => ({
        ...goal,
        type: goalCategories.find(category => category.id === goal.category).type,
        items: goal.items.map(item => ({ ...item, id: makeId("item") }))
      })),
      tasks: [],
      dailyTargets: {},
      activePeriod: "daily",
      selectedDate: todayKey
    };
  }

  function sanitizeAdvisor(advisor) {
    if (!advisor || typeof advisor !== "object") return null;
    const sources = Array.isArray(advisor.sources) ? advisor.sources.filter(source =>
      source && typeof source.id === "string" && typeof source.title === "string" && safeExternalUrl(source.url)
    ).slice(0, 30).map(source => ({
      id: source.id.slice(0, 40),
      title: source.title.slice(0, 300),
      url: safeExternalUrl(source.url)
    })) : [];
    const sourceIds = new Set(sources.map(source => source.id));
    const recommendations = Array.isArray(advisor.recommendations) ? advisor.recommendations.filter(item =>
      item && typeof item === "object" && typeof item.title === "string"
    ).slice(0, 20).map(item => ({
      title: item.title.slice(0, 200),
      rationale: typeof item.rationale === "string" ? item.rationale.slice(0, 1000) : "",
      steps: Array.isArray(item.steps) ? item.steps.filter(step => typeof step === "string").slice(0, 10).map(step => step.slice(0, 500)) : [],
      confidence: typeof item.confidence === "string" ? item.confidence.slice(0, 60) : "",
      caveat: typeof item.caveat === "string" ? item.caveat.slice(0, 500) : "",
      evidence_ids: Array.isArray(item.evidence_ids) ? item.evidence_ids.filter(id => typeof id === "string" && sourceIds.has(id)).slice(0, 10) : []
    })) : [];
    return {
      summary: typeof advisor.summary === "string" ? advisor.summary.slice(0, 1500) : "",
      recommendations,
      limitations: Array.isArray(advisor.limitations) ? advisor.limitations.filter(item => typeof item === "string").slice(0, 10).map(item => item.slice(0, 500)) : [],
      sources,
      generated_at: typeof advisor.generated_at === "string" ? advisor.generated_at.slice(0, 40) : ""
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
      if (!raw) return emptyState();
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object" || !Array.isArray(data.tasks)) return emptyState();
      const legacy = !data.dailyTargets;
      const tasks = data.tasks.filter(task => task && typeof task.id === "string" && typeof task.name === "string")
        .map(task => {
          const oldProgress = Number.isFinite(task.progress) ? Math.max(0, Math.min(100, Math.round(task.progress))) : 0;
          let note = typeof task.note === "string" ? task.note.slice(0, 180) : "";
          if (legacy && oldProgress > 0 && oldProgress < 100) {
            const previousProgress = `旧版记录进度 ${oldProgress}%`;
            note = note ? `${note}（${previousProgress}）` : previousProgress;
          }
          return {
            id: task.id,
            name: task.name.slice(0, 80),
            date: parseDate(task.date) ? task.date : todayKey,
            note,
            done: typeof task.done === "boolean" ? task.done : oldProgress === 100
          };
        });
      const dailyTargets = {};
      if (data.dailyTargets && typeof data.dailyTargets === "object" && !Array.isArray(data.dailyTargets)) {
        for (const [date, target] of Object.entries(data.dailyTargets)) {
          if (parseDate(date) && Number.isFinite(target)) {
            dailyTargets[date] = Math.max(0, Math.min(1000, Math.round(target)));
          }
        }
      } else if (tasks.length) {
        dailyTargets[todayKey] = Math.max(DAILY_TARGET_DEFAULT, tasks.length);
      }
      const savedGoal = data.goal && typeof data.goal === "object" ? data.goal : {};
      const knownPeriod = periods.some(period => period.id === data.activePeriod);
      const goals = Array.isArray(data.goals) ? data.goals.filter(goal =>
        goal && typeof goal.id === "string" && typeof goal.name === "string" &&
        goalCategories.some(category => category.id === goal.category)
      ).map(goal => {
        const category = goalCategories.find(item => item.id === goal.category);
        const items = Array.isArray(goal.items) ? goal.items.filter(item => item && typeof item.name === "string").map(item => ({
          id: typeof item.id === "string" ? item.id : makeId("item"),
          name: item.name.slice(0, 100),
          done: item.done === true
        })) : [];
        return {
          id: goal.id,
          name: goal.name.slice(0, 60),
          category: category.id,
          type: category.type,
          description: typeof goal.description === "string" ? goal.description.slice(0, 240) : "",
          current: Number.isFinite(goal.current) ? Math.max(0, goal.current) : 0,
          target: Number.isFinite(goal.target) ? Math.max(1, goal.target) : (category.id === "money" ? 1000000 : 10),
          unit: typeof goal.unit === "string" ? goal.unit.slice(0, 16) : (category.id === "money" ? "元" : "项"),
          items
        };
      }) : initialGoals.map(goal => ({
        ...goal,
        type: goalCategories.find(category => category.id === goal.category).type,
        items: goal.items.map(item => ({ ...item, id: makeId("item") }))
      }));
      return {
        goal: {
          title: typeof savedGoal.title === "string" && savedGoal.title.trim() ? savedGoal.title.slice(0, 60) : "成为更好的自己",
          description: typeof savedGoal.description === "string" ? savedGoal.description.slice(0, 180) : ""
        },
        advisor: sanitizeAdvisor(data.advisor),
        goals,
        tasks,
        dailyTargets,
        activePeriod: data.activePeriod === "all" || knownPeriod ? data.activePeriod : "daily",
        selectedDate: parseDate(data.selectedDate) ? data.selectedDate : todayKey
      };
    } catch (error) {
      console.error("读取已保存的任务失败：", error);
      return emptyState();
    }
  }

  function makeId(prefix) {
    return window.crypto && typeof window.crypto.randomUUID === "function"
      ? `${prefix}-${window.crypto.randomUUID()}`
      : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  let state = loadState();
  try {
    if (!localStorage.getItem(STORAGE_KEY) && LEGACY_STORAGE_KEYS.some(key => localStorage.getItem(key))) saveState();
  } catch (error) {
    console.error("迁移旧版任务数据失败：", error);
  }

  function showToast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => $("toast").classList.remove("show"), 2300);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error("保存任务失败：", error);
      showToast("保存失败，请检查浏览器存储空间");
      return false;
    }
  }

  function tasksByDate() {
    const grouped = new Map();
    for (const task of state.tasks) {
      if (!grouped.has(task.date)) grouped.set(task.date, []);
      grouped.get(task.date).push(task);
    }
    return grouped;
  }

  function dateRange(periodId) {
    const selected = parseDate(state.selectedDate);
    const year = selected.getFullYear();
    const month = selected.getMonth();
    if (periodId === "daily") return [state.selectedDate, state.selectedDate];
    if (periodId === "weekly") {
      const mondayOffset = (selected.getDay() + 6) % 7;
      const start = shiftDate(state.selectedDate, -mondayOffset);
      return [start, shiftDate(start, 6)];
    }
    if (periodId === "monthly") {
      return [dateKey(new Date(year, month, 1, 12)), dateKey(new Date(year, month + 1, 0, 12))];
    }
    if (periodId === "yearly") return [`${year}-01-01`, `${year}-12-31`];
    const period = periods.find(item => item.id === periodId);
    if (period && period.years) return [`${year}-01-01`, `${year + period.years - 1}-12-31`];
    return [state.selectedDate, state.selectedDate];
  }

  function targetFor(date) {
    return Object.hasOwn(state.dailyTargets, date) ? state.dailyTargets[date] : DAILY_TARGET_DEFAULT;
  }

  function dateStats(date, groupedTasks) {
    const tasks = groupedTasks.get(date) || [];
    return {
      target: targetFor(date),
      completed: tasks.filter(task => task.done).length,
      pending: tasks.filter(task => !task.done).length
    };
  }

  function rangeStats(start, end, groupedTasks) {
    let completed = 0;
    let target = 0;
    let pending = 0;
    for (let date = start; date <= end; date = shiftDate(date, 1)) {
      const stats = dateStats(date, groupedTasks);
      completed += stats.completed;
      target += stats.target;
      pending += stats.pending;
    }
    const remaining = Math.max(0, target - completed);
    const percent = target ? Math.min(100, Math.round(completed / target * 100)) : 0;
    return { completed, target, pending, remaining, percent };
  }

  function trackedStats(groupedTasks) {
    const trackedDates = new Set([...groupedTasks.keys(), ...Object.keys(state.dailyTargets)]);
    let completed = 0;
    let target = 0;
    let pending = 0;
    for (const date of trackedDates) {
      const stats = dateStats(date, groupedTasks);
      completed += stats.completed;
      target += stats.target;
      pending += stats.pending;
    }
    return {
      completed,
      target,
      pending,
      remaining: Math.max(0, target - completed),
      percent: target ? Math.min(100, Math.round(completed / target * 100)) : 0
    };
  }

  function goalProgress(goal) {
    const completedItems = goal.items.filter(item => item.done).length;
    let progress = 0;
    let metric = "";
    if (goal.type === "amount") {
      progress = goal.target > 0 ? Math.min(100, goal.current / goal.target * 100) : 0;
      metric = `${formatNumber(goal.current)} / ${formatNumber(goal.target)} ${goal.unit}`;
    } else if (goal.type === "count") {
      progress = goal.target > 0 ? Math.min(100, completedItems / goal.target * 100) : 0;
      metric = `${completedItems} / ${formatNumber(goal.target)} ${goal.unit}`;
    } else {
      progress = goal.items.length ? completedItems / goal.items.length * 100 : 0;
      metric = `${completedItems} / ${goal.items.length} 项`;
    }
    return { completedItems, progress: Math.round(progress), metric };
  }

  function renderMentorReport(advisor) {
    if (!advisor || !Array.isArray(advisor.recommendations)) return "";
    const sourceById = new Map((Array.isArray(advisor.sources) ? advisor.sources : [])
      .filter(source => source && typeof source.id === "string" && typeof source.title === "string")
      .map(source => [source.id, { ...source, url: safeExternalUrl(source.url) }]));
    const recommendations = advisor.recommendations.map(recommendation => {
      const steps = Array.isArray(recommendation.steps) ? recommendation.steps : [];
      const evidence = Array.isArray(recommendation.evidence_ids)
        ? recommendation.evidence_ids.map(id => sourceById.get(id)).filter(source => source && source.url)
        : [];
      return `<article class="mentor-recommendation">
        <div class="mentor-recommendation-header"><span class="mentor-recommendation-title">${escapeHtml(recommendation.title || "行动建议")}</span>
          ${recommendation.confidence ? `<span class="mentor-confidence">依据：${escapeHtml(recommendation.confidence)}</span>` : ""}
        </div>
        ${recommendation.rationale ? `<p class="mentor-recommendation-reason">${escapeHtml(recommendation.rationale)}</p>` : ""}
        ${steps.length ? `<ol class="mentor-recommendation-steps">${steps.map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol>` : ""}
        ${recommendation.caveat ? `<p class="mentor-caveat">${escapeHtml(recommendation.caveat)}</p>` : ""}
        ${evidence.length ? `<ul class="mentor-sources">${evidence.map(source => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join("")}</ul>` : ""}
      </article>`;
    }).join("");
    const limitations = Array.isArray(advisor.limitations) ? advisor.limitations : [];
    const date = typeof advisor.generated_at === "string" ? `· 更新于 ${advisor.generated_at.slice(0, 16).replace("T", " ")}` : "";
    return `${advisor.summary ? `<p class="mentor-summary">${escapeHtml(advisor.summary)}</p>` : ""}
      ${recommendations}
      ${limitations.length ? `<p class="mentor-limitations">适用边界：${limitations.map(escapeHtml).join("；")}</p>` : ""}
      ${advisor.sources && advisor.sources.length ? `<div class="mentor-updated">建议引用 ${advisor.sources.length} 条经过检索的来源 ${escapeHtml(date)}</div>` : ""}`;
  }

  function setMentorStatus(message, isError = false) {
    const status = $("mentorStatus");
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function updateMentorButton() {
    $("generateAdviceButton").disabled = !$("mentorConsent").checked || !mentorServiceAvailable;
  }

  async function checkMentorService() {
    if (!["localhost", "127.0.0.1"].includes(location.hostname)) {
      mentorServiceAvailable = false;
      setMentorStatus("导师服务未连接；为保护你的资料，目标信息不会发送。任务和目标仍可正常使用。");
      updateMentorButton();
      return;
    }
    try {
      const response = await fetch(new URL("./api/health", location.href), {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) {
        throw new Error("导师后端不可用");
      }
      const health = await response.json();
      if (health.ok !== true) throw new Error("导师后端状态异常");
      mentorServiceAvailable = true;
      setMentorStatus(health.configured?.ai
        ? "本机导师服务已连接。勾选分享许可后，可生成附来源的行动建议。"
        : "本机导师服务已连接，但尚未配置 AI 模型；请先配置本机 .env。");
    } catch {
      mentorServiceAvailable = false;
      setMentorStatus("导师服务未连接；为保护你的资料，导师不会发送目标信息。任务和目标仍可正常使用。");
    }
    updateMentorButton();
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
  }

  function renderGoalCard(goal) {
    const category = goalCategories.find(item => item.id === goal.category);
    const progress = goalProgress(goal);
    const metricLabel = goal.type === "amount" ? "已累计 / 目标金额" : goal.type === "count" ? "已掌握 / 目标数量" : "已完成 / 子任务";
    const items = goal.items.length
      ? `<div class="goal-items">${goal.items.map(item => `<div class="goal-item${item.done ? " is-done" : ""}">
          <button class="goal-item-check" type="button" data-goal-toggle="${escapeHtml(goal.id)}" data-item-id="${escapeHtml(item.id)}" aria-label="${item.done ? "标记为未完成" : "标记为完成"}：${escapeHtml(item.name)}" aria-pressed="${item.done}">
            ${item.done ? '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 8.2 3 3 6-6.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ""}
          </button>
          <span class="goal-item-title">${escapeHtml(item.name)}</span>
          <button class="goal-item-edit" type="button" data-edit-item="${escapeHtml(goal.id)}" data-item-id="${escapeHtml(item.id)}" aria-label="编辑子任务：${escapeHtml(item.name)}">编辑</button>
          <button class="goal-item-delete" type="button" data-delete-item="${escapeHtml(goal.id)}" data-item-id="${escapeHtml(item.id)}" aria-label="删除子任务：${escapeHtml(item.name)}">×</button>
        </div>`).join("")}</div>`
      : `<div class="goal-items-empty">${goal.type === "count" ? "添加要掌握的技能或证书，逐项勾选后计入目标进度。" : "添加可检查的里程碑，完成后逐项勾选。"}</div>`;
    return `<article class="individual-goal" data-goal-card="${escapeHtml(goal.id)}">
      <div class="individual-goal-heading">
        <span class="goal-symbol" aria-hidden="true">${category.icon}</span>
        <div class="individual-goal-heading-main"><h3 class="individual-goal-title">${escapeHtml(goal.name)}</h3><div class="goal-category">${category.label} · ${metricLabel}</div></div>
        <div class="goal-card-actions">
          <button class="icon-button" type="button" data-edit-goal="${escapeHtml(goal.id)}" aria-label="编辑目标：${escapeHtml(goal.name)}" title="编辑目标">✎</button>
          <button class="icon-button delete" type="button" data-delete-goal="${escapeHtml(goal.id)}" aria-label="删除目标：${escapeHtml(goal.name)}" title="删除目标">×</button>
        </div>
      </div>
      ${goal.description ? `<p class="individual-goal-description">${escapeHtml(goal.description)}</p>` : ""}
      <div class="goal-metric-row"><div class="goal-metric-value" data-goal-metric="${escapeHtml(goal.id)}">${progress.metric}</div><span class="goal-percent" data-goal-percent="${escapeHtml(goal.id)}">${progress.progress}%</span></div>
      <div class="goal-progress-track"><span data-goal-bar="${escapeHtml(goal.id)}" style="width:${progress.progress}%"></span></div>
      ${goal.type === "amount" ? `<label class="goal-current-control">当前已存
        <input class="goal-current-input" type="number" min="0" max="1000000000000" step="any" value="${goal.current}" data-goal-current="${escapeHtml(goal.id)}" aria-label="${escapeHtml(goal.name)}目前已存金额"> ${escapeHtml(goal.unit)}
      </label>` : ""}
      ${items}
      <button class="goal-subtask-add" type="button" data-add-item="${escapeHtml(goal.id)}">＋ 添加${goal.type === "count" ? "技能 / 证书" : "子任务"}</button>
      ${goal.category === "diet" ? '<div class="goal-health-note">健康提醒：记录仅供自我观察；“水多木漂”等标签不能代替诊断，也不能单独据此确定饮食方案。持续或加重的不适，请咨询合格医疗专业人员。</div>' : ""}
    </article>`;
  }

  function displayDate(value, options = {}) {
    return new Intl.DateTimeFormat("zh-CN", options).format(parseDate(value));
  }

  function renderTask(task) {
    const done = task.done;
    return `<article class="task-card${done ? " is-done" : ""}">
      <button class="task-check" type="button" data-toggle="${escapeHtml(task.id)}" aria-label="${done ? "将任务标记为未完成" : "将任务标记为完成"}" aria-pressed="${done}">
        ${done ? '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 8.2 3 3 6-6.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ""}
      </button>
      <div class="task-content"><div class="task-title-row"><span class="task-title">${escapeHtml(task.name)}</span></div>
        ${task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : ""}
      </div>
      <button class="task-delete" type="button" data-delete="${escapeHtml(task.id)}" aria-label="删除任务：${escapeHtml(task.name)}" title="删除任务">×</button>
    </article>`;
  }

  function renderDay(date, groupedTasks, open = false) {
    const dateTasks = groupedTasks.get(date) || [];
    const stats = dateStats(date, groupedTasks);
    return `<details class="day-card" data-date="${date}"${open ? " open" : ""}>
      <summary><span class="day-summary-title">${displayDate(date, { weekday: "long" })}</span><span class="day-summary-date">${date === todayKey ? "今天 · " : ""}${displayDate(date, { year: "numeric", month: "long", day: "numeric" })}</span>
        <span class="day-summary-count"><strong>${stats.completed} / ${stats.target}</strong> 项已完成</span>
      </summary>
      <div class="day-content"><div class="day-tools">
        <label class="target-control">当天目标 <input class="target-input" type="number" min="0" max="1000" step="1" value="${stats.target}" data-target="${date}" aria-label="${date}每日目标数量"> 项</label>
        <button class="day-add-button" type="button" data-add-date="${date}">＋ 添加这一天的任务</button>
      </div>
      ${dateTasks.length ? `<div class="task-list nested">${dateTasks.map(renderTask).join("")}</div>` : '<div class="day-empty">这一天还没有任务清单，添加一件小事开始记录。</div>'}
      </div>
    </details>`;
  }

  function renderGroup(title, start, end, body, groupedTasks, open = false, level = "period") {
    const stats = rangeStats(start, end, groupedTasks);
    const range = start === end
      ? displayDate(start, { month: "short", day: "numeric" })
      : `${displayDate(start, { month: "short", day: "numeric" })} – ${displayDate(end, { month: "short", day: "numeric" })}`;
    return `<details class="period-group ${level}-group"${open ? " open" : ""}>
      <summary><span class="group-summary-main"><span class="group-title">${title}<span class="group-range">${range}</span></span><span class="group-progress">${stats.completed} / ${stats.target} 项 · ${stats.percent}%</span></span></summary>
      <div class="group-children">${body}</div>
    </details>`;
  }

  function weekRanges(start, end) {
    const ranges = [];
    for (let cursor = start; cursor <= end;) {
      const weekday = (parseDate(cursor).getDay() + 6) % 7;
      const daysToSunday = 6 - weekday;
      const daysRemaining = Math.round((parseDate(end) - parseDate(cursor)) / 86400000);
      const last = shiftDate(cursor, Math.min(daysToSunday, daysRemaining));
      ranges.push([cursor, last]);
      cursor = shiftDate(last, 1);
    }
    return ranges;
  }

  function renderDays(start, end, groupedTasks) {
    let html = "";
    for (let date = start; date <= end; date = shiftDate(date, 1)) {
      html += renderDay(date, groupedTasks, date === state.selectedDate);
    }
    return html;
  }

  function renderWeekGroups(start, end, groupedTasks) {
    return weekRanges(start, end).map(([weekStart, weekEnd], index) =>
      renderGroup(`第 ${index + 1} 周`, weekStart, weekEnd,
        renderDays(weekStart, weekEnd, groupedTasks), groupedTasks,
        weekStart <= state.selectedDate && state.selectedDate <= weekEnd, "week")
    ).join("");
  }

  function renderMonthGroups(year, start, end, groupedTasks) {
    let html = "";
    for (let month = 0; month < 12; month += 1) {
      const monthStart = dateKey(new Date(year, month, 1, 12));
      const monthEnd = dateKey(new Date(year, month + 1, 0, 12));
      if (monthStart < start || monthEnd > end) continue;
      const weeks = renderWeekGroups(monthStart, monthEnd, groupedTasks);
      html += renderGroup(`${month + 1} 月`, monthStart, monthEnd, weeks, groupedTasks,
        monthStart.slice(0, 7) === state.selectedDate.slice(0, 7), "month");
    }
    return html;
  }

  function renderPeriodTasks(periodId, start, end, groupedTasks) {
    if (periodId === "all") {
      const dates = [...new Set([...groupedTasks.keys(), ...Object.keys(state.dailyTargets)])].sort().reverse();
      return dates.length
        ? `<div class="period-groups">${dates.map(date => renderDay(date, groupedTasks, date === state.selectedDate)).join("")}</div>`
        : '<div class="empty-state"><strong>还没有已记录的日期</strong>先选择一天并添加任务，之后就可以按周、月和年份查看累计进度。</div>';
    }
    if (periodId === "daily") return `<div class="period-groups">${renderDay(state.selectedDate, groupedTasks, true)}</div>`;
    if (periodId === "weekly") return `<div class="period-groups">${renderDays(start, end, groupedTasks)}</div>`;
    if (periodId === "monthly") return `<div class="period-groups">${renderWeekGroups(start, end, groupedTasks)}</div>`;
    if (periodId === "yearly") return `<div class="period-groups">${renderMonthGroups(parseDate(start).getFullYear(), start, end, groupedTasks)}</div>`;
    let groups = "";
    const firstYear = parseDate(start).getFullYear();
    const lastYear = parseDate(end).getFullYear();
    for (let year = firstYear; year <= lastYear; year += 1) {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      groups += renderGroup(`${year} 年`, yearStart, yearEnd,
        renderMonthGroups(year, yearStart, yearEnd, groupedTasks), groupedTasks,
        year === parseDate(state.selectedDate).getFullYear(), "year");
    }
    return `<div class="period-groups">${groups}</div>`;
  }

  function render() {
    const groupedTasks = tasksByDate();
    const overall = trackedStats(groupedTasks);
    const goalsCompleted = state.goals.filter(goal => goalProgress(goal).progress === 100).length;
    const averageGoalProgress = state.goals.length
      ? Math.round(state.goals.reduce((sum, goal) => sum + goalProgress(goal).progress, 0) / state.goals.length)
      : 0;
    const active = periods.find(period => period.id === state.activePeriod);
    const [start, end] = dateRange(state.activePeriod);
    const currentRange = state.activePeriod === "all" ? overall : rangeStats(start, end, groupedTasks);
    $("datePicker").value = state.selectedDate;
    $("goalTitle").textContent = state.goal.title;
    $("goalDescription").textContent = state.goal.description || "把心里的愿望，变成每天一点点的行动。";
    $("completedCount").textContent = state.goals.length;
    $("totalCount").textContent = `${averageGoalProgress}%`;
    $("totalPercent").textContent = averageGoalProgress;
    $("progressRing").style.setProperty("--progress", `${averageGoalProgress}%`);
    $("progressRing").setAttribute("aria-label", `全部目标等权平均进度 ${averageGoalProgress}%`);
    $("welcomeDone").textContent = goalsCompleted;
    $("mentorReport").innerHTML = renderMentorReport(state.advisor);
    $("goalGrid").innerHTML = state.goals.length
      ? state.goals.map(renderGoalCard).join("")
      : '<div class="empty-state"><strong>还没有添加目标</strong>先新建一个清晰、可衡量的目标，再逐步添加要完成的子任务。</div>';
    $("statCompleted").textContent = currentRange.completed;
    $("statInProgress").textContent = currentRange.pending;
    $("statRemaining").textContent = currentRange.remaining;
    $("completedBar").style.width = `${currentRange.percent}%`;
    $("inProgressBar").style.width = `${currentRange.target ? Math.min(100, currentRange.pending / currentRange.target * 100) : 0}%`;
    $("remainingBar").style.width = `${currentRange.target ? currentRange.remaining / currentRange.target * 100 : 0}%`;
    const periodName = state.activePeriod === "all" ? "全部任务" : active.label;
    $("sectionTitle").textContent = periodName;
    const dateDescription = `${displayDate(start, { year: "numeric", month: "long", day: "numeric" })} 至 ${displayDate(end, { year: "numeric", month: "long", day: "numeric" })}`;
    $("sectionSubtitle").textContent = state.activePeriod === "all"
      ? `任务按照实际日期记录，所有周期都从这些每日清单逐层累计。当前已完成 ${overall.completed} / ${overall.target} 项目标。`
      : `${active.subtitle} ${dateDescription}：完成 ${currentRange.completed} / ${currentRange.target} 项目标（${currentRange.percent}%）。`;
    $("viewAllButton").innerHTML = state.activePeriod === "all"
      ? '返回当前周期 <span aria-hidden="true">←</span>'
      : '查看全部日期 <span aria-hidden="true">→</span>';
    $("periodNav").innerHTML = periods.map(period => {
      const [periodStart, periodEnd] = dateRange(period.id);
      const stats = rangeStats(periodStart, periodEnd, groupedTasks);
      return `<button class="nav-item${period.id === state.activePeriod ? " active" : ""}" type="button" data-period="${period.id}" aria-current="${period.id === state.activePeriod ? "page" : "false"}">
        <span class="nav-icon" aria-hidden="true">${period.icon}</span><span class="nav-title">${period.label}</span><span class="nav-count">${stats.percent}%</span>
      </button>`;
    }).join("");
    $("taskList").innerHTML = renderPeriodTasks(state.activePeriod, start, end, groupedTasks);
  }

  function openModal(id) {
    const modal = $(id);
    modal.hidden = false;
    const input = modal.querySelector("input, textarea");
    if (input) input.focus();
  }

  function closeModal(id) {
    $(id).hidden = true;
  }

  $("goalCategory").innerHTML = goalCategories.map(category =>
    `<option value="${category.id}">${category.label}</option>`
  ).join("");

  function updateGoalFields(categoryId, setDefaults = false) {
    const category = goalCategories.find(item => item.id === categoryId) || goalCategories[goalCategories.length - 1];
    const amountGoal = category.type === "amount";
    const countGoal = category.type === "count";
    $("goalTargetField").hidden = category.type === "checklist";
    $("goalUnitField").hidden = category.type === "checklist";
    $("goalCurrentField").hidden = !amountGoal;
    $("goalTarget").required = category.type !== "checklist";
    $("goalTargetLabel").textContent = amountGoal ? "目标金额" : "目标掌握数量";
    $("goalUnit").placeholder = amountGoal ? "例如：元" : "例如：项";
    if (setDefaults) {
      $("goalTarget").value = amountGoal ? 1000000 : countGoal ? 10 : "";
      $("goalUnit").value = amountGoal ? "元" : "项";
      $("goalCurrent").value = 0;
    }
  }

  function openGoalModal(goal = null) {
    const form = $("goalForm");
    form.reset();
    $("goalForm").elements.id.value = goal ? goal.id : "";
    $("goalName").value = goal ? goal.name : "";
    $("goalCategory").value = goal ? goal.category : "custom";
    $("goalNote").value = goal ? goal.description : "";
    updateGoalFields($("goalCategory").value, !goal);
    if (goal) {
      $("goalTarget").value = goal.target;
      $("goalUnit").value = goal.unit;
      $("goalCurrent").value = goal.current;
    }
    $("goalModalTitle").textContent = goal ? "编辑目标" : "新建目标";
    $("goalModal").querySelector(".modal-header p").textContent = goal
      ? "让目标名称、完成标准和衡量方式始终清晰。"
      : "选择衡量方式，再把目标拆分成可执行的子任务。";
    $("goalForm").querySelector('[type="submit"]').textContent = goal ? "保存修改" : "保存目标";
    openModal("goalModal");
  }

  function openGoalItemModal(goalId, item = null) {
    const form = $("goalItemForm");
    form.reset();
    form.elements.goalId.value = goalId;
    form.elements.itemId.value = item ? item.id : "";
    $("goalItemName").value = item ? item.name : "";
    $("goalItemModalTitle").textContent = item ? "编辑子任务" : "添加一个子任务";
    $("goalItemModal").querySelector(".modal-header p").textContent = item
      ? "保留已完成状态，更新子任务名称。"
      : "把目标拆成可以逐项完成的小步骤。";
    $("goalItemForm").querySelector('[type="submit"]').textContent = item ? "保存修改" : "保存子任务";
    openModal("goalItemModal");
  }

  $("periodNav").addEventListener("click", event => {
    const button = event.target.closest("[data-period]");
    if (!button) return;
    state.activePeriod = button.dataset.period;
    saveState();
    render();
  });
  $("mentorConsent").addEventListener("change", event => {
    updateMentorButton();
    if (!event.target.checked) {
      setMentorStatus("已取消分享许可；导师不会发送或分析你的目标资料。");
    } else if (mentorServiceAvailable) {
      setMentorStatus("已选择分享目标摘要。点击“生成行动建议”后，信息将发送至你配置的本机导师后端。");
    } else {
      setMentorStatus("导师服务未连接；为保护你的资料，目标信息不会发送。任务和目标仍可正常使用。");
    }
  });
  $("generateAdviceButton").addEventListener("click", async () => {
    if (!$("mentorConsent").checked || $("generateAdviceButton").disabled) return;
    const button = $("generateAdviceButton");
    button.disabled = true;
    button.textContent = "正在检索与分析…";
    $("mentorReport").replaceChildren();
    setMentorStatus("正在检索近期趋势与研究资料，并结合你的目标生成可执行建议。");
    try {
      const payload = {
        today: todayKey,
        selected_date: state.selectedDate,
        vision: { title: state.goal.title, description: state.goal.description },
        goals: state.goals.map(goal => ({
          id: goal.id,
          title: goal.name,
          category: goalCategories.find(category => category.id === goal.category)?.label || "自定义目标",
          description: goal.description,
          current: goal.current,
          target: goal.target,
          unit: goal.unit,
          progress_percent: goalProgress(goal).progress,
          items: goal.items.map(item => ({ title: item.name, done: item.done }))
        })),
        recent_daily_tasks: state.tasks
          .filter(task => task.date <= state.selectedDate)
          .sort((left, right) => right.date.localeCompare(left.date))
          .slice(0, 80)
          .map(task => ({ date: task.date, title: task.name, done: task.done }))
      };
      const response = await fetch(new URL("./api/advisor", location.href), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `导师服务请求失败（${response.status}）`);
      const advisor = sanitizeAdvisor(result);
      if (!advisor || !advisor.recommendations.length) throw new Error("导师返回内容不完整，请检查服务端日志或稍后重试。");
      state.advisor = advisor;
      state.advisorRetrievedAt = new Date().toISOString();
      saveState();
      $("mentorReport").innerHTML = renderMentorReport(advisor);
      setMentorStatus("建议已生成。请结合自身情况判断、逐步试行；导师没有替你自动修改目标或任务。");
    } catch (error) {
      console.error("生成导师建议失败：", error);
      const message = location.protocol === "file:"
        ? "请先按配置说明启动本机导师后端，再通过 http://127.0.0.1:8765 打开应用。"
        : error instanceof TypeError
          ? "无法连接导师服务。请确认本机后端已启动、AI 与检索 API 已配置。"
          : error.name === "TimeoutError"
            ? "检索或分析耗时过长，请检查服务配置后重试。"
            : error.message;
      setMentorStatus(message, true);
    } finally {
      button.disabled = !$("mentorConsent").checked;
      button.textContent = "生成行动建议";
    }
  });
  $("datePicker").addEventListener("change", event => {
    if (!parseDate(event.target.value)) return;
    state.selectedDate = event.target.value;
    saveState();
    render();
  });
  $("previousDate").addEventListener("click", () => {
    state.selectedDate = shiftDate(state.selectedDate, -1);
    saveState();
    render();
  });
  $("nextDate").addEventListener("click", () => {
    state.selectedDate = shiftDate(state.selectedDate, 1);
    saveState();
    render();
  });
  $("todayButton").addEventListener("click", () => {
    state.selectedDate = todayKey;
    saveState();
    render();
  });
  $("taskList").addEventListener("click", event => {
    const addForDate = event.target.closest("[data-add-date]");
    if (addForDate) {
      $("taskForm").reset();
      $("taskDate").value = addForDate.dataset.addDate;
      openModal("taskModal");
      return;
    }
    const toggle = event.target.closest("[data-toggle]");
    if (toggle) {
      const task = state.tasks.find(item => item.id === toggle.dataset.toggle);
      if (!task) return;
      task.done = !task.done;
      saveState();
      render();
      showToast(task.done ? "完成得真棒，继续保持 ✨" : "已将任务重新设为待完成");
      return;
    }
    const remove = event.target.closest("[data-delete]");
    if (!remove) return;
    const task = state.tasks.find(item => item.id === remove.dataset.delete);
    if (!task || !window.confirm(`确定删除「${task.name}」吗？`)) return;
    state.tasks = state.tasks.filter(item => item.id !== task.id);
    saveState();
    render();
    showToast("任务已删除");
  });
  $("taskList").addEventListener("change", event => {
    const targetInput = event.target.closest("[data-target]");
    if (!targetInput) return;
    const value = Number(targetInput.value);
    if (!Number.isFinite(value) || value < 0 || value > 1000) {
      showToast("每日目标请设置为 0 到 1000 之间的整数");
      render();
      return;
    }
    state.dailyTargets[targetInput.dataset.target] = Math.round(value);
    saveState();
    window.setTimeout(render, 0);
  });
  $("addTaskButton").addEventListener("click", () => {
    $("taskForm").reset();
    $("taskDate").value = state.selectedDate;
    openModal("taskModal");
  });
  $("taskForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const date = String(form.get("date") || "");
    if (!name || !parseDate(date)) return;
    state.tasks.push({
      id: makeId("task"),
      name: name.slice(0, 80),
      date,
      note: String(form.get("note") || "").trim().slice(0, 180),
      done: false
    });
    state.selectedDate = date;
    saveState();
    render();
    closeModal("taskModal");
    showToast("任务已添加到对应日期");
  });
  $("addGoalButton").addEventListener("click", () => openGoalModal());
  $("goalCategory").addEventListener("change", () => updateGoalFields($("goalCategory").value, true));
  $("goalForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const categoryId = String(form.get("category") || "");
    const category = goalCategories.find(item => item.id === categoryId);
    const targetValue = Number(form.get("target"));
    const currentValue = Number(form.get("current"));
    if (!name || !category) return;
    if (category.type !== "checklist" && (!Number.isFinite(targetValue) || targetValue < 1)) {
      showToast("请输入大于 0 的目标值");
      return;
    }
    if (category.type === "amount" && (!Number.isFinite(currentValue) || currentValue < 0)) {
      showToast("请输入有效的当前金额");
      return;
    }
    const id = String(form.get("id") || "");
    const previous = state.goals.find(goal => goal.id === id);
    const goal = {
      id: previous ? previous.id : makeId("goal"),
      name: name.slice(0, 60),
      category: category.id,
      type: category.type,
      description: String(form.get("description") || "").trim().slice(0, 240),
      current: category.type === "amount" ? currentValue : 0,
      target: category.type === "checklist" ? 0 : targetValue,
      unit: category.type === "checklist" ? "项" : String(form.get("unit") || (category.type === "amount" ? "元" : "项")).trim().slice(0, 16),
      items: previous ? previous.items : []
    };
    if (previous) state.goals = state.goals.map(item => item.id === previous.id ? goal : item);
    else state.goals.push(goal);
    saveState();
    render();
    closeModal("goalModal");
    showToast(previous ? "目标已更新" : "新目标已创建");
  });
  $("goalGrid").addEventListener("click", event => {
    const addItem = event.target.closest("[data-add-item]");
    if (addItem) {
      openGoalItemModal(addItem.dataset.addItem);
      return;
    }
    const toggle = event.target.closest("[data-goal-toggle]");
    if (toggle) {
      const goal = state.goals.find(item => item.id === toggle.dataset.goalToggle);
      const item = goal && goal.items.find(value => value.id === toggle.dataset.itemId);
      if (!item) return;
      item.done = !item.done;
      saveState();
      render();
      showToast(item.done ? "子任务已完成" : "已将子任务设为未完成");
      return;
    }
    const editItemButton = event.target.closest("[data-edit-item]");
    if (editItemButton) {
      const goal = state.goals.find(item => item.id === editItemButton.dataset.editItem);
      const item = goal && goal.items.find(value => value.id === editItemButton.dataset.itemId);
      if (goal && item) openGoalItemModal(goal.id, item);
      return;
    }
    const deleteItemButton = event.target.closest("[data-delete-item]");
    if (deleteItemButton) {
      const goal = state.goals.find(item => item.id === deleteItemButton.dataset.deleteItem);
      const subtask = goal && goal.items.find(item => item.id === deleteItemButton.dataset.itemId);
      if (!goal || !subtask || !window.confirm(`确定删除子任务「${subtask.name}」吗？`)) return;
      goal.items = goal.items.filter(item => item.id !== deleteItemButton.dataset.itemId);
      saveState();
      render();
      showToast("子任务已删除");
      return;
    }
    const editGoalButton = event.target.closest("[data-edit-goal]");
    if (editGoalButton) {
      const goal = state.goals.find(item => item.id === editGoalButton.dataset.editGoal);
      if (goal) openGoalModal(goal);
      return;
    }
    const deleteGoalButton = event.target.closest("[data-delete-goal]");
    if (!deleteGoalButton) return;
    const goal = state.goals.find(item => item.id === deleteGoalButton.dataset.deleteGoal);
    if (!goal || !window.confirm(`确定删除目标「${goal.name}」及其子任务吗？`)) return;
    state.goals = state.goals.filter(item => item.id !== goal.id);
    saveState();
    render();
    showToast("目标已删除");
  });
  $("goalGrid").addEventListener("change", event => {
    const input = event.target.closest("[data-goal-current]");
    if (!input) return;
    const current = Number(input.value);
    if (!Number.isFinite(current) || current < 0) {
      showToast("请输入 0 或更大的有效金额");
      render();
      return;
    }
    const goal = state.goals.find(item => item.id === input.dataset.goalCurrent);
    if (!goal) return;
    goal.current = current;
    saveState();
    window.setTimeout(render, 0);
  });
  $("goalItemForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const goalId = String(form.get("goalId") || "");
    const goal = state.goals.find(item => item.id === goalId);
    if (!name || !goal) return;
    const itemId = String(form.get("itemId") || "");
    const previous = goal.items.find(item => item.id === itemId);
    if (previous) previous.name = name.slice(0, 100);
    else goal.items.push({ id: makeId("item"), name: name.slice(0, 100), done: false });
    saveState();
    render();
    closeModal("goalItemModal");
    showToast(previous ? "子任务已更新" : "子任务已添加");
  });
  $("editVisionButton").addEventListener("click", () => {
    $("visionName").value = state.goal.title;
    $("visionDescription").value = state.goal.description;
    openModal("visionModal");
  });
  $("visionForm").addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("name") || "").trim();
    if (!title) return;
    state.goal = {
      title: title.slice(0, 60),
      description: String(form.get("description") || "").trim().slice(0, 180)
    };
    saveState();
    render();
    closeModal("visionModal");
    showToast("最终愿景已更新");
  });
  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });
  document.querySelectorAll(".modal-backdrop").forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal(modal.id);
    });
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") document.querySelectorAll(".modal-backdrop:not([hidden])").forEach(modal => closeModal(modal.id));
  });
  $("viewAllButton").addEventListener("click", () => {
    state.activePeriod = state.activePeriod === "all" ? "daily" : "all";
    saveState();
    render();
    $("tasksSection").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  render();
  checkMentorService();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.warn("离线缓存注册失败：", error);
    });
  }
})();
