/* egytronic operations console.
   Plain JS, one delegated click handler, no build step. Every string that comes
   from the database is escaped before it reaches innerHTML. */
(() => {
  "use strict";

  const API = "/api";
  const KEY = "egx.console.token";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  const STAGES = [
    ["new", "جديد"],
    ["contacted", "تم التواصل"],
    ["qualified", "مؤهّل"],
    ["proposal", "عرض سعر"],
    ["won", "تم التعاقد"],
    ["lost", "مفقود"],
  ];
  const STAGE_LABEL = Object.fromEntries(STAGES);
  const OPEN_STAGES = ["new", "contacted", "qualified", "proposal"];
  const CLIENT_STATUS = { lead: "محتمل", active: "نشط", paused: "متوقف", done: "منتهٍ" };
  const ROLES = { owner: "مالك", manager: "مدير", member: "عضو", contractor: "متعاقد" };
  const TASK_LABEL = { todo: "قيد الانتظار", doing: "قيد التنفيذ", done: "مكتملة" };
  const PRIORITY_LABEL = { 1: "عالية", 2: "متوسطة", 3: "منخفضة" };
  const SOURCE_LABEL = { manual: "إدخال يدوي", console: "لوحة التحكم", website: "الموقع", contact: "نموذج التواصل", agent: "وكيل" };

  const state = {
    token: sessionStorage.getItem(KEY) || "",
    me: null,
    view: "overview",
    loading: false,
    data: { metrics: null, leads: [], clients: [], tasks: [], members: [], channels: [], agents: [], activities: [], projects: [] },
    drawer: null,
    filters: { tasks: "open", pipeline: "" },
    activeChannel: null,
    pomodoro: null,
    timer: null,
  };

  // ── http ───────────────────────────────────────────────────────────

  async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(API + path, {
      method,
      headers: {
        authorization: `Bearer ${state.token}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      lock("انتهت الجلسة. أدخل كود الدخول مرة أخرى.");
      throw new Error("unauthorized");
    }
    const data = await res.json().catch(() => ({ ok: res.ok }));
    if (!res.ok || data.ok === false) throw new Error(data.code || `http-${res.status}`);
    return data;
  }

  // ── format ─────────────────────────────────────────────────────────

  const num = (n) => Number(n || 0).toLocaleString("en-US");
  const egp = (n) => `${num(n)} <small>ج.م</small>`;

  const asDate = (value) => {
    if (!value) return null;
    const iso = String(value).includes("T") ? value : String(value).replace(" ", "T") + "Z";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const dateLabel = (value) => {
    const d = asDate(value);
    if (!d) return "";
    return d.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short" });
  };

  const ago = (value) => {
    const d = asDate(value);
    if (!d) return "";
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `قبل ${mins} دقيقة`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `قبل ${hours} ساعة`;
    const days = Math.round(hours / 24);
    if (days < 30) return `قبل ${days} يوم`;
    return dateLabel(value);
  };

  const daysBetween = (value) => {
    const d = asDate(value);
    return d ? Math.floor((Date.now() - d.getTime()) / 86400000) : 0;
  };

  const todayKey = () => new Date().toISOString().slice(0, 10);
  const isLate = (task) => Boolean(task.due_at) && String(task.due_at).slice(0, 10) < todayKey() && task.status !== "done";
  const isToday = (task) => Boolean(task.due_at) && String(task.due_at).slice(0, 10) === todayKey() && task.status !== "done";

  const initials = (name) => String(name || "?").trim().charAt(0).toUpperCase();
  const memberNames = () => state.data.members.filter((m) => m.active).map((m) => m.name);
  const memberOptions = (selected) =>
    ['<option value="">غير مُسنَد</option>']
      .concat(memberNames().map((n) => `<option value="${esc(n)}"${n === selected ? " selected" : ""}>${esc(n)}</option>`))
      .join("");

  // ── chrome ─────────────────────────────────────────────────────────

  const TITLES = {
    overview: "نظرة عامة",
    pipeline: "خط المبيعات",
    clients: "العملاء",
    tasks: "المهام",
    team: "الفريق",
    channels: "القنوات",
    agents: "الوكلاء",
  };

  let toastTimer = null;
  function toast(message, tone = "") {
    const node = $("[data-toast]");
    node.textContent = message;
    node.dataset.tone = tone;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (node.hidden = true), 2800);
  }

  function setSync(text) {
    $("[data-sync]").textContent = text;
  }

  function lock(message = "") {
    state.token = "";
    sessionStorage.removeItem(KEY);
    $("[data-shell]").hidden = true;
    $("[data-gate]").hidden = false;
    const status = $("[data-gate-status]");
    status.textContent = message;
    status.dataset.state = message ? "error" : "";
    $("[data-gate-form] input[name=token]").focus();
  }

  function setView(view, push = true) {
    if (!TITLES[view]) view = "overview";
    state.view = view;
    $$("[data-panel]").forEach((panel) => (panel.hidden = panel.dataset.panel !== view));
    $$("[data-nav] .ops__nav-btn").forEach((btn) => {
      const on = btn.dataset.view === view;
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    $("[data-title]").textContent = TITLES[view];
    document.title = `${TITLES[view]} | Egytronic`;
    if (push && location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
    render();
    window.scrollTo({ top: 0 });
  }

  function closeDrawer() {
    state.drawer = null;
    $("[data-drawer]").hidden = true;
  }

  // ── data ───────────────────────────────────────────────────────────

  async function loadAll() {
    state.loading = true;
    setSync("جارٍ التحديث…");
    try {
      const [metrics, leads, clients, tasks, members, channels, agents, activities, projects] = await Promise.all([
        api("/metrics"),
        api("/inquiries?limit=300"),
        api("/clients"),
        api("/tasks"),
        api("/members"),
        api("/channels"),
        api("/agents"),
        api("/activities?limit=40"),
        api("/projects"),
      ]);
      Object.assign(state.data, {
        metrics,
        leads: leads.rows,
        clients: clients.rows,
        tasks: tasks.rows,
        members: members.rows,
        channels: channels.rows,
        agents: agents.rows,
        activities: activities.rows,
        projects: projects.rows || [],
      });
      setSync("متصل");
      const clock = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const sub = $("[data-sub]");
      if (sub) sub.textContent = `آخر تحديث ${clock}`;
      render();
    } catch (err) {
      if (String(err.message) !== "unauthorized") {
        setSync("تعذّر الاتصال");
        toast("تعذّر تحميل البيانات", "bad");
      }
    } finally {
      state.loading = false;
    }
  }

  const openLeads = () => state.data.leads.filter((l) => OPEN_STAGES.includes(l.status));
  const pipelineValue = () => openLeads().reduce((sum, l) => sum + Number(l.value || 0), 0);
  const openTasks = () => state.data.tasks.filter((t) => t.status !== "done");

  // ── overview ───────────────────────────────────────────────────────

  function kpi(label, value, foot, tone = "") {
    return `
      <article class="ops-kpi"${tone ? ` data-tone="${tone}"` : ""}>
        <span class="ops-kpi__label">${esc(label)}</span>
        <span class="ops-kpi__value">${value}</span>
        <span class="ops-kpi__foot">${foot}</span>
      </article>`;
  }

  function renderOverview() {
    const m = state.data.metrics || {};
    const leads = openLeads();
    const tasks = openTasks();
    const late = tasks.filter(isLate).length;
    const today = tasks.filter(isToday).length;
    const focusToday = m.focus?.today ?? 0;
    const focusWeek = m.focus?.week ?? 0;

    const funnel = STAGES.map(([key, label]) => {
      const rows = state.data.leads.filter((l) => l.status === key);
      const value = rows.reduce((sum, l) => sum + Number(l.value || 0), 0);
      return { key, label, count: rows.length, value };
    });
    const max = Math.max(1, ...funnel.map((f) => f.count));

    const agenda = tasks
      .filter((t) => isLate(t) || isToday(t) || !t.due_at)
      .slice(0, 6);

    const recent = state.data.activities.slice(0, 8);
    const entityLabel = { inquiry: "طلب", client: "عميل", project: "مشروع", task: "مهمة", member: "عضو", channel: "قناة" };

    return `
      <div class="ops-kpis">
        ${kpi("طلبات قيد المتابعة", num(leads.length), `${num(m.leads_7d ?? 0)} طلب خلال آخر 7 أيام`, "gold")}
        ${kpi("قيمة خط المبيعات", egp(pipelineValue()), `${num(leads.length)} طلب في مرحلة النقاش`)}
        ${kpi("مهام مفتوحة", num(tasks.length), `${num(late)} متأخرة · ${num(today)} مستحقة اليوم`, late ? "danger" : "")}
        ${kpi("تركيز اليوم", `${num(focusToday)}<small>د</small>`, `${num(Math.round(focusWeek / 60))} ساعة خلال آخر 7 أيام`, "mint")}
      </div>

      <div class="ops-split">
        <section class="ops-panel" aria-labelledby="funnel-title">
          <div class="ops-panel__head">
            <h2 id="funnel-title">خط المبيعات</h2>
            <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-view="pipeline">عرض الخط</button>
          </div>
          <div class="ops-panel__body">
            <div class="ops-funnel">
              ${funnel
                .map(
                  (row) => `
                <button class="ops-funnel__row" type="button" data-view="pipeline" data-stage="${row.key}">
                  <span class="ops-funnel__name">${esc(row.label)}</span>
                  <span class="ops-funnel__bar"><i style="width:${Math.round((row.count / max) * 100)}%"></i></span>
                  <span class="ops-funnel__sum">${num(row.count)} طلب${row.value ? " · " + num(row.value) + " ج.م" : ""}</span>
                </button>`
                )
                .join("")}
            </div>
          </div>
        </section>

        <section class="ops-panel" aria-labelledby="agenda-title">
          <div class="ops-panel__head">
            <h2 id="agenda-title">بحاجة إلى إجراء</h2>
            <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-view="tasks">جميع المهام</button>
          </div>
          <div class="ops-panel__body ops-panel__body--flush">
            ${
              agenda.length
                ? `<ul class="ops-list">${agenda
                    .map(
                      (t) => `
                  <li class="ops-list__row" data-action="open-task" data-id="${t.id}">
                    <span class="ops-avatar">${esc(initials(t.assignee || "—"))}</span>
                    <span class="ops-list__main">
                      <span class="ops-list__title">${esc(t.title)}</span>
                      <span class="ops-list__meta">${isLate(t) ? "متأخرة" : isToday(t) ? "اليوم" : "بدون موعد"} · ${esc(t.assignee || "غير مُسنَد")}</span>
                    </span>
                    ${isLate(t) ? '<span class="ops-chip ops-chip--danger">متأخرة</span>' : ""}
                  </li>`
                    )
                    .join("")}</ul>`
                : `<p class="ops-empty">لا توجد مهام متأخرة أو مستحقة اليوم.</p>`
            }
          </div>
        </section>
      </div>

      <section class="ops-panel" aria-labelledby="recent-title">
        <div class="ops-panel__head"><h2 id="recent-title">سجل النشاط</h2></div>
        <div class="ops-panel__body ops-panel__body--flush">
          ${
            recent.length
              ? `<ul class="ops-timeline" style="padding:16px">${recent
                  .map(
                    (a) => `
                <li data-kind="${esc(a.kind)}">
                  <time>${esc(ago(a.created_at))} · ${esc(entityLabel[a.entity] || a.entity)} #${a.entity_id}</time>
                  <p>${esc(a.body)}</p>
                </li>`
                  )
                  .join("")}</ul>`
              : `<p class="ops-empty">لا يوجد نشاط مسجّل بعد.</p>`
          }
        </div>
      </section>`;
  }

  // ── pipeline ───────────────────────────────────────────────────────

  function leadCard(lead) {
    const stale = OPEN_STAGES.includes(lead.status) && daysBetween(lead.created_at) > 7;
    return `
      <article class="ops-lead" draggable="true" tabindex="0" role="button"
               data-action="open-lead" data-id="${lead.id}" data-status="${esc(lead.status)}"
               ${stale ? 'data-stale="true"' : ""} aria-label="فتح ${esc(lead.name)}">
        <span class="ops-lead__name">${esc(lead.name)}</span>
        <span class="ops-lead__meta">
          ${lead.package ? `<span class="ops-chip">${esc(lead.package)}</span>` : ""}
          ${lead.assignee || lead.assigned_to ? `<span class="ops-chip">${esc(lead.assignee || lead.assigned_to)}</span>` : ""}
          <span>${esc(ago(lead.created_at))}</span>
        </span>
        ${lead.value ? `<span class="ops-lead__value">${egp(lead.value)}</span>` : ""}
      </article>`;
  }

  function renderPipeline() {
    const q = state.filters.pipeline.trim().toLowerCase();
    const leads = state.data.leads.filter((l) => (q ? `${l.name} ${l.email} ${l.message}`.toLowerCase().includes(q) : true));

    return `
      <div class="ops-panel">
        <div class="ops-panel__head">
          <h2>توزيع الطلبات على المراحل</h2>
          <button class="ops-btn ops-btn--sm" type="button" data-action="new-lead">طلب جديد</button>
        </div>
        <div class="ops-panel__body">
          <label class="ops-field" style="max-width:340px">
            <span>بحث بالاسم أو البريد الإلكتروني أو نص الطلب</span>
            <input class="ops-input" type="search" data-action="filter-pipeline" value="${esc(state.filters.pipeline)}" placeholder="اكتب للبحث…">
          </label>
        </div>
      </div>

      <div class="ops-board">
        ${STAGES.map(([key, label]) => {
          const rows = leads.filter((l) => l.status === key);
          const value = rows.reduce((sum, l) => sum + Number(l.value || 0), 0);
          return `
            <section class="ops-col" data-stage="${key}" data-drop="${key}" aria-label="${esc(label)}">
              <header class="ops-col__head">
                <span class="ops-col__dot" aria-hidden="true"></span>
                <span class="ops-col__name">${esc(label)}</span>
                <span class="ops-col__count">${rows.length}</span>
              </header>
              <p class="ops-col__sum">${value ? num(value) + " ج.م" : "—"}</p>
              <div class="ops-col__list">${rows.map(leadCard).join("")}</div>
            </section>`;
        }).join("")}
      </div>`;
  }

  // ── clients ────────────────────────────────────────────────────────

  function renderClients() {
    const rows = state.data.clients;
    const openValue = rows.filter((c) => c.status !== "done").reduce((s, c) => s + Number(c.value || 0), 0);

    return `
      <div class="ops-kpis">
        ${kpi("عملاء", num(rows.length), `${num(rows.filter((c) => c.status === "active").length)} نشطون حاليًا`)}
        ${kpi("قيمة العقود المفتوحة", egp(openValue), "لا تشمل العملاء المنتهين", "gold")}
        ${kpi("مشاريع", num(state.data.projects.length), "إجمالي المشاريع المسجّلة")}
        ${kpi("عملاء متوقفون", num(rows.filter((c) => c.status === "paused").length), "بحاجة إلى متابعة", "danger")}
      </div>

      <section class="ops-panel">
        <div class="ops-panel__head">
          <h2>سجل العملاء</h2>
          <button class="ops-btn ops-btn--sm" type="button" data-action="new-client">عميل جديد</button>
        </div>
        <div class="ops-panel__body ops-panel__body--flush">
          ${
            rows.length
              ? `<ul class="ops-list">${rows
                  .map((c) => {
                    const projects = state.data.projects.filter((p) => p.client_id === c.id);
                    return `
                    <li class="ops-list__row" data-action="open-client" data-id="${c.id}">
                      <span class="ops-avatar">${esc(initials(c.name))}</span>
                      <span class="ops-list__main">
                        <span class="ops-list__title">${esc(c.name)}${c.company ? ` · ${esc(c.company)}` : ""}</span>
                        <span class="ops-list__meta">${esc(c.email || c.phone || "لا توجد بيانات تواصل")} · ${projects.length} مشروع</span>
                      </span>
                      <span class="ops-chip${c.status === "active" ? " ops-chip--mint" : ""}">${esc(CLIENT_STATUS[c.status] || c.status)}</span>
                      ${c.value ? `<span class="ops-lead__value">${egp(c.value)}</span>` : ""}
                    </li>`;
                  })
                  .join("")}</ul>`
              : `<p class="ops-empty">لا يوجد عملاء بعد. حوّل طلبًا مقبولًا إلى عميل من خط المبيعات.</p>`
          }
        </div>
      </section>`;
  }

  // ── tasks ──────────────────────────────────────────────────────────

  function taskRow(task) {
    const late = isLate(task);
    const client = state.data.clients.find((c) => c.id === task.client_id);
    return `
      <li class="ops-task" data-done="${task.status === "done"}">
        <button class="ops-task__check" type="button" role="checkbox"
                aria-checked="${task.status === "done"}" aria-label="إكمال ${esc(task.title)}"
                data-action="toggle-task" data-id="${task.id}">${task.status === "done" ? "✓" : ""}</button>
        <div class="ops-task__body">
          <button type="button" class="ops-list__title" style="background:none;border:0;padding:0;color:inherit;text-align:start;cursor:pointer;width:100%"
                  data-action="open-task" data-id="${task.id}">${esc(task.title)}</button>
          <div class="ops-task__meta">
            ${task.assignee ? `<span class="ops-chip">${esc(task.assignee)}</span>` : `<span class="ops-chip">غير مُسنَد</span>`}
            ${task.due_at ? `<span class="ops-chip${late ? " ops-chip--danger" : ""}">${late ? "متأخرة · " : ""}${esc(dateLabel(task.due_at))}</span>` : ""}
            ${Number(task.priority) === 1 ? '<span class="ops-chip ops-chip--gold">أولوية عالية</span>' : ""}
            ${client ? `<span class="ops-chip">${esc(client.name)}</span>` : ""}
            ${task.estimate_minutes ? `<span class="ops-chip">${num(task.estimate_minutes)} د</span>` : ""}
          </div>
        </div>
      </li>`;
  }

  function renderTasks() {
    const filter = state.filters.tasks;
    const all = state.data.tasks;
    const rows = all.filter((t) => {
      if (filter === "open") return t.status !== "done";
      if (filter === "today") return isToday(t);
      if (filter === "late") return isLate(t);
      if (filter === "done") return t.status === "done";
      return true;
    });
    const order = { doing: 0, todo: 1, done: 2 };
    const sorted = [...rows].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || Number(a.priority) - Number(b.priority));

    return `
      <div class="ops-kpis">
        ${kpi("مهام مفتوحة", num(openTasks().length), "قيد العمل حاليًا")}
        ${kpi("مستحقة اليوم", num(all.filter(isToday).length), "من المهام المفتوحة", "gold")}
        ${kpi("متأخرة", num(all.filter(isLate).length), "تجاوزت موعدها", all.filter(isLate).length ? "danger" : "")}
        ${kpi("أُنجزت خلال 7 أيام", num(state.data.metrics?.tasks?.done_7d ?? 0), "مهام مكتملة", "mint")}
      </div>

      <section class="ops-panel">
        <div class="ops-panel__head">
          <h2>المهام</h2>
          <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="pomodoro">
            ${state.pomodoro ? `${Math.floor(state.pomodoro.left / 60)}:${String(state.pomodoro.left % 60).padStart(2, "0")} · إيقاف` : "جلسة تركيز 25 دقيقة"}
          </button>
          <button class="ops-btn ops-btn--sm" type="button" data-action="new-task">مهمة جديدة</button>
        </div>
        <div class="ops-panel__body">
          <div class="ops-filters" role="group" aria-label="تصفية المهام">
            ${[["open", "مفتوحة"], ["today", "اليوم"], ["late", "متأخرة"], ["done", "مكتملة"], ["all", "الكل"]]
              .map(([key, label]) => `<button class="ops-filter" type="button" data-action="filter-tasks" data-value="${key}" aria-pressed="${filter === key}">${label}</button>`)
              .join("")}
          </div>
        </div>
        <div class="ops-panel__body ops-panel__body--flush">
          ${sorted.length ? `<ul>${sorted.map(taskRow).join("")}</ul>` : `<p class="ops-empty">لا توجد مهام في هذا العرض.</p>`}
        </div>
      </section>`;
  }

  // ── team ───────────────────────────────────────────────────────────

  function renderTeam() {
    const members = state.data.members;
    const active = members.filter((m) => m.active);
    const unassigned = openTasks().filter((t) => !t.assignee).length;
    const totalOpen = openTasks().length;

    return `
      <div class="ops-kpis">
        ${kpi("أعضاء الفريق", num(active.length), `${num(members.length - active.length)} مؤرشف`)}
        ${kpi("مهام مفتوحة", num(totalOpen), `${num(unassigned)} بلا مسؤول`, unassigned ? "danger" : "")}
        ${kpi("طلبات قيد المتابعة", num(openLeads().length), "بحاجة إلى متابعة")}
        ${kpi("تركيز آخر 7 أيام", `${num(state.data.metrics?.focus?.week ?? 0)}<small>د</small>`, "إجمالي الدقائق المسجّلة", "mint")}
      </div>

      <section class="ops-panel">
        <div class="ops-panel__head">
          <h2>الفريق والتحميل</h2>
          <button class="ops-btn ops-btn--sm" type="button" data-action="new-member">عضو جديد</button>
        </div>
        <div class="ops-panel__body">
          <div class="ops-team">
            ${
              active.length
                ? active
                    .map((m) => {
                      const cap = Math.max(1, Math.round(Number(m.capacity_hours || 32) / 8));
                      const pct = Math.min(100, Math.round((Number(m.open_tasks || 0) / cap) * 100));
                      const over = Number(m.open_tasks || 0) > cap;
                      return `
                    <article class="ops-member">
                      <div class="ops-member__top">
                        <span class="ops-member__avatar">${esc(initials(m.name))}</span>
                        <div>
                          <p class="ops-member__name">${esc(m.name)}</p>
                          <p class="ops-member__focus">${esc(ROLES[m.role] || m.role)}${m.focus ? ` · ${esc(m.focus)}` : ""}</p>
                        </div>
                        <span class="ops-chip" style="margin-inline-start:auto">${num(m.open_leads || 0)} طلب</span>
                      </div>
                      <div class="ops-meter">
                        <div class="ops-meter__bar" ${over ? 'data-over="true"' : ""}><i style="width:${pct}%"></i></div>
                        <div class="ops-meter__legend">
                          <span>${num(m.open_tasks || 0)} مهمة مفتوحة</span>
                          <span>${num(m.late_tasks || 0)} متأخرة · ${num(m.minutes_7d || 0)} دقيقة أسبوعيًا</span>
                        </div>
                      </div>
                      <div class="ops-member__actions">
                        <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="edit-member" data-id="${m.id}">تعديل</button>
                        <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="open-member" data-id="${m.id}">تفاصيل</button>
                      </div>
                    </article>`;
                    })
                    .join("")
                : `<p class="ops-empty">إضافة أول عضو إلى الفريق، ثم أسند إليه الطلبات والمهام.</p>`
            }
          </div>
        </div>
      </section>`;
  }

  // ── channels ───────────────────────────────────────────────────────

  function renderChannels() {
    const channels = state.data.channels;
    const active = channels.find((c) => c.id === state.activeChannel) || channels[0];
    state.activeChannel = active?.id ?? null;
    return `
      <div class="ops-split">
        <section class="ops-panel">
          <div class="ops-panel__head"><h2>القنوات</h2><span class="ops-chip">${num(channels.length)}</span></div>
          <div class="ops-panel__body ops-panel__body--flush">
            ${
              channels.length
                ? `<ul class="ops-list">${channels
                    .map(
                      (c) => `
                  <li class="ops-list__row" data-action="open-channel" data-id="${c.id}" ${c.id === active?.id ? 'style="background:var(--surface-2)"' : ""}>
                    <span class="ops-avatar">#</span>
                    <span class="ops-list__main">
                      <span class="ops-list__title">${esc(c.slug)}</span>
                      <span class="ops-list__meta">${esc(c.topic || "بدون وصف")}</span>
                    </span>
                    <span class="ops-chip">${num(c.messages)} رسالة</span>
                  </li>`
                    )
                    .join("")}</ul>`
                : `<p class="ops-empty">لا توجد قنوات.</p>`
            }
          </div>
        </section>

        <section class="ops-panel">
          <div class="ops-panel__head">
            <h2>${active ? esc(active.slug) : "اختر قناة"}</h2>
          </div>
          <div class="ops-panel__body" data-messages>
            <p class="ops-empty">جارٍ التحميل…</p>
          </div>
          ${
            active
              ? `<form class="ops-panel__body" data-form="message" data-channel="${active.id}" style="border-top:1px solid var(--rule)">
                   <label class="ops-field">
                     <span>رسالة</span>
                     <textarea class="ops-textarea" name="body" rows="3" required placeholder="اكتب رسالة…"></textarea>
                   </label>
                   <button class="ops-btn" type="submit" style="margin-top:8px">إرسال</button>
                 </form>`
              : ""
          }
        </section>
      </div>`;
  }

  async function loadMessages(channelId) {
    const box = $("[data-messages]");
    if (!box || !channelId) return;
    try {
      const data = await api(`/channels/${channelId}/messages?limit=60`);
      box.innerHTML = data.rows.length
        ? `<ul class="ops-timeline">${data.rows
            .map(
              (m) => `<li data-kind="${esc(m.kind)}">
                <time>${esc(m.author)} · ${esc(ago(m.created_at))}</time>
                <p>${esc(m.body)}</p>
              </li>`
            )
            .join("")}</ul>`
        : `<p class="ops-empty">لا توجد رسائل في هذه القناة.</p>`;
      box.scrollTop = box.scrollHeight;
    } catch {
      box.innerHTML = `<p class="ops-empty">تعذّر تحميل الرسائل.</p>`;
    }
  }

  // ── agents ─────────────────────────────────────────────────────────

  function renderAgents() {
    const rows = state.data.agents;
    return `
      <div class="ops-kpis">
        ${kpi("الوكلاء", num(rows.length), `${num(rows.filter((a) => a.active).length)} نشط`)}
        ${kpi("نشطون مؤخرًا", num(rows.filter((a) => a.last_seen && daysBetween(a.last_seen) < 2).length), "آخر 48 ساعة", "mint")}
      </div>

      <section class="ops-panel">
        <div class="ops-panel__head">
          <h2>مفاتيح الوكلاء</h2>
          <button class="ops-btn ops-btn--sm" type="button" data-action="new-agent">وكيل جديد</button>
        </div>
        <div class="ops-panel__body ops-panel__body--flush">
          ${
            rows.length
              ? `<ul class="ops-list">${rows
                  .map(
                    (a) => `
                <li class="ops-list__row" data-action="toggle-agent" data-id="${a.id}">
                  <span class="ops-avatar">${esc(initials(a.name))}</span>
                  <span class="ops-list__main">
                    <span class="ops-list__title">${esc(a.name)}</span>
                    <span class="ops-list__meta">${esc(a.scopes)} · ${a.last_seen ? "آخر ظهور " + esc(ago(a.last_seen)) : "لم يُستخدم بعد"}</span>
                  </span>
                  <span class="ops-chip ${a.active ? "ops-chip--mint" : ""}">${a.active ? "نشط" : "موقوف"}</span>
                </li>`
                  )
                  .join("")}</ul>`
              : `<p class="ops-empty">لا يوجد وكلاء. يُنشأ لكل وكيل مفتاح بصلاحيات محددة.</p>`
          }
        </div>
      </section>`;
  }


  // ── drawer scaffolding ─────────────────────────────────────────────

  function drawerHead(title, sub) {
    return `
      <header class="ops-drawer__head">
        <div>
          <h2>${esc(title)}</h2>
          <p>${esc(sub)}</p>
        </div>
        <button class="ops-btn ops-btn--ghost ops-btn--sm ops-drawer__close" type="button" data-action="close-drawer" aria-label="إغلاق">
          <svg aria-hidden="true" style="width:14px;height:14px"><use href="#i-x"/></svg>
        </button>
      </header>`;
  }

  const optionsList = (map, selected) =>
    Object.entries(map)
      .map(([value, label]) => `<option value="${esc(value)}"${String(value) === String(selected ?? "") ? " selected" : ""}>${esc(label)}</option>`)
      .join("");

  function timeline(acts) {
    if (!acts.length) return `<p class="ops-empty">لا يوجد نشاط مسجّل.</p>`;
    return `<ul class="ops-timeline">${acts
      .map(
        (a) => `<li data-kind="${esc(a.kind)}">
          <time>${esc(ago(a.created_at))}${a.actor ? " · " + esc(a.actor) : ""}${a.minutes ? " · " + num(a.minutes) + " د" : ""}</time>
          <p>${esc(a.body)}</p>
        </li>`
      )
      .join("")}</ul>`;
  }

  function activityForm(entity, id) {
    return `
      <form data-form="activity" data-entity="${entity}" data-id="${id}" class="ops-field">
        <span>تسجيل تفاعل</span>
        <div class="ops-row">
          <select class="ops-select" name="kind" aria-label="نوع التفاعل">
            ${optionsList({ note: "ملاحظة", call: "مكالمة", email: "بريد إلكتروني", meeting: "اجتماع" }, "note")}
          </select>
          <input class="ops-input" name="minutes" type="number" min="0" max="240" placeholder="دقائق (اختياري)" dir="ltr">
        </div>
        <textarea class="ops-textarea" name="body" rows="2" required placeholder="ملخص التفاعل…"></textarea>
        <button class="ops-btn ops-btn--ghost ops-btn--sm" type="submit">إضافة</button>
      </form>`;
  }

  // ── lead drawer ────────────────────────────────────────────────────

  async function openLead(id) {
    const lead = state.data.leads.find((l) => l.id === id);
    if (!lead) return;
    state.drawer = { type: "lead", id };
    const box = $("[data-drawer]");
    box.hidden = false;
    box.innerHTML = drawerHead(lead.name, `طلب #${lead.id}`) + `<div class="ops-drawer__body"><p class="ops-empty">جارٍ التحميل…</p></div>`;

    let acts = [];
    try {
      acts = (await api(`/activities?entity=inquiry&entity_id=${id}`)).rows;
    } catch {}

    box.innerHTML = `
      ${drawerHead(lead.name, `طلب #${lead.id} · ${STAGE_LABEL[lead.status] || lead.status}`)}
      <div class="ops-drawer__body">
        <dl class="ops-kv">
          <div class="ops-kv__row"><dt>البريد الإلكتروني</dt><dd dir="ltr" style="text-align:start">${lead.email ? `<a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>` : "—"}</dd></div>
          <div class="ops-kv__row"><dt>التليفون</dt><dd dir="ltr" style="text-align:start">${lead.phone ? `<a href="tel:${esc(lead.phone)}">${esc(lead.phone)}</a>` : "—"}</dd></div>
          <div class="ops-kv__row"><dt>الباقة</dt><dd>${esc(lead.package || "—")}</dd></div>
          <div class="ops-kv__row"><dt>المصدر</dt><dd>${esc(SOURCE_LABEL[lead.source] || lead.source || "نموذج الموقع")} · ${esc(ago(lead.created_at))}</dd></div>
        </dl>

        <div class="ops-msg">${esc(lead.message)}</div>

        <form data-form="lead" data-id="${lead.id}" class="ops-field">
          <span>إدارة الطلب</span>
          <div class="ops-row">
            <label class="ops-field"><span>المرحلة</span>
              <select class="ops-select" name="status">${optionsList(STAGE_LABEL, lead.status)}</select>
            </label>
            <label class="ops-field"><span>القيمة (ج.م)</span>
              <input class="ops-input" name="value" type="number" min="0" step="500" value="${esc(lead.value ?? "")}" placeholder="0" dir="ltr">
            </label>
          </div>
          <div class="ops-row">
            <label class="ops-field"><span>المسؤول</span>
              <select class="ops-select" name="assigned_to">${memberOptions(lead.assigned_to)}</select>
            </label>
            <label class="ops-field"><span>الخطوة التالية</span>
              <input class="ops-input" name="next_action_at" type="date" value="${esc(String(lead.next_action_at || "").slice(0, 10))}" dir="ltr">
            </label>
          </div>
          <label class="ops-field"><span>سبب الخسارة (عند الإغلاق كمفقود)</span>
            <input class="ops-input" name="lost_reason" value="${esc(lead.lost_reason || "")}" placeholder="السعر / التأجيل / اختيار مزوّد آخر">
          </label>
          <button class="ops-btn" type="submit">حفظ التعديلات</button>
        </form>

        ${activityForm("inquiry", lead.id)}

        <div>
          <p style="font-size:12px;color:var(--fg-dim);margin-bottom:8px">السجل</p>
          ${timeline(acts)}
        </div>
      </div>
      <div class="ops-drawer__foot">
        ${lead.status !== "won" ? `<button class="ops-btn" type="button" data-action="convert-lead" data-id="${lead.id}">تحويل إلى عميل ومشروع</button>` : ""}
        ${lead.email ? `<a class="ops-btn ops-btn--ghost" href="mailto:${esc(lead.email)}">مراسلة</a>` : ""}
        <button class="ops-btn ops-btn--ghost" type="button" data-action="close-drawer">إغلاق</button>
      </div>`;
  }

  const options = optionsList;

  // ── client drawer ──────────────────────────────────────────────────

  async function openClient(id) {
    const client = state.data.clients.find((c) => c.id === id);
    if (!client) return;
    state.drawer = { type: "client", id };
    const box = $("[data-drawer]");
    box.hidden = false;
    box.innerHTML = drawerHead(client.name, `عميل #${client.id}`);

    let acts = [];
    try {
      acts = (await api(`/activities?entity=client&entity_id=${id}`)).rows;
    } catch {}
    const projects = state.data.projects.filter((p) => p.client_id === id);
    const tasks = state.data.tasks.filter((t) => t.client_id === id && t.status !== "done");

    box.innerHTML = `
      ${drawerHead(client.name, `عميل #${client.id} · ${CLIENT_STATUS[client.status] || client.status}`)}
      <div class="ops-drawer__body">
        <form data-form="client" data-id="${client.id}" class="ops-field">
          <span>بيانات العميل</span>
          <div class="ops-row">
            <label class="ops-field"><span>الاسم</span><input class="ops-input" name="name" value="${esc(client.name)}" required></label>
            <label class="ops-field"><span>الشركة</span><input class="ops-input" name="company" value="${esc(client.company || "")}"></label>
          </div>
          <div class="ops-row">
            <label class="ops-field"><span>البريد الإلكتروني</span><input class="ops-input" name="email" type="email" dir="ltr" value="${esc(client.email || "")}"></label>
            <label class="ops-field"><span>التليفون</span><input class="ops-input" name="phone" dir="ltr" value="${esc(client.phone || "")}"></label>
          </div>
          <div class="ops-row">
            <label class="ops-field"><span>الحالة</span><select class="ops-select" name="status">${options(CLIENT_STATUS, client.status)}</select></label>
            <label class="ops-field"><span>القيمة (ج.م)</span><input class="ops-input" name="value" type="number" min="0" step="500" dir="ltr" value="${esc(client.value ?? "")}"></label>
          </div>
          <label class="ops-field"><span>الخطوة التالية</span>
            <input class="ops-input" name="next_action_at" type="date" dir="ltr" value="${esc(String(client.next_action_at || "").slice(0, 10))}">
          </label>
          <label class="ops-field"><span>ملاحظات</span>
            <textarea class="ops-textarea" name="notes" rows="3">${esc(client.notes || "")}</textarea>
          </label>
          <button class="ops-btn" type="submit">حفظ</button>
        </form>

        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <p style="font-size:12px;color:var(--fg-dim)">المشاريع (${projects.length})</p>
            <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="new-project" data-client="${client.id}" style="margin-inline-start:auto">مشروع جديد</button>
          </div>
          ${
            projects.length
              ? `<ul class="ops-list" style="border:1px solid var(--rule)">${projects
                  .map(
                    (p) => `<li class="ops-list__row" style="cursor:default">
                      <span class="ops-list__main">
                        <span class="ops-list__title">${esc(p.title)}</span>
                        <span class="ops-list__meta">${esc(p.package || "بدون باقة")}${p.due_at ? " · مستحق " + esc(dateLabel(p.due_at)) : ""}</span>
                      </span>
                      <span class="ops-chip${p.status === "shipped" ? " ops-chip--mint" : ""}">${esc(p.status)}</span>
                    </li>`
                  )
                  .join("")}</ul>`
              : `<p class="ops-empty" style="border:1px solid var(--rule)">لا توجد مشاريع مسجّلة.</p>`
          }
        </div>

        <div>
          <p style="font-size:12px;color:var(--fg-dim);margin-bottom:8px">مهام مفتوحة (${tasks.length})</p>
          ${
            tasks.length
              ? `<ul class="ops-list" style="border:1px solid var(--rule)">${tasks
                  .map(
                    (t) => `<li class="ops-list__row" data-action="open-task" data-id="${t.id}">
                      <span class="ops-list__main">
                        <span class="ops-list__title">${esc(t.title)}</span>
                        <span class="ops-list__meta">${esc(t.assignee || "غير مُسنَد")}${t.due_at ? " · " + esc(dateLabel(t.due_at)) : ""}</span>
                      </span>
                    </li>`
                  )
                  .join("")}</ul>`
              : `<p class="ops-empty" style="border:1px solid var(--rule)">لا توجد مهام مفتوحة.</p>`
          }
        </div>

        ${activityForm("client", client.id)}

        <div>
          <p style="font-size:12px;color:var(--fg-dim);margin-bottom:8px">السجل</p>
          ${timeline(acts)}
        </div>
      </div>
      <div class="ops-drawer__foot">
        ${client.email ? `<a class="ops-btn" href="mailto:${esc(client.email)}">مراسلة</a>` : ""}
        <button class="ops-btn ops-btn--ghost" type="button" data-action="new-task" data-client="${client.id}">مهمة جديدة</button>
        <button class="ops-btn ops-btn--ghost" type="button" data-action="close-drawer">إغلاق</button>
      </div>`;
  }

  // ── task drawer ────────────────────────────────────────────────────

  async function openTask(id) {
    const task = state.data.tasks.find((t) => t.id === id);
    if (!task) return;
    state.drawer = { type: "task", id };
    const box = $("[data-drawer]");
    box.hidden = false;
    let acts = [];
    try {
      acts = (await api(`/activities?entity=task&entity_id=${id}`)).rows;
    } catch {}

    box.innerHTML = `
      ${drawerHead(task.title, `مهمة #${task.id} · ${TASK_LABEL[task.status] || task.status}`)}
      <div class="ops-drawer__body">
        ${task.detail ? `<div class="ops-msg">${esc(task.detail)}</div>` : ""}
        <form data-form="task" data-id="${task.id}" class="ops-field">
          <div class="ops-row">
            <label class="ops-field"><span>الحالة</span><select class="ops-select" name="status">${options(TASK_LABEL, task.status)}</select></label>
            <label class="ops-field"><span>الأولوية</span><select class="ops-select" name="priority">${options(PRIORITY_LABEL, task.priority)}</select></label>
          </div>
          <div class="ops-row">
            <label class="ops-field"><span>المسؤول</span><select class="ops-select" name="assignee">${memberOptions(task.assignee)}</select></label>
            <label class="ops-field"><span>الموعد</span><input class="ops-input" name="due_at" type="date" dir="ltr" value="${esc(String(task.due_at || "").slice(0, 10))}"></label>
          </div>
          <label class="ops-field"><span>التقدير بالدقائق</span>
            <input class="ops-input" name="estimate_minutes" type="number" min="0" step="15" dir="ltr" value="${esc(task.estimate_minutes ?? "")}">
          </label>
          <button class="ops-btn" type="submit">حفظ</button>
        </form>

        ${activityForm("task", task.id)}

        <div>
          <p style="font-size:12px;color:var(--fg-dim);margin-bottom:8px">السجل</p>
          ${timeline(acts)}
        </div>
      </div>
      <div class="ops-drawer__foot">
        <button class="ops-btn" type="button" data-action="toggle-task" data-id="${task.id}">
          ${task.status === "done" ? "إعادة فتح المهمة" : "تحديدها كمكتملة"}
        </button>
        <button class="ops-btn ops-btn--ghost" type="button" data-action="close-drawer">إغلاق</button>
      </div>`;
  }

  // ── member drawer ──────────────────────────────────────────────────

  function openMember(id) {
    const m = state.data.members.find((x) => x.id === id);
    if (!m) return;
    state.drawer = { type: "member", id };
    const box = $("[data-drawer]");
    box.hidden = false;
    const tasks = openTasks().filter((t) => t.assignee === m.name);
    const leads = openLeads().filter((l) => l.assigned_to === m.name);
    box.innerHTML = `
      ${drawerHead(m.name, `${ROLES[m.role] || m.role}${m.active ? "" : " · مؤرشف"}`)}
      <div class="ops-drawer__body">
        <dl class="ops-kv">
          <div class="ops-kv__row"><dt>التركيز</dt><dd>${esc(m.focus || "—")}</dd></div>
          <div class="ops-kv__row"><dt>البريد الإلكتروني</dt><dd dir="ltr" style="text-align:start">${esc(m.email || "—")}</dd></div>
          <div class="ops-kv__row"><dt>التليفون</dt><dd dir="ltr" style="text-align:start">${esc(m.phone || "—")}</dd></div>
          <div class="ops-kv__row"><dt>السعة</dt><dd>${num(m.capacity_hours)} ساعة/أسبوع</dd></div>
          <div class="ops-kv__row"><dt>التحميل</dt><dd>${num(m.open_tasks || 0)} مهمة · ${num(m.open_leads || 0)} طلب · ${num(m.minutes_7d || 0)} د آخر أسبوع</dd></div>
        </dl>
        ${m.notes ? `<div class="ops-msg">${esc(m.notes)}</div>` : ""}
        <div>
          <p style="font-size:12px;color:var(--fg-dim);margin-bottom:8px">العمل المسند إليه</p>
          ${
            tasks.length || leads.length
              ? `<ul class="ops-list" style="border:1px solid var(--rule)">
                   ${leads.map((l) => `<li class="ops-list__row" data-action="open-lead" data-id="${l.id}">
                     <span class="ops-list__main"><span class="ops-list__title">${esc(l.name)}</span><span class="ops-list__meta">طلب · ${esc(STAGE_LABEL[l.status] || l.status)}</span></span>
                   </li>`).join("")}
                   ${tasks.map((t) => `<li class="ops-list__row" data-action="open-task" data-id="${t.id}">
                     <span class="ops-list__main"><span class="ops-list__title">${esc(t.title)}</span><span class="ops-list__meta">مهمة${isLate(t) ? " · متأخرة" : ""}</span></span>
                   </li>`).join("")}
                 </ul>`
              : `<p class="ops-empty" style="border:1px solid var(--rule)">لا يوجد عمل مسند إليه حاليًا.</p>`
          }
        </div>
      </div>
      <div class="ops-drawer__foot">
        <button class="ops-btn ops-btn--ghost" type="button" data-action="edit-member" data-id="${m.id}">تعديل البيانات</button>
        <button class="ops-btn ops-btn--ghost" type="button" data-action="close-drawer">إغلاق</button>
      </div>`;
  }

  // ── dialogs ────────────────────────────────────────────────────────

  function openDialog({ title, body, submit = "حفظ", onSubmit }) {
    const dlg = $("[data-dialog]");
    dlg.innerHTML = `
      <form data-dialog-form novalidate>
        <header class="ops-dialog__head">
          <h2>${esc(title)}</h2>
          <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="close-dialog" style="margin-inline-start:auto">إغلاق</button>
        </header>
        <div class="ops-dialog__body">${body}</div>
        <footer class="ops-dialog__foot">
          <button class="ops-btn ops-btn--ghost" type="button" data-action="close-dialog">إلغاء</button>
          <button class="ops-btn" type="submit">${esc(submit)}</button>
        </footer>
      </form>`;
    state.dialogSubmit = onSubmit;
    dlg.showModal();
    dlg.querySelector("input, select, textarea")?.focus();
  }

  const dialogNewLead = () =>
    openDialog({
      title: "طلب جديد",
      body: `
        <div class="ops-row">
          <label class="ops-field"><span>الاسم</span><input class="ops-input" name="name" required></label>
          <label class="ops-field"><span>الباقة</span><input class="ops-input" name="package" placeholder="logo / site / pos…"></label>
        </div>
        <div class="ops-row">
          <label class="ops-field"><span>البريد الإلكتروني</span><input class="ops-input" name="email" type="email" dir="ltr"></label>
          <label class="ops-field"><span>التليفون</span><input class="ops-input" name="phone" dir="ltr"></label>
        </div>
        <label class="ops-field"><span>نص الطلب</span><textarea class="ops-textarea" name="message" required rows="3"></textarea></label>`,
      onSubmit: async (fd) => {
        await api("/inquiries", {
          method: "POST",
          body: {
            name: fd.get("name"),
            email: fd.get("email"),
            phone: fd.get("phone"),
            package: fd.get("package"),
            message: fd.get("message"),
            source: "console",
          },
        });
        toast("تمت إضافة الطلب.", "ok");
      },
    });

  const dialogNewClient = () =>
    openDialog({
      title: "عميل جديد",
      body: `
        <div class="ops-row">
          <label class="ops-field"><span>الاسم</span><input class="ops-input" name="name" required></label>
          <label class="ops-field"><span>الشركة</span><input class="ops-input" name="company"></label>
        </div>
        <div class="ops-row">
          <label class="ops-field"><span>البريد الإلكتروني</span><input class="ops-input" name="email" type="email" dir="ltr"></label>
          <label class="ops-field"><span>التليفون</span><input class="ops-input" name="phone" dir="ltr"></label>
        </div>
        <div class="ops-row">
          <label class="ops-field"><span>الحالة</span><select class="ops-select" name="status">${options(CLIENT_STATUS, "active")}</select></label>
          <label class="ops-field"><span>القيمة (ج.م)</span><input class="ops-input" name="value" type="number" min="0" step="500" dir="ltr"></label>
        </div>
        <label class="ops-field"><span>ملاحظات</span><textarea class="ops-textarea" name="notes" rows="2"></textarea></label>`,
      onSubmit: async (fd) => {
        await api("/clients", {
          method: "POST",
          body: {
            name: fd.get("name"),
            company: fd.get("company"),
            email: fd.get("email"),
            phone: fd.get("phone"),
            status: fd.get("status"),
            value: fd.get("value") ? Number(fd.get("value")) : null,
            notes: fd.get("notes"),
          },
        });
        toast("تمت إضافة العميل.", "ok");
      },
    });

  const dialogNewTask = (clientId = "") =>
    openDialog({
      title: "مهمة جديدة",
      body: `
        <label class="ops-field"><span>العنوان</span><input class="ops-input" name="title" required></label>
        <label class="ops-field"><span>التفاصيل</span><textarea class="ops-textarea" name="detail" rows="2"></textarea></label>
        <div class="ops-row">
          <label class="ops-field"><span>المسؤول</span><select class="ops-select" name="assignee">${memberOptions("")}</select></label>
          <label class="ops-field"><span>الموعد</span><input class="ops-input" name="due_at" type="date" dir="ltr"></label>
        </div>
        <div class="ops-row">
          <label class="ops-field"><span>الأولوية</span><select class="ops-select" name="priority">${options(PRIORITY_LABEL, 2)}</select></label>
          <label class="ops-field"><span>التقدير بالدقائق</span><input class="ops-input" name="estimate_minutes" type="number" min="0" step="15" dir="ltr"></label>
        </div>
        <label class="ops-field"><span>العميل</span>
          <select class="ops-select" name="client_id">
            <option value="">بدون عميل</option>
            ${state.data.clients.map((c) => `<option value="${c.id}"${String(c.id) === String(clientId) ? " selected" : ""}>${esc(c.name)}</option>`).join("")}
          </select>
        </label>`,
      onSubmit: async (fd) => {
        await api("/tasks", {
          method: "POST",
          body: {
            title: fd.get("title"),
            detail: fd.get("detail"),
            assignee: fd.get("assignee"),
            due_at: fd.get("due_at"),
            priority: Number(fd.get("priority") || 2),
            estimate_minutes: fd.get("estimate_minutes") ? Number(fd.get("estimate_minutes")) : null,
            client_id: fd.get("client_id") ? Number(fd.get("client_id")) : null,
          },
        });
        toast("تمت إضافة المهمة.", "ok");
      },
    });

  const dialogMember = (member = null) =>
    openDialog({
      title: member ? `تعديل ${member.name}` : "عضو جديد",
      body: `
        <div class="ops-row">
          <label class="ops-field"><span>الاسم</span><input class="ops-input" name="name" required value="${esc(member?.name || "")}"></label>
          <label class="ops-field"><span>الدور</span><select class="ops-select" name="role">${options(ROLES, member?.role || "member")}</select></label>
        </div>
        <div class="ops-row">
          <label class="ops-field"><span>البريد الإلكتروني</span><input class="ops-input" name="email" type="email" dir="ltr" value="${esc(member?.email || "")}"></label>
          <label class="ops-field"><span>التليفون</span><input class="ops-input" name="phone" dir="ltr" value="${esc(member?.phone || "")}"></label>
        </div>
        <div class="ops-row">
          <label class="ops-field"><span>مجال العمل</span><input class="ops-input" name="focus" placeholder="تصميم / برمجة / متابعة" value="${esc(member?.focus || "")}"></label>
          <label class="ops-field"><span>ساعات الأسبوع</span><input class="ops-input" name="capacity_hours" type="number" min="1" max="80" dir="ltr" value="${esc(member?.capacity_hours ?? 32)}"></label>
        </div>
        <label class="ops-field"><span>ملاحظات</span><textarea class="ops-textarea" name="notes" rows="2">${esc(member?.notes || "")}</textarea></label>
        ${member ? `<label class="ops-field" style="grid-auto-flow:column;justify-content:start;align-items:center;gap:8px"><input type="checkbox" name="active" ${member.active ? "checked" : ""}> <span>نشط ضمن الفريق</span></label>` : ""}`,
      onSubmit: async (fd) => {
        const payload = {
          name: fd.get("name"),
          role: fd.get("role"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          focus: fd.get("focus"),
          capacity_hours: Number(fd.get("capacity_hours") || 32),
          notes: fd.get("notes"),
        };
        if (member) {
          payload.active = fd.get("active") ? 1 : 0;
          await api(`/members/${member.id}`, { method: "PATCH", body: payload });
          toast("تم التحديث.", "ok");
        } else {
          await api("/members", { method: "POST", body: payload });
          toast("تمت إضافة العضو.", "ok");
        }
      },
    });

  const dialogProject = (clientId) =>
    openDialog({
      title: "مشروع جديد",
      body: `
        <label class="ops-field"><span>العنوان</span><input class="ops-input" name="title" required></label>
        <div class="ops-row">
          <label class="ops-field"><span>الباقة</span><input class="ops-input" name="package"></label>
          <label class="ops-field"><span>الحالة</span><select class="ops-select" name="status">${options({ planned: "مخطط", building: "تحت التنفيذ", review: "مراجعة", shipped: "تم التسليم" }, "planned")}</select></label>
        </div>
        <label class="ops-field"><span>الموعد</span><input class="ops-input" name="due_at" type="date" dir="ltr"></label>`,
      onSubmit: async (fd) => {
        await api("/projects", {
          method: "POST",
          body: { client_id: Number(clientId), title: fd.get("title"), package: fd.get("package"), status: fd.get("status"), due_at: fd.get("due_at") },
        });
        toast("تمت إضافة المشروع.", "ok");
      },
    });

  const dialogAgent = () =>
    openDialog({
      title: "وكيل جديد",
      submit: "إنشاء المفتاح",
      body: `
        <label class="ops-field"><span>الاسم</span><input class="ops-input" name="name" required placeholder="ops-bot"></label>
        <fieldset style="border:1px solid var(--rule-strong);padding:10px;display:flex;gap:14px">
          <legend style="font-size:12px;color:var(--fg-dim);padding:0 6px">الصلاحيات</legend>
          <label><input type="checkbox" name="scopes" value="read" checked> قراءة</label>
          <label><input type="checkbox" name="scopes" value="write"> كتابة</label>
          <label><input type="checkbox" name="scopes" value="admin"> إدارة</label>
        </fieldset>`,
      onSubmit: async (fd) => {
        const scopes = fd.getAll("scopes").join(",") || "read";
        const data = await api("/agents", { method: "POST", body: { name: fd.get("name"), scopes } });
        openDialog({
          title: "مفتاح الوكيل — يُعرض مرة واحدة",
          body: `<p style="font-size:13px;color:var(--fg-dim)">انسخ المفتاح الآن؛ لا يُحتفظ به على الخادم بصيغة مقروءة.</p>
                 <div class="ops-msg" dir="ltr" style="font-family:var(--font-mono)">${esc(data.row?.key || data.key || "")}</div>`,
          submit: "تم",
          onSubmit: async () => {},
        });
        return { keepOpen: true };
      },
    });

  const dialogRotate = () =>
    openDialog({
      title: "تغيير كود الدخول",
      submit: "تأكيد التغيير",
      body: `
        <p style="font-size:13px;color:var(--fg-dim)">يجب ألا يقل الكود الجديد عن 12 حرفًا. يتغيّر فورًا وتُنهى أي جلسة أخرى.</p>
        <label class="ops-field"><span>الكود الجديد</span><input class="ops-input" name="next" type="password" required minlength="12" autocomplete="new-password" dir="ltr"></label>
        <label class="ops-field"><span>تأكيد الكود</span><input class="ops-input" name="confirm" type="password" required minlength="12" autocomplete="new-password" dir="ltr"></label>`,
      onSubmit: async (fd) => {
        if (fd.get("next") !== fd.get("confirm")) throw new Error("الكودان غير متطابقين");
        await api("/admin/token", { method: "POST", body: { current: state.token, next: fd.get("next") } });
        state.token = fd.get("next");
        sessionStorage.setItem(KEY, state.token);
        toast("تم تغيير كود الدخول.", "ok");
      },
    });

  // ── render & refresh ───────────────────────────────────────────────

  function render() {
    const fns = {
      overview: renderOverview,
      pipeline: renderPipeline,
      clients: renderClients,
      tasks: renderTasks,
      team: renderTeam,
      channels: renderChannels,
      agents: renderAgents,
    };
    const panel = $(`[data-panel="${state.view}"]`);
    if (panel) panel.innerHTML = fns[state.view]();
    $$("[data-count]").forEach((node) => {
      if (node.dataset.count === "pipeline") node.textContent = String(openLeads().length);
      if (node.dataset.count === "tasks") node.textContent = String(openTasks().length);
    });
    if (state.view === "channels" && state.activeChannel) loadMessages(state.activeChannel);
  }

  async function refreshKeepingDrawer() {
    await loadAll();
    const d = state.drawer;
    if (!d) return;
    if (d.type === "lead") await openLead(d.id);
    else if (d.type === "client") await openClient(d.id);
    else if (d.type === "task") await openTask(d.id);
    else if (d.type === "member") openMember(d.id);
  }

  // ── mutations ──────────────────────────────────────────────────────

  async function moveLead(id, status) {
    await api(`/inquiries/${id}`, { method: "PATCH", body: { status } });
    toast(`تم نقل الطلب إلى «${STAGE_LABEL[status]}».`, "ok");
    await refreshKeepingDrawer();
  }

  async function toggleTask(id) {
    const task = state.data.tasks.find((t) => t.id === id);
    if (!task) return;
    await api(`/tasks/${id}`, { method: "PATCH", body: { status: task.status === "done" ? "todo" : "done" } });
    await refreshKeepingDrawer();
  }

  async function toggleAgent(id) {
    const agent = state.data.agents.find((a) => a.id === id);
    if (!agent) return;
    await api(`/agents/${id}`, { method: "PATCH", body: { active: agent.active ? 0 : 1 } });
    await loadAll();
  }

  async function convertLead(id) {
    const data = await api(`/inquiries/${id}/convert`, { method: "POST", body: {} });
    toast("تم تحويل الطلب إلى عميل مع مشروع ومهمة.", "ok");
    closeDrawer();
    await loadAll();
    setView("clients");
    if (data.client_id) await openClient(data.client_id);
  }

  function togglePomodoro() {
    if (state.pomodoro) {
      clearInterval(state.timer);
      state.pomodoro = null;
      render();
      return;
    }
    state.pomodoro = { left: 25 * 60 };
    state.timer = setInterval(async () => {
      if (!state.pomodoro) return;
      state.pomodoro.left -= 1;
      if (state.pomodoro.left <= 0) {
        clearInterval(state.timer);
        state.pomodoro = null;
        try {
          await api("/time", { method: "POST", body: { minutes: 25, label: "جلسة تركيز" } });
          toast("سُجّلت 25 دقيقة. خذ استراحة قصيرة.", "ok");
        } catch {
          toast("انتهت الجلسة دون تسجيلها.", "bad");
        }
        await loadAll();
        if (state.view === "tasks") render();
        return;
      }
      const btn = $('[data-action="pomodoro"]');
      if (btn) btn.textContent = `${Math.floor(state.pomodoro.left / 60)}:${String(state.pomodoro.left % 60).padStart(2, "0")} · إيقاف`;
    }, 1000);
    render();
  }

  async function sendMessage(form) {
    const body = new FormData(form).get("body");
    if (!String(body || "").trim()) return;
    await api(`/channels/${form.dataset.channel}/messages`, { method: "POST", body: { body } });
    form.reset();
    await loadAll();
  }

  // ── events ─────────────────────────────────────────────────────────

  const ACTIONS = {
    "close-drawer": () => closeDrawer(),
    "close-dialog": () => $("[data-dialog]").close(),
    "open-lead": (el) => openLead(Number(el.dataset.id)),
    "open-client": (el) => openClient(Number(el.dataset.id)),
    "open-task": (el) => openTask(Number(el.dataset.id)),
    "open-member": (el) => openMember(Number(el.dataset.id)),
    "open-channel": (el) => {
      state.activeChannel = Number(el.dataset.id);
      render();
    },
    "filter-tasks": (el) => {
      state.filters.tasks = el.dataset.value;
      render();
    },
    "toggle-task": (el) => toggleTask(Number(el.dataset.id)),
    "toggle-agent": (el) => toggleAgent(Number(el.dataset.id)),
    "convert-lead": (el) => convertLead(Number(el.dataset.id)),
    pomodoro: () => togglePomodoro(),
    "new-lead": () => dialogNewLead(),
    "new-client": () => dialogNewClient(),
    "new-task": (el) => dialogNewTask(el.dataset.client || ""),
    "new-member": () => dialogMember(),
    "new-project": (el) => dialogProject(el.dataset.client),
    "new-agent": () => dialogAgent(),
    "edit-member": (el) => dialogMember(state.data.members.find((m) => m.id === Number(el.dataset.id))),
  };

  document.addEventListener("click", (event) => {
    const viewBtn = event.target.closest("[data-view]");
    if (viewBtn) {
      setView(viewBtn.dataset.view);
      return;
    }
    const el = event.target.closest("[data-action]");
    if (!el || ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) return;
    const fn = ACTIONS[el.dataset.action];
    if (!fn) return;
    event.preventDefault();
    Promise.resolve(fn(el)).catch((err) => {
      if (String(err.message) !== "unauthorized") toast("تعذّر إتمام العملية. حاول مرة أخرى.", "bad");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.drawer) closeDrawer();
    if ((event.key === "Enter" || event.key === " ") && event.target.classList?.contains("ops-lead")) {
      event.preventDefault();
      openLead(Number(event.target.dataset.id));
    }
  });

  let filterTimer = null;
  document.addEventListener("input", (event) => {
    if (event.target.dataset.action !== "filter-pipeline") return;
    state.filters.pipeline = event.target.value;
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => render(), 150);
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("form");
    if (!form || form.matches("[data-gate-form]")) return;
    event.preventDefault();
    const fd = new FormData(form);
    try {
      if (form.matches("[data-dialog-form]")) {
        const result = await state.dialogSubmit(fd);
        if (!result?.keepOpen) $("[data-dialog]").close();
        await refreshKeepingDrawer();
        return;
      }
      const kind = form.dataset.form;
      if (kind === "lead") {
        await api(`/inquiries/${form.dataset.id}`, {
          method: "PATCH",
          body: {
            status: fd.get("status"),
            value: fd.get("value") ? Number(fd.get("value")) : null,
            assigned_to: fd.get("assigned_to") || "",
            next_action_at: fd.get("next_action_at") || "",
            lost_reason: fd.get("lost_reason") || "",
          },
        });
        toast("تم تحديث الطلب.", "ok");
      } else if (kind === "client") {
        await api(`/clients/${form.dataset.id}`, {
          method: "PATCH",
          body: {
            name: fd.get("name"),
            company: fd.get("company"),
            email: fd.get("email"),
            phone: fd.get("phone"),
            status: fd.get("status"),
            value: fd.get("value") ? Number(fd.get("value")) : null,
            next_action_at: fd.get("next_action_at") || "",
            notes: fd.get("notes"),
          },
        });
        toast("تم تحديث العميل.", "ok");
      } else if (kind === "task") {
        await api(`/tasks/${form.dataset.id}`, {
          method: "PATCH",
          body: {
            status: fd.get("status"),
            priority: Number(fd.get("priority")),
            assignee: fd.get("assignee") || "",
            due_at: fd.get("due_at") || "",
            estimate_minutes: fd.get("estimate_minutes") ? Number(fd.get("estimate_minutes")) : null,
          },
        });
        toast("تم تحديث المهمة.", "ok");
      } else if (kind === "activity") {
        await api("/activities", {
          method: "POST",
          body: {
            entity: form.dataset.entity,
            entity_id: Number(form.dataset.id),
            kind: fd.get("kind"),
            body: fd.get("body"),
            minutes: fd.get("minutes") ? Number(fd.get("minutes")) : null,
          },
        });
        toast("تم تسجيل التفاعل.", "ok");
      } else if (kind === "message") {
        await sendMessage(form);
        return;
      }
      await refreshKeepingDrawer();
    } catch (err) {
      if (String(err.message) !== "unauthorized") toast("تعذّر إتمام العملية. حاول مرة أخرى.", "bad");
    }
  });

  document.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".ops-lead");
    if (!card) return;
    event.dataTransfer.setData("text/plain", card.dataset.id);
    event.dataTransfer.effectAllowed = "move";
  });

  document.addEventListener("dragover", (event) => {
    const col = event.target.closest("[data-drop]");
    if (!col) return;
    event.preventDefault();
    $$(".ops-col").forEach((c) => c.removeAttribute("data-over"));
    col.setAttribute("data-over", "true");
  });

  document.addEventListener("dragend", () => $$(".ops-col").forEach((c) => c.removeAttribute("data-over")));

  document.addEventListener("drop", async (event) => {
    const col = event.target.closest("[data-drop]");
    if (!col) return;
    event.preventDefault();
    col.removeAttribute("data-over");
    const id = Number(event.dataTransfer.getData("text/plain"));
    const lead = state.data.leads.find((l) => l.id === id);
    if (!lead || lead.status === col.dataset.drop) return;
    try {
      await moveLead(id, col.dataset.drop);
    } catch (err) {
      toast("تعذّر إتمام العملية. حاول مرة أخرى.", "bad");
    }
  });

  // ── boot ───────────────────────────────────────────────────────────

  async function unlock() {
    setSync("جارٍ الدخول…");
    state.me = null;
    try {
      const overview = await api("/overview");
      state.me = overview.who;
      sessionStorage.setItem(KEY, state.token);
      $("[data-gate]").hidden = true;
      $("[data-shell]").hidden = false;
      $("[data-who]").innerHTML = `<i>●</i> ${esc(state.me.name)} · ${esc(state.me.role)}`;
      await loadAll();
      setView(location.hash.replace("#", "") || "overview", false);
    } catch (err) {
      if (String(err.message) === "unauthorized") lock("كود الدخول غير صحيح. حاول مرة أخرى.");
      else lock("تعذّر الاتصال بالخادم.");
    }
  }

  $("[data-gate-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = event.target.querySelector("input[name=token]");
    const value = input.value.trim();
    if (!value) return;
    state.token = value;
    $("[data-gate-status]").textContent = "";
    await unlock();
    if (!state.me) input.select();
  });

  $("[data-reveal]").addEventListener("click", (event) => {
    const input = $("[data-gate-form] input[name=token]");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    event.currentTarget.textContent = show ? "إخفاء" : "إظهار";
  });

  $$("[data-lock]").forEach((btn) => btn.addEventListener("click", () => lock("تم تسجيل الخروج. أدخل كود الدخول مرة أخرى.")));
  $$("[data-rotate]").forEach((btn) => btn.addEventListener("click", () => dialogRotate()));
  $("[data-refresh]").addEventListener("click", () => loadAll());
  window.addEventListener("hashchange", () => setView(location.hash.replace("#", "") || "overview", false));

  setInterval(() => {
    if (!document.hidden && state.token) loadAll();
  }, 90000);

  if (state.token) unlock();
  else lock("");
})();
