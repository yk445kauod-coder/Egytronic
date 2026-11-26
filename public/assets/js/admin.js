/* egytronic operations console.
   Plain JS, one delegated click handler, no build step. Every string that comes
   from the database is escaped before it reaches innerHTML. */
(() => {
  "use strict";

  const API = "/api";
  const KEY = "egx.console.token";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const can = (permission) => Boolean(state.me?.permissions?.includes(permission));

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
  const INVOICE_STATUS_LABEL = { draft: "مسودة", sent: "مُرسلة", partial: "مدفوعة جزئيًا", paid: "مدفوعة", void: "ملغاة" };
  const INVOICE_TONE = { draft: "", sent: "ops-chip--gold", partial: "ops-chip--gold", paid: "ops-chip--mint", void: "ops-chip--danger" };
  const PAYMENT_METHOD_LABEL = { cash: "كاش", bank: "تحويل بنكي", wallet: "محفظة", instapay: "إنستا باي", other: "أخرى" };

  const PERMISSION_LABELS = {
    "tasks.all": "كل المهام (عرض وتعديل مهام الجميع)",
    "tasks.manage": "إدارة مهامه هو",
    "inquiries.view": "عرض الطلبات",
    "inquiries.manage": "إدارة الطلبات والمراحل",
    "clients.view": "عرض العملاء",
    "clients.manage": "إدارة العملاء",
    "projects.view": "عرض المشاريع",
    "projects.manage": "إدارة المشاريع",
    "finance.view": "رؤية الأرقام المالية",
    "team.manage": "إدارة الفريق والصلاحيات وكلمات المرور",
    "channels.manage": "قنواته ومحادثاته",
    "channels.post": "الكتابة في كل القنوات",
    "code.view": "عرض المستودعات والملفات من GitHub",
    "code.manage": "تعديل الملفات وعمل كوميتات",
    "agents.manage": "إدارة مفاتيح الوكلاء",
    "settings.manage": "إعدادات الحساب",
  };
  const ROLE_DEFAULTS = {
    owner: Object.keys(PERMISSION_LABELS),
    manager: Object.keys(PERMISSION_LABELS).filter((p) => !["settings.manage", "agents.manage"].includes(p)),
    member: ["tasks.manage", "inquiries.view", "clients.view", "projects.view", "channels.manage", "code.view"],
    contractor: ["tasks.manage", "projects.view", "channels.manage", "code.view"],
  };

  const state = {
    token: sessionStorage.getItem(KEY) || "",
    me: null,
    space: null,
    view: "overview",
    loading: false,
    data: {
      metrics: null,
      leads: [],
      clients: [],
      tasks: [],
      members: [],
      channels: [],
      agents: [],
      activities: [],
      projects: [],
      invoices: [],
      finance: null,
      integrations: null,
    },
    integRuns: null,
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
      credentials: "same-origin",
      headers: {
        ...(state.token ? { authorization: `Bearer ${state.token}` } : {}),
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
  const memberOptionsById = (selected) =>
    ['<option value="">غير مُسنَد</option>']
      .concat(
        state.data.members
          .filter((m) => m.active)
          .map((m) => `<option value="${m.id}"${Number(m.id) === Number(selected) ? " selected" : ""}>${esc(m.name)}</option>`)
      )
      .join("");

  const memberOptions = (selected) =>
    ['<option value="">غير مُسنَد</option>']
      .concat(memberNames().map((n) => `<option value="${esc(n)}"${n === selected ? " selected" : ""}>${esc(n)}</option>`))
      .join("");

  // ── chrome ─────────────────────────────────────────────────────────

  const TITLES = {
    me: "مساحتي",
    overview: "نظرة عامة",
    pipeline: "خط المبيعات",
    clients: "العملاء",
    money: "المال",
    tasks: "المهام",
    team: "الفريق",
    channels: "القنوات",
    code: "الكود",
    integrations: "التكامل",
    agents: "الوكلاء",
  };

  const haptic = (pattern = 10) => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      navigator.vibrate?.(pattern);
    } catch {}
  };

  let toastTimer = null;
  function toast(message, tone = "") {
    haptic(tone === "bad" ? [18, 40, 18] : tone === "ok" ? 10 : 6);
    const node = $("[data-toast]");
    node.textContent = message;
    node.dataset.tone = tone;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (node.hidden = true), 2800);
  }

  function setSync(text) {
    const node = $("[data-sync]");
    if (node) node.textContent = text;
  }

  function lock(message = "") {
    state.token = "";
    state.me = null;
    state.space = null;
    sessionStorage.removeItem(KEY);
    $("[data-shell]").hidden = true;
    $("[data-gate]").hidden = false;
    const status = $("[data-gate-status]");
    status.textContent = message;
    status.dataset.state = message ? "error" : "";
    $("[data-gate-form] input[name=email]").focus();
  }

  const allowedViews = () =>
    $$("[data-nav] .ops__nav-btn")
      .filter((btn) => !btn.dataset.perm || can(btn.dataset.perm))
      .map((btn) => btn.dataset.view);

  function applyPermissions() {
    $$("[data-nav] .ops__nav-btn").forEach((btn) => {
      btn.hidden = Boolean(btn.dataset.perm) && !can(btn.dataset.perm);
    });
    $$("[data-tabs] button").forEach((btn) => {
      btn.hidden = Boolean(btn.dataset.perm) && !can(btn.dataset.perm);
    });
    // rotating the static owner token only makes sense for the owner's break-glass session
    $$("[data-rotate]").forEach((btn) => (btn.hidden = Boolean(state.me?.id)));
  }

  function setView(view, push = true) {
    if (!TITLES[view] || !allowedViews().includes(view)) view = allowedViews()[0] || "me";
    state.view = view;
    $$("[data-panel]").forEach((panel) => (panel.hidden = panel.dataset.panel !== view));
    $$("[data-nav] .ops__nav-btn").forEach((btn) => {
      const on = btn.dataset.view === view;
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    $$("[data-tabs] button").forEach((btn) => {
      if (btn.dataset.view === view) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    closeRail();
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

  const empty = { rows: [] };
  const pick = (permission) => (permission && !can(permission) ? Promise.resolve(empty) : null);

  // A single failing endpoint must never blank the whole console: each section
  // settles on its own and keeps its previous data when the request fails.
  const settle = (label, run) =>
    Promise.resolve()
      .then(run)
      .then((value) => ({ label, value }))
      .catch((error) => ({ label, error }));

  async function loadAll() {
    state.loading = true;
    setSync("جارٍ التحديث…");
    const prev = state.data;
    const integrationBundle = async () => {
      const parts = await Promise.all([
        settle("integrators", () => api("/integrations")),
        settle("keys", () => api("/integrations/keys")),
        settle("connectors", () => api("/integrations/connectors")),
        settle("automations", () => api("/integrations/automations")),
        settle("webhooks", () => api("/integrations/webhooks")),
        settle("events", () => api("/integrations/events?limit=15")),
      ]);
      const [overview, keys, connectors, automations, webhooks, events] = parts;
      if (overview.error) throw overview.error;
      return {
        overview: overview.value,
        keys: keys.value?.rows || [],
        connectors: connectors.value?.rows || [],
        automations: automations.value?.rows || [],
        webhooks: webhooks.value?.rows || [],
        events: events.value?.rows || [],
      };
    };

    try {
      const [space, metrics, leads, clients, tasks, members, channels, agents, activities, projects, integrations, invoices, finance] = await Promise.all([
        settle("الحساب", () => api("/me")),
        settle("الأرقام", () => api("/metrics")),
        settle("الطلبات", () => pick("inquiries.view") ?? api("/inquiries?limit=300")),
        settle("العملاء", () => pick("clients.view") ?? api("/clients")),
        settle("المهام", () => api("/tasks")),
        settle("الفريق", () => api("/members")),
        settle("القنوات", () => api("/channels")),
        settle("الوكلاء", () => pick("agents.manage") ?? api("/agents")),
        settle("النشاط", () => pick("inquiries.view") ?? api("/activities?limit=40")),
        settle("المشاريع", () => pick("projects.view") ?? api("/projects")),
        settle("التكامل", () => pick("integrations.view") ?? integrationBundle()),
        settle("الفواتير", () => pick("finance.view") ?? api("/invoices")),
        settle("المال", () => pick("finance.view") ?? api("/finance")),
      ]);

      const failed = [space, metrics, leads, clients, tasks, members, channels, agents, activities, projects, integrations, invoices, finance]
        .filter((part) => part.error)
        .map((part) => part.label);
      const unauthorised = [space, metrics, leads, clients, tasks, members, channels, agents, activities, projects, integrations, invoices, finance]
        .some((part) => String(part.error?.message) === "unauthorized");
      if (unauthorised) throw new Error("unauthorized");

      watchForNews(prev.leads ? prev.leads.filter((lead) => lead.status === "new").length : 0);
      state.space = space.value ?? prev.space ?? state.space;
      Object.assign(state.data, {
        metrics: metrics.value ?? prev.metrics,
        leads: leads.value?.rows ?? prev.leads,
        clients: clients.value?.rows ?? prev.clients,
        tasks: tasks.value?.rows ?? prev.tasks,
        members: members.value?.rows ?? prev.members,
        channels: channels.value?.rows ?? prev.channels,
        agents: agents.value?.rows ?? prev.agents,
        activities: activities.value?.rows ?? prev.activities,
        projects: projects.value?.rows ?? prev.projects,
        invoices: invoices.value?.rows ?? prev.invoices,
        finance: finance.value ?? prev.finance,
        integrations: integrations.value?.overview
          ? integrations.value
          : prev.integrations || { overview: null, keys: [], connectors: [], automations: [], webhooks: [], events: [] },
      });

      if (failed.length) {
        setSync(`تعذّر التحديث: ${failed.join("، ")}`);
        toast(`تعذّر تحميل: ${failed.join("، ")}`, "bad");
      } else {
        setSync("متصل");
      }
      const clock = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const sub = $("[data-sub]");
      if (sub) sub.textContent = `آخر تحديث ${clock}`;
      render();
    } catch (err) {
      if (String(err.message) === "unauthorized") return;
      setSync("تعذّر الاتصال");
      toast("تعذّر تحميل البيانات", "bad");
    } finally {
      state.loading = false;
    }
  }

  const openLeads = () => state.data.leads.filter((l) => OPEN_STAGES.includes(l.status));
  const pipelineValue = () => openLeads().reduce((sum, l) => sum + Number(l.value || 0), 0);
  const openTasks = () => state.data.tasks.filter((t) => t.status !== "done");

  const leadIsDue = (lead) => {
    const at = asDate(lead.next_action_at);
    return Boolean(at) && at <= new Date();
  };
  const leadsAwaitingReply = () =>
    state.data.leads
      .filter((l) => l.status === "new" || (OPEN_STAGES.includes(l.status) && leadIsDue(l)))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const followUpsDue = () => state.data.leads.filter((l) => OPEN_STAGES.includes(l.status) && leadIsDue(l));
  const staleLeads = () =>
    openLeads().filter((l) => !l.next_action_at && daysBetween(l.updated_at || l.created_at) >= 7);
  const wonLeads = () => state.data.leads.filter((l) => l.status === "won");
  const moneyDue = () => wonLeads().reduce((sum, l) => sum + Number(l.value || 0), 0);

  // Egyptian numbers arrive as 01x…, +201x… or 201x…; wa.me wants the last form.
  const waHref = (phone, text) => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    const intl = digits.startsWith("20") ? digits : digits.startsWith("0") ? `20${digits.slice(1)}` : digits;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  };

  // ── overview ───────────────────────────────────────────────────────

  function attentionBanner() {
    const waiting = leadsAwaitingReply();
    if (!waiting.length) return "";
    const rows = waiting.slice(0, 3);
    return `
      <section class="ops-alert" aria-labelledby="alert-title">
        <div class="ops-alert__head">
          <span class="ops-alert__tag">يحتاج ردك</span>
          <h2 id="alert-title">${num(waiting.length)} ${waiting.length === 1 ? "طلب" : "طلبات"} بلا رد</h2>
          <span class="ops-alert__meta">أقدمها ${esc(ago(waiting[0].created_at))}</span>
        </div>
        <ul class="ops-alert__list">
          ${rows
            .map((l) => {
              const href = waHref(l.phone, `مرحبًا ${l.name}، وصلنا طلبك على Egytronic — تحب نبدأ بإيه؟`);
              const meta = [l.package, l.phone, ago(l.created_at)].filter(Boolean).join(" · ");
              return `
            <li class="ops-alert__row">
              <span class="ops-avatar">${esc(initials(l.name))}</span>
              <span class="ops-alert__who">
                <strong>${esc(l.name)}</strong>
                <span>${esc(meta)}</span>
              </span>
              <span class="ops-alert__actions">
                ${href ? `<a class="ops-btn ops-btn--sm" href="${esc(href)}" target="_blank" rel="noopener">رد واتساب</a>` : ""}
                <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="open-lead" data-id="${l.id}">فتح</button>
                <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="lead-to-task" data-id="${l.id}">مهمة</button>
                <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="lead-contacted" data-id="${l.id}">تم الرد</button>
              </span>
            </li>`;
            })
            .join("")}
        </ul>
      </section>`;
  }

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
    const waiting = leadsAwaitingReply();

    const funnel = STAGES.map(([key, label]) => {
      const rows = state.data.leads.filter((l) => l.status === key);
      const value = rows.reduce((sum, l) => sum + Number(l.value || 0), 0);
      return { key, label, count: rows.length, value };
    });
    const max = Math.max(1, ...funnel.map((f) => f.count));

    const rank = (t) => (isLate(t) ? 0 : isToday(t) ? 1 : !t.due_at ? 2 : 3);
    const agenda = tasks
      .slice()
      .sort((a, b) => rank(a) - rank(b) || String(a.due_at || "").localeCompare(String(b.due_at || "")))
      .slice(0, 6);

    const recent = state.data.activities.slice(0, 8);
    const entityLabel = { inquiry: "طلب", client: "عميل", project: "مشروع", task: "مهمة", member: "عضو", channel: "قناة" };

    return `
      ${attentionBanner()}

      <div class="ops-kpis">
        ${kpi(
          "طلبات بلا رد",
          num(waiting.length),
          waiting.length ? `أقدمها ${ago(waiting[0].created_at)}` : "لا طلبات في الانتظار",
          waiting.length ? "gold" : ""
        )}
        ${kpi(
          "متابعات مستحقة",
          num(followUpsDue().length + staleLeads().length),
          `${num(followUpsDue().length)} بموعد فات · ${num(staleLeads().length)} بقالها أسبوع`,
          followUpsDue().length + staleLeads().length ? "danger" : ""
        )}
        ${kpi(
          "مستحقات",
          m.finance === false ? "—" : egp(moneyDue()),
          m.finance === false ? "غير متاحة لصلاحياتك" : `${num(wonLeads().length)} صفقة مكسوبة`,
          "mint"
        )}
        ${kpi("مهام الفريق", num(tasks.length), `${num(late)} متأخرة · ${num(today)} اليوم`, late ? "danger" : "")}
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
                  <span class="ops-funnel__sum">${num(row.count)} طلب${row.value && m.finance !== false ? " · " + num(row.value) + " ج.م" : ""}</span>
                </button>`
                )
                .join("")}
            </div>
          </div>
        </section>

        <section class="ops-panel" aria-labelledby="agenda-title">
          <div class="ops-panel__head">
            <h2 id="agenda-title">بحاجة إلى إجراء</h2>
            ${focusToday ? `<span class="ops-chip">تركيز اليوم ${num(focusToday)} د</span>` : ""}
            <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="new-task">+ مهمة</button>
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
                : `<p class="ops-empty">لا مهام مفتوحة. أضف واحدة من «+ مهمة» بالأعلى.</p>`
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

  // ── my space ───────────────────────────────────────────────────────

  function renderMe() {
    const space = state.space;
    if (!space) return `<p class="ops-empty">جارٍ التحميل…</p>`;
    const me = space.member || state.me || {};
    const tasks = space.tasks || [];
    const channels = space.channels || [];
    const today = tasks.filter(isToday);
    const late = tasks.filter(isLate);
    const colleagues = state.data.members.filter((m) => m.active && m.id !== me.id);

    return `
      <div class="ops-kpis">
        ${kpi("مهامي المفتوحة", num(tasks.length), `${num(late.length)} متأخرة`, late.length ? "danger" : "")}
        ${kpi("مستحقة اليوم", num(today.length), "تحتاج انتباه اليوم", "gold")}
        ${kpi(
          "رسائل غير مقروءة",
          num(space.unread || 0),
          `${num(channels.filter((c) => Number(c.unread)).length)} محادثة فيها جديد · ${num(channels.length)} إجمالًا`,
          space.unread ? "gold" : ""
        )}
        ${kpi("أنجزت خلال 7 أيام", num(space.done_7d || 0), "من مهامك", "mint")}
      </div>

      <section class="ops-panel">
        <div class="ops-panel__head">
          <h2>مهامي</h2>
          <span class="ops-chip">${esc(ROLES[me.role] || me.role || "")}</span>
          ${me.id ? `<button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="password">كلمة المرور</button>` : ""}
          ${can("settings.manage") ? `<button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="new-access-code">كود دخول جديد</button>` : ""}
          <button class="ops-btn ops-btn--sm" type="button" data-action="new-task">مهمة لنفسي</button>
        </div>
        <div class="ops-panel__body ops-panel__body--flush">
          ${
            tasks.length
              ? `<ul>${tasks
                  .map(
                    (t) => `
                <li class="ops-task" data-done="${t.status === "done"}">
                  <button class="ops-task__check" type="button" role="checkbox" aria-checked="${t.status === "done"}"
                          aria-label="إكمال ${esc(t.title)}" data-action="toggle-task" data-id="${t.id}">${t.status === "done" ? "✓" : ""}</button>
                  <div class="ops-task__body">
                    <button type="button" class="ops-list__title" style="background:none;border:0;padding:0;color:inherit;text-align:start;cursor:pointer;width:100%"
                            data-action="open-task" data-id="${t.id}">${esc(t.title)}</button>
                    <div class="ops-task__meta">
                      <span class="ops-chip">${esc(TASK_LABEL[t.status] || t.status)}</span>
                      ${t.due_at ? `<span class="ops-chip${isLate(t) ? " ops-chip--danger" : ""}">${isLate(t) ? "متأخرة · " : ""}${esc(dateLabel(t.due_at))}</span>` : ""}
                      ${Number(t.priority) === 1 ? '<span class="ops-chip ops-chip--gold">أولوية عالية</span>' : ""}
                    </div>
                  </div>
                </li>`
                  )
                  .join("")}</ul>`
              : `<p class="ops-empty">لا توجد مهام مسندة إليك الآن. افتح «المهام» وخذ واحدة من غير المُسنَد.</p>`
          }
        </div>
      </section>

      <div class="ops-split">
        <section class="ops-panel">
          <div class="ops-panel__head">
            <h2>محادثاتي</h2>
            <span class="ops-chip">${num(channels.length)} محادثة</span>
            ${space.unread ? `<span class="ops-chip ops-chip--gold">${num(space.unread)} جديد</span>` : ""}
          </div>
          <div class="ops-panel__body ops-panel__body--flush">
            ${
              channels.length
                ? `<ul class="ops-list">${channels
                    .map(
                      (c) => `
                  <li class="ops-list__row" data-action="open-channel" data-id="${c.id}">
                    <span class="ops-avatar">${c.kind === "dm" ? "✉" : "#"}</span>
                    <span class="ops-list__main">
                      <span class="ops-list__title">${esc(c.slug)}</span>
                      <span class="ops-list__meta">${esc(c.last_author ? `${c.last_author}: ${c.last_body || ""}`.slice(0, 70) : c.topic || "بدون وصف")}</span>
                    </span>
                    ${Number(c.unread) ? `<span class="ops-chip ops-chip--gold">${num(c.unread)} جديد</span>` : ""}
                    <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="channel-to-task" data-slug="${esc(c.slug)}">مهمة</button>
                  </li>`
                    )
                    .join("")}</ul>`
                : `<p class="ops-empty">لا توجد محادثات بعد.</p>`
            }
          </div>
        </section>

        <section class="ops-panel">
          <div class="ops-panel__head">
            <h2>الفريق</h2>
            ${can("team.manage") ? `<button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="new-member">+ عضو</button>` : ""}
          </div>
          <div class="ops-panel__body ops-panel__body--flush">
            ${
              colleagues.length
                ? `<ul class="ops-list">${colleagues
                    .map(
                      (m) => `
                  <li class="ops-list__row">
                    <span class="ops-avatar">${esc(initials(m.name))}</span>
                    <span class="ops-list__main">
                      <span class="ops-list__title">${esc(m.name)}</span>
                      <span class="ops-list__meta">${esc(ROLES[m.role] || m.role)}${m.focus ? ` · ${esc(m.focus)}` : ""}</span>
                    </span>
                    <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="dm-member" data-id="${m.id}">محادثة</button>
                  </li>`
                    )
                    .join("")}</ul>`
                : `<p class="ops-empty">لا يوجد زملاء مفعّلون بعد.${
                    can("team.manage") ? ' <button class="ops-btn ops-btn--sm" type="button" data-action="new-member">أضف أول عضو</button>' : ""
                  }</p>`
            }
          </div>
        </section>
      </div>`;
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
          ${can("team.manage") ? `<button class="ops-btn ops-btn--sm" type="button" data-action="new-member">عضو جديد</button>` : ""}
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
                          <p class="ops-member__focus">${m.has_password ? `<span class="ops-chip ops-chip--mint">حساب مفعّل</span>` : `<span class="ops-chip">بدون دخول</span>`}</p>
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
                        ${can("team.manage") ? `<button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="member-access" data-id="${m.id}">الصلاحيات</button>` : ""}
                        <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="dm-member" data-id="${m.id}">محادثة</button>
                        ${can("team.manage") ? `<button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="edit-member" data-id="${m.id}">تعديل</button>` : ""}
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
                    ${Number(c.unread) ? `<span class="ops-chip ops-chip--gold">${num(c.unread)} جديد</span>` : `<span class="ops-chip">${num(c.messages)} رسالة</span>`}
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

  // ── integrations & automations ──────────────────────────────────────

  const INT_KINDS = { http: "HTTP", slack: "Slack", discord: "Discord" };
  const INT_TRIGGERS = { cron: "مجدولة", event: "حدث", manual: "يدوي" };
  const INT_STATUS = {
    sent: "تم الإرسال",
    "no-connector": "بلا موصّل",
    paused: "موقوف",
    error: "فشل",
  };
  const intStatusChip = (status) => {
    const tone = status === "sent" ? "mint" : status === "error" || String(status || "").startsWith("http-") ? "danger" : "";
    const label = INT_STATUS[status] || (String(status || "").startsWith("http-") ? `HTTP ${status.slice(5)}` : status || "—");
    return `<span class="ops-chip ${tone ? `ops-chip--${tone}` : ""}">${esc(label)}</span>`;
  };
  const hostOf = (url) => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  };
  const intData = () => state.data.integrations || {};

  function renderIntegrations() {
    const data = intData();
    const overview = data.overview || { counts: {}, runs: [] };
    const counts = overview.counts || {};
    const keys = data.keys || [];
    const connectors = data.connectors || [];
    const automations = data.automations || [];
    const webhooks = data.webhooks || [];
    const events = data.events || [];
    const base = overview.base || location.origin;
    const connectorName = (id) => connectors.find((c) => c.id === id)?.name || "—";
    const canManage = can("integrations.manage");
    const runs = state.integRuns && state.integRuns.length ? state.integRuns : overview.runs || [];

    return `
      <div class="ops-kpis">
        ${kpi("الموصّلات", num(counts.connectors), "وجهات الإرسال", "gold")}
        ${kpi("الأتمتة النشطة", num(counts.automations), `${num(overview.runs?.length || 0)} تشغيل مؤخرًا`, "mint")}
        ${kpi("ويب هوك وارد", num(counts.hooks), "مصادر خارجية تدخل", "")}
        ${kpi("مفاتيح الربط", num(counts.keys), `${num(counts.events)} حدث مسجّل`, "")}
      </div>

      <section class="ops-panel">
        <div class="ops-panel__head">
          <h2>مفاتيح الربط</h2>
          ${canManage ? `<button class="ops-btn ops-btn--sm" type="button" data-action="int-new-key">مفتاح جديد</button>` : ""}
        </div>
        <div class="ops-panel__body ops-panel__body--flush">
          ${
            keys.length
              ? `<ul class="ops-list">${keys
                  .map(
                    (key) => `
                <li class="ops-list__row">
                  <span class="ops-list__main">
                    <span class="ops-list__title">${esc(key.name)}</span>
                    <span class="ops-list__meta" dir="ltr">${esc(key.scopes)}${key.last_used_at ? ` · ${esc(ago(key.last_used_at))}` : " · لم يُستخدم"}</span>
                  </span>
                  <span class="ops-chip ${key.active ? "ops-chip--mint" : ""}">${key.active ? "نشط" : "موقوف"}</span>
                  ${
                    canManage
                      ? `<button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="int-key-toggle" data-id="${key.id}" data-on="${key.active ? 1 : 0}">${key.active ? "إيقاف" : "تنشيط"}</button>
                         <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="int-key-delete" data-id="${key.id}">حذف</button>`
                      : ""
                  }
                </li>`
                  )
                  .join("")}</ul>`
              : `<p class="ops-empty">لا توجد مفاتيح. المفتاح يسمح لأي نظام خارجي بإطلاق أحداث أو تشغيل أتمتة.</p>`
          }
        </div>
      </section>

      <div class="ops-int__grid">
        <section class="ops-panel">
          <div class="ops-panel__head">
            <h2>الموصّلات</h2>
            ${canManage ? `<button class="ops-btn ops-btn--sm" type="button" data-action="int-new-connector">موصّل جديد</button>` : ""}
          </div>
          <div class="ops-panel__body ops-panel__body--flush">
            ${
              connectors.length
                ? `<ul class="ops-list">${connectors
                    .map(
                      (c) => `
                  <li class="ops-list__row">
                    <span class="ops-list__main">
                      <span class="ops-list__title">${esc(c.name)} <span class="ops-chip">${esc(INT_KINDS[c.kind] || c.kind)}</span></span>
                      <span class="ops-list__meta" dir="ltr">${esc(hostOf(c.url))}${c.has_secret ? " · 🔑" : ""}</span>
                    </span>
                    ${c.last_status ? intStatusChip(String(c.last_status)) : ""}
                    ${
                      canManage
                        ? `<button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="int-connector-test" data-id="${c.id}">اختبار</button>
                           <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="int-connector-delete" data-id="${c.id}">حذف</button>`
                        : ""
                    }
                  </li>`
                    )
                    .join("")}</ul>`
                : `<p class="ops-empty">اربط Slack أو Discord أو أي خدمة بتستقبل JSON.</p>`
            }
          </div>
        </section>

        <section class="ops-panel">
          <div class="ops-panel__head">
            <h2>الأتمتة</h2>
            ${canManage ? `<button class="ops-btn ops-btn--sm" type="button" data-action="int-new-automation">أتمتة جديدة</button>` : ""}
          </div>
          <div class="ops-panel__body ops-panel__body--flush">
            ${
              automations.length
                ? `<ul class="ops-list">${automations
                    .map(
                      (a) => `
                  <li class="ops-list__row" style="flex-wrap:wrap">
                    <span class="ops-list__main">
                      <span class="ops-list__title">${esc(a.name)} <span class="ops-chip">${esc(INT_TRIGGERS[a.trigger_type] || a.trigger_type)}</span></span>
                      <span class="ops-list__meta">${
                        a.trigger_type === "cron"
                          ? `<span dir="ltr">${esc(a.schedule || "")}</span>${a.next_run_at ? ` · التالي <span dir="ltr">${esc(String(a.next_run_at).slice(11, 16))} UTC</span>` : ""}`
                          : a.trigger_type === "event"
                            ? `<span dir="ltr">${esc(a.event_key || "")}</span>`
                            : "تشغيل يدوي فقط"
                      } · ${esc(connectorName(a.connector_id))} · ${num(a.runs)} تشغيل</span>
                    </span>
                    ${a.last_status ? intStatusChip(a.last_status) : ""}
                    <span class="ops-int__actions">
                      <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="int-automation-run" data-id="${a.id}">تشغيل</button>
                      <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="int-automation-runs" data-id="${a.id}">السجل</button>
                      ${canManage ? `<button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="int-automation-toggle" data-id="${a.id}" data-on="${a.enabled ? 1 : 0}">${a.enabled ? "إيقاف" : "تنشيط"}</button>
                      <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="int-automation-delete" data-id="${a.id}">حذف</button>` : ""}
                    </span>
                  </li>`
                    )
                    .join("")}</ul>`
                : `<p class="ops-empty">لا توجد أتمتة. اختر حدثًا أو موعدًا وموصّلًا ونص الرسالة.</p>`
            }
          </div>
        </section>

        <section class="ops-panel">
          <div class="ops-panel__head">
            <h2>ويب هوك وارد</h2>
            ${canManage ? `<button class="ops-btn ops-btn--sm" type="button" data-action="int-new-webhook">مصدر جديد</button>` : ""}
          </div>
          <div class="ops-panel__body ops-panel__body--flush">
            ${
              webhooks.length
                ? `<ul class="ops-list">${webhooks
                    .map(
                      (w) => `
                  <li class="ops-list__row" style="flex-wrap:wrap">
                    <span class="ops-list__main">
                      <span class="ops-list__title">${esc(w.name)}</span>
                      <span class="ops-list__meta" dir="ltr">${esc(base)}/hooks/${esc(w.slug)}</span>
                    </span>
                    <span class="ops-chip ${w.active ? "ops-chip--mint" : ""}">${num(w.deliveries)} استقبال</span>
                    <span class="ops-int__actions">
                      <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="int-webhook-deliveries" data-id="${w.id}">السجل</button>
                      ${
                        canManage
                          ? `<button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="int-webhook-rotate" data-id="${w.id}">مفتاح جديد</button>
                             <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="int-webhook-toggle" data-id="${w.id}" data-on="${w.active ? 1 : 0}">${w.active ? "إيقاف" : "تنشيط"}</button>
                             <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="int-webhook-delete" data-id="${w.id}">حذف</button>`
                          : ""
                      }
                    </span>
                  </li>`
                    )
                    .join("")}</ul>`
                : `<p class="ops-empty">افتح رابطًا موقّعًا يستقبل أحداث أي خدمة خارجية.</p>`
            }
          </div>
        </section>

        <section class="ops-panel">
          <div class="ops-panel__head"><h2>آخر التشغيلات</h2></div>
          <div class="ops-panel__body ops-panel__body--flush">
            ${
              runs.length
                ? `<ul class="ops-list">${runs
                    .map(
                      (r) => `
                  <li class="ops-list__row">
                    <span class="ops-list__main">
                      <span class="ops-list__title">${esc(r.name || "أتمتة محذوفة")}</span>
                      <span class="ops-list__meta">${esc(INT_TRIGGERS[String(r.trigger || "").split(":")[0]] || r.trigger || "")} · ${esc(r.detail || "")}</span>
                    </span>
                    ${intStatusChip(r.status)}
                    <span class="ops-list__meta">${esc(ago(r.created_at))}</span>
                  </li>`
                    )
                    .join("")}</ul>`
                : `<p class="ops-empty">مفيش تشغيل لسه.</p>`
            }
          </div>
        </section>
      </div>

      <section class="ops-panel">
        <div class="ops-panel__head"><h2>آخر الأحداث</h2><a class="ops-btn ops-btn--ghost ops-btn--sm" href="/api/v1/openapi.json" target="_blank" rel="noreferrer">مواصفات API</a></div>
        <div class="ops-panel__body ops-panel__body--flush">
          ${
            events.length
              ? `<ul class="ops-list">${events
                  .map(
                    (e) => `
                <li class="ops-list__row">
                  <span class="ops-list__main">
                    <span class="ops-list__title" dir="ltr">${esc(e.kind)}</span>
                    <span class="ops-list__meta">${esc(e.entity || "")}${e.entity_id ? ` #${e.entity_id}` : ""} · ${esc(e.actor || "")}</span>
                  </span>
                  <span class="ops-list__meta">${esc(ago(e.created_at))}</span>
                </li>`
                  )
                  .join("")}</ul>`
              : `<p class="ops-empty">لا توجد أحداث بعد.</p>`
          }
        </div>
      </section>

      <section class="ops-panel">
        <div class="ops-panel__head"><h2>طريقة الربط</h2></div>
        <div class="ops-panel__body ops-int__guide">
          <p>أي نظام خارجي يبعت حدثًا بمفتاح الربط، وأي أتمتة مشتركة على الحدث بتوصله للموصّل اللي تختاره.</p>
          <pre class="ops-int__code" dir="ltr">curl -X POST ${esc(base)}/api/v1/events \\
  -H "authorization: Bearer egx_int_..." \\
  -H "content-type: application/json" \\
  -d '{"kind":"invoice.paid","payload":{"id":"INV-77","amount":4200}}'</pre>
          <p>وللخدمات اللي بتبعت ويب هوك: وقّع الجسم بـ HMAC-SHA256 بالمفتاح السري وأرسله في <code>X-Egytronic-Signature: sha256=…</code> إلى رابط المصدر.</p>
          <pre class="ops-int__code" dir="ltr">curl -X POST ${esc(base)}/api/integrations/tick \\
  -H "authorization: Bearer egx_int_..."</pre>
          <p>الـ Pages مالهاش جدولة داخلية، فشغّل <code>tick</code> من أي كرون خارجي (Cloudflare Worker أو GitHub Actions) كل دقيقة، وهو بيشغّل الأتمتة المستحقة مرة واحدة.</p>
        </div>
      </section>`;
  }

  function dialogInfo(title, html) {
    openDialog({ title, body: html, onSubmit: null, submit: "إغلاق" });
  }

  const dialogIntegrationKey = () =>
    openDialog({
      title: "مفتاح ربط جديد",
      body: `
        <label class="ops-field"><span>الاسم</span><input class="ops-input" name="name" required placeholder="Make / Zapier / نظام المحاسبة"></label>
        <fieldset class="ops-int__scopes">
          <legend>الصلاحيات</legend>
          <label class="ops-check"><input type="checkbox" name="scope" value="events:write" checked> إطلاق أحداث</label>
          <label class="ops-check"><input type="checkbox" name="scope" value="events:read"> قراءة الأحداث</label>
          <label class="ops-check"><input type="checkbox" name="scope" value="automations:run"> تشغيل الأتمتة</label>
        </fieldset>`,
      submit: "إنشاء",
      onSubmit: async (fd) => {
        const scopes = fd.getAll("scope");
        const res = await api("/integrations/keys", { method: "POST", body: { name: fd.get("name"), scopes: scopes.join(",") } });
        await loadAll();
        dialogInfo(
          "المفتاح جاهز",
          `<p class="ops-int__note">انسخه الآن — لن يظهر مرة أخرى.</p>
           <pre class="ops-int__code" dir="ltr">${esc(res.row.key)}</pre>`
        );
        return { keepOpen: true };
      },
    });

  const dialogConnector = () =>
    openDialog({
      title: "موصّل جديد",
      body: `
        <div class="ops-row">
          <label class="ops-field"><span>الاسم</span><input class="ops-input" name="name" required placeholder="Slack فريق البيع"></label>
          <label class="ops-field"><span>النوع</span>
            <select class="ops-select" name="kind">
              <option value="slack">Slack</option>
              <option value="discord">Discord</option>
              <option value="http">HTTP / نظام خاص</option>
            </select>
          </label>
        </div>
        <label class="ops-field"><span>الرابط</span><input class="ops-input" name="url" required dir="ltr" placeholder="https://hooks.slack.com/services/…"></label>
        <label class="ops-field"><span>التوكن (اختياري)</span><input class="ops-input" name="secret" dir="ltr" placeholder="يُرسل كـ Authorization: Bearer"></label>`,
      submit: "إضافة",
      onSubmit: async (fd) => {
        await api("/integrations/connectors", {
          method: "POST",
          body: { name: fd.get("name"), kind: fd.get("kind"), url: fd.get("url"), secret: fd.get("secret") },
        });
        toast("تمت إضافة الموصّل.", "ok");
        await loadAll();
      },
    });

  const dialogAutomation = () => {
    const connectors = intData().connectors || [];
    return openDialog({
      title: "أتمتة جديدة",
      body: `
        <label class="ops-field"><span>الاسم</span><input class="ops-input" name="name" required placeholder="إشعار ليد جديد"></label>
        <div class="ops-row">
          <label class="ops-field"><span>المشغّل</span>
            <select class="ops-select" name="trigger_type" data-int-trigger>
              <option value="event">حدث</option>
              <option value="cron">موعد مجدول</option>
              <option value="manual">يدوي</option>
            </select>
          </label>
          <label class="ops-field"><span>الموصّل</span>
            <select class="ops-select" name="connector_id">
              ${connectors.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}
            </select>
          </label>
        </div>
        <label class="ops-field"><span>مفتاح الحدث</span><input class="ops-input" name="event_key" dir="ltr" value="inquiry.*" placeholder="inquiry.created / order.* / *"></label>
        <label class="ops-field"><span>الجدول (cron)</span><input class="ops-input" name="schedule" dir="ltr" placeholder="0 9 * * *" hidden></label>
        <label class="ops-field"><span>نص الرسالة</span><textarea class="ops-textarea" name="template" rows="3" dir="auto">ليد جديد: {{payload.name}} — {{payload.package}}</textarea></label>
        <p class="ops-int__note">المتغيّرات: <code>{{event.kind}}</code> · <code>{{payload.amount}}</code> · <code>{{json payload}}</code> · <code>{{now}}</code></p>`,
      submit: "إنشاء",
      onSubmit: async (fd) => {
        await api("/integrations/automations", {
          method: "POST",
          body: {
            name: fd.get("name"),
            trigger_type: fd.get("trigger_type"),
            event_key: fd.get("event_key"),
            schedule: fd.get("schedule"),
            connector_id: fd.get("connector_id"),
            template: fd.get("template"),
          },
        });
        toast("تم إنشاء الأتمتة.", "ok");
        await loadAll();
      },
    });
  };

  const dialogWebhook = () =>
    openDialog({
      title: "مصدر ويب هوك",
      body: `
        <label class="ops-field"><span>الاسم</span><input class="ops-input" name="name" required placeholder="متجر Shopify"></label>
        <label class="ops-field"><span>المعرّف في الرابط</span><input class="ops-input" name="slug" dir="ltr" placeholder="shopify-orders"></label>`,
      submit: "إنشاء",
      onSubmit: async (fd) => {
        const res = await api("/integrations/webhooks", {
          method: "POST",
          body: { name: fd.get("name"), slug: fd.get("slug") },
        });
        await loadAll();
        dialogInfo(
          "المصدر جاهز",
          `<p class="ops-int__note">انسخ الرابط والمفتاح الآن — المفتاح لن يظهر مرة أخرى.</p>
           <pre class="ops-int__code" dir="ltr">${esc(res.url)}\n\n${esc(res.secret)}</pre>`
        );
        return { keepOpen: true };
      },
    });

  // ── code: GitHub repositories ───────────────────────────────────────

  const CODE_ERRORS = {
    "no-token": "لسه مفيش توكن GitHub. اضغط «ربط GitHub» وحط التوكن.",
    "bad-token": "التوكن مرفوض من GitHub. اعمل واحد جديد بصلاحية repo.",
    "rate-limit": "GitHub حدّد عدد الطلبات دلوقتي. جرّب بعد شوية.",
    "not-found": "الحاجة دي مش موجودة على GitHub (أو التوكن مالوش صلاحية عليها).",
    conflict: "الملف اتغيّر من حد تاني. حدّث الصفحة وجرب تاني.",
    forbidden: "الصلاحية دي مش متاحة لك.",
    binary: "الملف ده مش نص، فمش هيتفتح هنا.",
    "too-big": "الملف أكبر من إنه يتفتح في اللوحة.",
    "bad-path": "اكتب مسار ملف صحيح.",
    "token-shape": "ده مش شكل توكن GitHub صحيح.",
  };
  const codeMessage = (err) => CODE_ERRORS[String(err?.message || err)] || "تعذّر تنفيذ الطلب على GitHub.";
  const fileSize = (bytes) => (bytes >= 1024 ? `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)}KB` : `${bytes || 0}B`);

  const codeState = () =>
    (state.code ||= {
      status: null,
      repos: [],
      owner: "",
      query: "",
      loading: false,
      repo: null,
      branches: [],
      ref: "",
      path: "",
      tree: [],
      commits: [],
      tab: "files",
      file: null,
      saving: false,
    });

  async function codeLoadStatus() {
    const c = codeState();
    c.status = await api("/code/status").catch((err) => ({ ok: false, configured: false, error: err.message }));
    return c.status;
  }

  async function codeLoadRepos() {
    const c = codeState();
    c.loading = true;
    try {
      const data = await api("/code/repos");
      c.repos = data.rows || [];
      c.owner = data.owner || "";
    } finally {
      c.loading = false;
    }
  }

  async function codeRefreshRepo() {
    const c = codeState();
    if (!c.repo) return;
    const data = await api(`/code/repo?id=${encodeURIComponent(c.repo.full_name)}`);
    applyRepo(data);
  }

  function applyRepo(data) {
    const c = codeState();
    const previousRef = c.ref;
    c.repo = data.repo;
    c.branches = data.branches?.length ? data.branches : [data.repo.default_branch];
    c.ref = c.branches.includes(previousRef) ? previousRef : data.repo.default_branch;
    c.commits = data.commits || [];
  }

  async function codeOpenRepo(full) {
    const c = codeState();
    c.loading = true;
    c.repo = { full_name: full };
    c.file = null;
    c.path = "";
    c.tree = [];
    c.ref = "";
    render();
    try {
      const data = await api(`/code/repo?id=${encodeURIComponent(full)}`);
      applyRepo(data);
      await codeLoadTree("");
    } catch (err) {
      toast(codeMessage(err), "bad");
      c.repo = null;
    } finally {
      c.loading = false;
      render();
    }
  }

  async function codeLoadTree(path) {
    const c = codeState();
    if (!c.repo) return;
    const data = await api(
      `/code/tree?id=${encodeURIComponent(c.repo.full_name)}&ref=${encodeURIComponent(c.ref)}&path=${encodeURIComponent(path || "")}`
    );
    c.path = data.path || "";
    c.tree = data.rows || [];
  }

  async function codeOpenFile(path) {
    const c = codeState();
    if (!c.repo) return;
    try {
      const data = await api(
        `/code/file?id=${encodeURIComponent(c.repo.full_name)}&ref=${encodeURIComponent(c.ref)}&path=${encodeURIComponent(path)}`
      );
      c.file = { ...data, dirty: false, isNew: false };
      render();
      $("[data-code-editor]")?.focus();
    } catch (err) {
      toast(codeMessage(err), "bad");
    }
  }

  async function codeSwitchBranch(ref) {
    const c = codeState();
    c.ref = ref;
    c.file = null;
    try {
      await codeLoadTree("");
      await codeRefreshRepo();
    } catch (err) {
      toast(codeMessage(err), "bad");
    }
    render();
  }

  async function codeSave() {
    const c = codeState();
    if (!c.file || !c.repo) return;
    const message = String($("[data-code-message]")?.value || "").trim();
    const content = $("[data-code-editor]")?.value ?? "";
    if (!message) return toast("اكتب رسالة الكوميت الأول.", "warn");
    c.saving = true;
    render();
    try {
      const data = await api("/code/file", {
        method: "PUT",
        body: { id: c.repo.full_name, path: c.file.path, content, message, branch: c.ref },
      });
      toast(`تم الكوميت ${data.commit.short} على ${c.ref}.`, "ok");
      c.file = { ...c.file, content, isNew: false };
      await codeRefreshRepo();
      await codeLoadTree(c.path);
    } catch (err) {
      toast(codeMessage(err), "bad");
    } finally {
      c.saving = false;
      render();
    }
  }

  async function codeDeleteFile(path) {
    const c = codeState();
    if (!c.repo) return;
    const target = path || c.file?.path;
    if (!target) return;
    if (!window.confirm(`حذف ${target} من ${c.repo.full_name}؟ الحذف كوميت حقيقي على GitHub.`)) return;
    const message = String($("[data-code-message]")?.value || "").trim() || `حذف ${target}`;
    try {
      await api(
        `/code/file?id=${encodeURIComponent(c.repo.full_name)}&ref=${encodeURIComponent(c.ref)}&path=${encodeURIComponent(target)}&message=${encodeURIComponent(message)}`,
        { method: "DELETE" }
      );
      toast("اتحذف الملف واتسجل كوميت.", "ok");
      if (c.file?.path === target) c.file = null;
      await codeRefreshRepo();
      await codeLoadTree(c.path);
    } catch (err) {
      toast(codeMessage(err), "bad");
    }
    render();
  }

  async function codeOpenCommit(sha) {
    const c = codeState();
    if (!c.repo) return;
    try {
      const data = await api(`/code/commit?id=${encodeURIComponent(c.repo.full_name)}&sha=${encodeURIComponent(sha)}`);
      const files = (data.files || [])
        .map(
          (file) => `
          <article class="ops-code__diff">
            <header>
              <span class="ops-code__path">${esc(file.path)}</span>
              <span class="ops-chip">${esc(file.status)}</span>
              <span class="ops-code__stat ops-code__stat--add">+${num(file.additions)}</span>
              <span class="ops-code__stat ops-code__stat--del">−${num(file.deletions)}</span>
            </header>
            ${file.patch ? `<pre class="ops-diff">${diffHtml(file.patch)}</pre>` : `<p class="ops-empty">تغيير كبير أو ملف ثنائي، من غير diff نصي.</p>`}
          </article>`
        )
        .join("");
      openDialog({
        title: `${data.short} · ${String(data.message).split("\n")[0].slice(0, 70)}`,
        body: `
          <p class="ops-code__meta">
            ${esc(data.author)} · ${esc(ago(data.date))} · +${num(data.stats.additions)} −${num(data.stats.deletions)}
            · <a href="${esc(data.html_url)}" target="_blank" rel="noopener">على GitHub</a>
          </p>
          ${files || `<p class="ops-empty">الكوميت ده من غير ملفات معدّلة.</p>`}`,
        submit: "تمام",
        onSubmit: async () => ({}),
      });
    } catch (err) {
      toast(codeMessage(err), "bad");
    }
  }

  function diffHtml(patch) {
    return String(patch)
      .split("\n")
      .map((line) => {
        const safe = esc(line);
        if (line.startsWith("+++") || line.startsWith("---")) return `<span class="ops-diff__meta">${safe}</span>`;
        if (line.startsWith("@@")) return `<span class="ops-diff__hunk">${safe}</span>`;
        if (line.startsWith("+")) return `<span class="ops-diff__add">${safe}</span>`;
        if (line.startsWith("-")) return `<span class="ops-diff__del">${safe}</span>`;
        return `<span>${safe}</span>`;
      })
      .join("\n");
  }

  function dialogCodeFile() {
    const c = codeState();
    if (!c.repo) return;
    openDialog({
      title: `ملف جديد في ${c.repo.full_name}`,
      body: `
        <label class="ops-field"><span>المسار</span>
          <input name="path" dir="ltr" placeholder="src/components/hero.tsx" autocomplete="off" required>
        </label>
        <p class="ops-field__hint">المجلدات تتعمل لوحدها. الملف بيتعمل على الفرع ${esc(c.ref)}.</p>`,
      submit: "إنشاء",
      onSubmit: async (fd) => {
        const path = String(fd.get("path") || "").trim().replace(/^\/+/, "");
        if (!path) {
          toast("اكتب مسار الملف.", "warn");
          return { keepOpen: true };
        }
        c.file = { path, content: "", dirty: true, isNew: true };
        c.tab = "files";
        render();
        return {};
      },
    });
  }

  function dialogCodeToken() {
    const c = codeState();
    const status = c.status || {};
    const fromEnv = status.source === "env";
    openDialog({
      title: "ربط GitHub",
      body: `
        <p class="ops-field__hint">
          الكود مش بيتخزن عندنا خالص؛ اللوحة بتحادث GitHub بالتوكن ده بس.
          الأفضل تحطه في Cloudflare كـ secret اسمه <code>GITHUB_TOKEN</code>،
          والسطر اللي تحت للتجربة السريعة أو لو مش قادر تلمس إعدادات المشروع.
        </p>
        ${
          fromEnv
            ? `<p class="ops-chip ops-chip--mint">التوكن مقروء من إعدادات المشروع ومش محتاج يتكتب هنا.</p>`
            : `
        <label class="ops-field"><span>التوكن (fine-grained، قراءة وكتابة Contents + قراءة Metadata)</span>
          <input name="token" type="password" dir="ltr" placeholder="github_pat_…" autocomplete="off">
        </label>`
        }
        <label class="ops-field"><span>الحساب أو المؤسسة (اختياري — يحدد المستودعات المعروضة)</span>
          <input name="owner" dir="ltr" value="${esc(status.owner || "")}" placeholder="yk445kauod-coder" autocomplete="off">
        </label>
        ${status.login ? `<p class="ops-field__hint">متصل حاليًا كـ <b dir="ltr">${esc(status.login)}</b>.</p>` : ""}`,
      submit: "حفظ",
      onSubmit: async (fd) => {
        try {
          await api("/code/token", {
            method: "POST",
            body: { token: String(fd.get("token") || "").trim(), owner: String(fd.get("owner") || "").trim() },
          });
          await codeLoadStatus();
          await codeLoadRepos();
          toast("اتربط بـ GitHub.", "ok");
          render();
          return {};
        } catch (err) {
          toast(codeMessage(err), "bad");
          return { keepOpen: true };
        }
      },
    });
  }

  function codeCrumbs() {
    const c = codeState();
    if (!c.repo) return "";
    const parts = c.path ? c.path.split("/") : [];
    const trail = parts
      .map((part, index) => {
        const path = parts.slice(0, index + 1).join("/");
        return `<span aria-hidden="true">/</span><button class="ops-code__crumb" type="button" data-action="code-dir" data-path="${esc(path)}">${esc(part)}</button>`;
      })
      .join("");
    return `
      <nav class="ops-code__crumbs" aria-label="مسار المجلد">
        <button class="ops-code__crumb" type="button" data-action="code-dir" data-path="">${esc(c.repo.name)}</button>
        ${trail}
      </nav>`;
  }

  function renderCodeRepoList() {
    const c = codeState();
    const rows = c.repos.filter((repo) => !c.query || repo.full_name.toLowerCase().includes(c.query.toLowerCase()));
    return `
      <section class="ops-panel ops-code__repos">
        <div class="ops-panel__head">
          <h2>المستودعات</h2>
          ${can("settings.manage") ? `<button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="code-token">ربط</button>` : ""}
          <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="code-refresh">تحديث</button>
        </div>
        <div class="ops-panel__body ops-panel__body--flush">
          <div class="ops-code__search">
            <input class="ops-input" data-code-search value="${esc(c.query)}" placeholder="ابحث في ${num(c.repos.length)} مستودع…" aria-label="بحث في المستودعات">
          </div>
          ${
            c.loading && !c.repos.length
              ? `<p class="ops-empty">جارٍ تحميل المستودعات…</p>`
              : rows.length
                ? `<ul class="ops-list">${rows
                    .map(
                      (repo) => `
                    <li>
                      <button class="ops-list__row" type="button" data-action="code-open-repo" data-id="${esc(repo.full_name)}"${c.repo?.full_name === repo.full_name ? ' aria-current="true"' : ""}>
                        <span class="ops-list__main">
                          <span class="ops-list__title" dir="ltr">${esc(repo.name)}</span>
                          <span class="ops-list__meta" dir="ltr">${esc(repo.owner)} · ${esc(repo.language || "—")} · ${esc(repo.pushed_at ? ago(repo.pushed_at) : "")}</span>
                        </span>
                        <span class="ops-chip ${repo.private ? "" : "ops-chip--mint"}">${repo.private ? "خاص" : "عام"}</span>
                      </button>
                    </li>`
                    )
                    .join("")}</ul>`
                : `<p class="ops-empty">${c.repos.length ? "مفيش مستودع بالاسم ده." : "مفيش مستودعات ظاهرة للحساب ده."}</p>`
          }
        </div>
      </section>`;
  }

  function renderCodeExplorer() {
    const c = codeState();
    if (!c.repo) {
      return `
        <section class="ops-panel ops-code__empty">
          <div class="ops-empty">
            <p>اختار مستودع من الشمال، وهتلاقي ملفاته وكوميتاته هنا.</p>
            <p class="ops-field__hint">مفيش أي كود متخزّن عندنا — كل حاجة بتتقرا من GitHub وقت الطلب.</p>
          </div>
        </section>`;
    }
    const repo = c.repo;
    const tabs = `
      <div class="ops-code__tabs" role="group" aria-label="عرض المستودع">
        <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="code-tab" data-tab="files" aria-pressed="${c.tab === "files"}">الملفات</button>
        <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="code-tab" data-tab="commits" aria-pressed="${c.tab === "commits"}">الكوميتات</button>
      </div>`;

    const head = `
      <div class="ops-panel__head ops-code__head">
        <div class="ops-code__title">
          <h2 dir="ltr">${esc(repo.full_name)}</h2>
          <p>${esc(repo.description || "من غير وصف")}${repo.stars ? ` · ★ ${num(repo.stars)}` : ""}</p>
        </div>
        <label class="ops-code__branch">
          <span class="sr-only">الفرع</span>
          <select class="ops-input" data-code-branch aria-label="الفرع">
            ${c.branches.map((branch) => `<option value="${esc(branch)}"${branch === c.ref ? " selected" : ""}>${esc(branch)}</option>`).join("")}
          </select>
        </label>
        <a class="ops-btn ops-btn--ghost ops-btn--sm" href="${esc(repo.html_url)}" target="_blank" rel="noopener">فتح على GitHub</a>
      </div>`;

    const filesView = `
      ${codeCrumbs()}
      <div class="ops-panel__body ops-panel__body--flush">
        ${
          c.tree.length
            ? `<ul class="ops-list">${c.tree
                .map(
                  (row) => `
              <li>
                <button class="ops-list__row" type="button" data-action="${row.type === "dir" ? "code-dir" : "code-file"}" data-path="${esc(row.path)}">
                  <span class="ops-code__icon">${row.type === "dir" ? "▸" : "·"}</span>
                  <span class="ops-list__main">
                    <span class="ops-list__title ops-code__path">${esc(row.name)}${row.type === "dir" ? "/" : ""}</span>
                  </span>
                  ${row.type === "file" ? `<span class="ops-code__size">${fileSize(row.size)}</span>` : ""}
                </button>
              </li>`
                )
                .join("")}</ul>`
            : `<p class="ops-empty">المجلد فاضي.</p>`
        }
      </div>
      <footer class="ops-code__foot">
        ${
          can("code.manage")
            ? `<button class="ops-btn ops-btn--sm" type="button" data-action="code-new-file">ملف جديد</button>`
            : `<span class="ops-field__hint">عرض فقط — التعديل محتاج صلاحية تعديل الكود.</span>`
        }
      </footer>`;

    const commitsView = `
      <div class="ops-panel__body ops-panel__body--flush">
        ${
          c.commits.length
            ? `<ul class="ops-list">${c.commits
                .map(
                  (commit) => `
              <li>
                <button class="ops-list__row" type="button" data-action="code-commit" data-sha="${esc(commit.sha)}">
                  <span class="ops-list__main">
                    <span class="ops-list__title">${esc(commit.message)}</span>
                    <span class="ops-list__meta">${esc(commit.author)} · ${esc(ago(commit.date))}</span>
                  </span>
                  <span class="ops-code__sha" dir="ltr">${esc(commit.short)}</span>
                </button>
              </li>`
                )
                .join("")}</ul>`
            : `<p class="ops-empty">مفيش كوميتات على الفرع ده.</p>`
        }
      </div>`;

    return `
      <section class="ops-panel ops-code__explorer">
        ${head}
        ${tabs}
        ${c.tab === "files" ? filesView : commitsView}
      </section>`;
  }

  function renderCodeEditor() {
    const c = codeState();
    if (!c.file || !c.repo) return "";
    const editable = can("code.manage");
    const lines = String(c.file.content || "").split("\n").length;
    return `
      <section class="ops-panel ops-code__editor-panel">
        <div class="ops-panel__head">
          <div class="ops-code__title">
            <h2 class="ops-code__path" dir="ltr">${esc(c.file.path)}</h2>
            <p>${num(lines)} سطر · ${esc(c.ref)}${c.file.isNew ? " · ملف جديد" : ""}</p>
          </div>
          <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="code-close-file">إغلاق</button>
        </div>
        <div class="ops-panel__body">
          <textarea class="ops-code__editor" data-code-editor dir="ltr" spellcheck="false" aria-label="${esc(c.file.path)}"${editable ? "" : " readonly"}>${esc(c.file.content || "")}</textarea>
          ${
            editable
              ? `<div class="ops-code__commit-bar">
            <input class="ops-input" data-code-message placeholder="رسالة الكوميت: إيه اللي اتغير؟" maxlength="180" aria-label="رسالة الكوميت">
            <button class="ops-btn" type="button" data-action="code-save"${c.saving ? " disabled" : ""}>${c.saving ? "بيتحفظ…" : "كوميت"}</button>
            <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="code-delete" data-path="${esc(c.file.path)}"${c.file.isNew ? " hidden" : ""}>حذف</button>
          </div>`
              : ""
          }
        </div>
      </section>`;
  }

  let codeBooted = false;
  async function codeBootstrap() {
    if (codeBooted) return;
    codeBooted = true;
    try {
      const status = await codeLoadStatus();
      if (status.configured) await codeLoadRepos();
    } catch (err) {
      toast(codeMessage(err), "bad");
    }
    if (state.view === "code") render();
  }

  function renderCode() {
    const c = codeState();
    if (!c.status) {
      codeBootstrap();
      return `<p class="ops-empty">جارٍ الاتصال بـ GitHub…</p>`;
    }
    if (!c.status.configured) {
      return `
        <section class="ops-panel">
          <div class="ops-panel__head"><h2>GitHub</h2></div>
          <div class="ops-panel__body">
            <p class="ops-empty">لسه مفيش توكن مربوط، فمفيش مستودعات تتعرض.</p>
            <p class="ops-field__hint">
              اعمل fine-grained token على GitHub بصلاحية قراءة وكتابة Contents وقراءة Metadata،
              وبعدها اربطه هنا. الكود نفسه مش بيتخزن عندنا — كل قراءة وكتابة بتروح لـ GitHub مباشرة.
            </p>
            ${
              can("settings.manage")
                ? `<button class="ops-btn" type="button" data-action="code-token">ربط GitHub</button>`
                : `<p class="ops-field__hint">محتاج المالك يربط التوكن الأول.</p>`
            }
          </div>
        </section>`;
    }
    return `
      <div class="ops-code">
        ${renderCodeRepoList()}
        ${renderCodeExplorer()}
      </div>
      ${renderCodeEditor()}`;
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

        <div>
          <p style="font-size:12px;color:var(--fg-dim);margin-bottom:8px">المال</p>
          ${(() => {
            const mine = (state.data.invoices || []).filter((inv) => inv.client_id === client.id);
            if (!mine.length) return `<p class="ops-empty" style="border:1px solid var(--rule)">مفيش فواتير على العميل ده.</p>`;
            const billed = mine.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
            const paid = mine.reduce((sum, inv) => sum + Number(inv.paid || 0), 0);
            return `
              <div class="ops-money-card">
                <div><span>مفوتر</span><strong>${egp(billed)}</strong></div>
                <div><span>مدفوع</span><strong class="is-mint">${egp(paid)}</strong></div>
                <div><span>باقي</span><strong class="${billed - paid ? "is-gold" : "is-mint"}">${egp(Math.max(0, billed - paid))}</strong></div>
              </div>
              <ul class="ops-list" style="border:1px solid var(--rule);margin-top:8px">${mine
                .map(
                  (inv) => `<li class="ops-list__row" data-action="open-invoice" data-id="${inv.id}">
                    <span class="ops-list__main">
                      <span class="ops-list__title">${esc(inv.number)} · ${esc(inv.title || "فاتورة")}</span>
                      <span class="ops-list__meta">${egp(inv.total)} · ${esc(INVOICE_STATUS_LABEL[inv.status] || inv.status)}</span>
                    </span>
                  </li>`
                )
                .join("")}</ul>`;
          })()}
          <button class="ops-btn ops-btn--ghost ops-btn--sm" type="button" data-action="new-invoice" style="margin-top:8px">فاتورة للعميل</button>
        </div>

        ${activityForm("client", client.id)}

        <div>
          <p style="font-size:12px;color:var(--fg-dim);margin-bottom:8px">السجل</p>
          ${timeline(acts)}
        </div>
      </div>
      <div class="ops-drawer__foot">
        ${client.phone ? `<a class="ops-btn ops-btn--ghost" href="https://wa.me/${esc(String(client.phone).replace(/[^0-9]/g, ""))}" target="_blank" rel="noopener">واتساب</a>` : ""}
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
            <label class="ops-field"><span>المسؤول</span><select class="ops-select" name="assignee_member_id">${memberOptionsById(task.assignee_member_id)}</select></label>
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
          <button class="ops-btn ops-btn--ghost" type="button" data-action="close-dialog">${onSubmit ? "إلغاء" : "إغلاق"}</button>
          ${onSubmit ? `<button class="ops-btn" type="submit">${esc(submit)}</button>` : ""}
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

  const dialogNewQuote = () =>
    openDialog({
      title: "عرض سعر",
      body: `
        <div class="ops-row">
          <label class="ops-field"><span>الاسم</span><input class="ops-input" name="name" required></label>
          <label class="ops-field"><span>الباقة</span><input class="ops-input" name="package" placeholder="landing / static / dynamic…"></label>
        </div>
        <div class="ops-row">
          <label class="ops-field"><span>التليفون</span><input class="ops-input" name="phone" dir="ltr"></label>
          <label class="ops-field"><span>البريد الإلكتروني</span><input class="ops-input" name="email" type="email" dir="ltr"></label>
        </div>
        <div class="ops-row">
          <label class="ops-field"><span>السعر (ج.م)</span><input class="ops-input" name="value" type="number" min="0" step="500" dir="ltr"></label>
          <label class="ops-field"><span>المتابعة بعد</span><select class="ops-select" name="follow">${options({ 3: "3 أيام", 7: "أسبوع", 14: "أسبوعين" }, 3)}</select></label>
        </div>
        <label class="ops-field"><span>ملاحظات</span><textarea class="ops-textarea" name="notes" rows="2"></textarea></label>`,
      onSubmit: async (fd) => {
        const created = await api("/inquiries", {
          method: "POST",
          body: {
            name: fd.get("name"),
            email: fd.get("email"),
            phone: fd.get("phone"),
            package: fd.get("package"),
            message: fd.get("notes") || "عرض سعر من لوحة التحكم",
            source: "console",
          },
        });
        const days = Number(fd.get("follow") || 3);
        const next = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
        await api(`/inquiries/${created.row.id}`, {
          method: "PATCH",
          body: { status: "proposal", value: Number(fd.get("value") || 0), next_action_at: `${next} 09:00:00` },
        });
        toast("تم إنشاء عرض السعر ومتابعته.", "ok");
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
        <div class="ops-row">
          <label class="ops-field"><span>كلمة المرور ${member ? "(اتركها فارغة للإبقاء على الحالية)" : "(تُولَّد تلقائيًا لو تركتها فارغة)"}</span>
            <input class="ops-input" name="password" type="password" minlength="8" dir="ltr" autocomplete="new-password"></label>
        </div>
        <fieldset style="border:1px solid var(--rule-strong);padding:10px">
          <legend style="font-size:12px;color:var(--fg-dim);padding:0 6px">الصلاحيات</legend>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px 14px">
            ${Object.entries(PERMISSION_LABELS)
              .map(([key, label]) => {
                const active = member ? String(member.permissions || "").split(",").includes(key) : ROLE_DEFAULTS.member.includes(key);
                return `<label style="font-size:13px;display:flex;gap:6px;align-items:center"><input type="checkbox" name="permissions" value="${key}" ${active ? "checked" : ""}> ${esc(label)}</label>`;
              })
              .join("")}
          </div>
        </fieldset>
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
        payload.permissions = fd.getAll("permissions").join(",");
        if (fd.get("password")) payload.password = fd.get("password");
        if (member) {
          payload.active = fd.get("active") ? 1 : 0;
          await api(`/members/${member.id}`, { method: "PATCH", body: payload });
          toast("تم التحديث.", "ok");
        } else {
          const data = await api("/members", { method: "POST", body: payload });
          if (data.temp_password) {
            openDialog({
              title: "بيانات دخول العضو",
              submit: "تم",
              body: `<p style="font-size:13px;color:var(--fg-dim)">أرسل هذه البيانات للعضو؛ لن تُعرض مرة أخرى.</p>
                     <div class="ops-msg" dir="ltr">${esc(payload.email)}<br>${esc(data.temp_password)}</div>`,
              onSubmit: async () => {},
            });
            return { keepOpen: true };
          }
          toast("تمت إضافة العضو.", "ok");
        }
      },
    });

  const permissionBoxes = (member) => `
    <fieldset style="border:1px solid var(--rule-strong);padding:10px">
      <legend style="font-size:12px;color:var(--fg-dim);padding:0 6px">الصلاحيات</legend>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px 14px">
        ${Object.entries(PERMISSION_LABELS)
          .map(([key, label]) => {
            const active = String(member?.permissions || "").split(",").includes(key);
            return `<label style="font-size:13px;display:flex;gap:6px;align-items:center"><input type="checkbox" name="permissions" value="${key}" ${active ? "checked" : ""}> ${esc(label)}</label>`;
          })
          .join("")}
      </div>
    </fieldset>`;

  const dialogAccess = (member) => {
    if (!member) return;
    openDialog({
      title: `صلاحيات ${member.name}`,
      submit: "حفظ الصلاحيات",
      body: `
        <div class="ops-row">
          <label class="ops-field"><span>الدور</span><select class="ops-select" name="role">${options(ROLES, member.role)}</select></label>
          <label class="ops-field"><span>كلمة مرور جديدة (اختياري)</span><input class="ops-input" name="password" type="password" minlength="8" dir="ltr" autocomplete="new-password"></label>
        </div>
        ${permissionBoxes(member)}
        <p style="font-size:12px;color:var(--fg-dim)">تغيير كلمة المرور يُنهي كل جلسات هذا العضو. الصلاحيات تُطبَّق فورًا على الخادم.</p>`,
      onSubmit: async (fd) => {
        await api(`/members/${member.id}`, {
          method: "PATCH",
          body: {
            role: fd.get("role"),
            permissions: fd.getAll("permissions").join(","),
            ...(fd.get("password") ? { password: fd.get("password") } : {}),
          },
        });
        toast("تم حفظ الصلاحيات.", "ok");
      },
    });
  };

  const dialogPassword = () =>
    openDialog({
      title: "تغيير كلمة المرور",
      submit: "تغيير",
      body: `
        <label class="ops-field"><span>كلمة المرور الحالية</span><input class="ops-input" name="current" type="password" required dir="ltr" autocomplete="current-password"></label>
        <label class="ops-field"><span>كلمة المرور الجديدة</span><input class="ops-input" name="next" type="password" required minlength="8" dir="ltr" autocomplete="new-password"></label>
        <label class="ops-field"><span>تأكيد الجديدة</span><input class="ops-input" name="confirm" type="password" required minlength="8" dir="ltr" autocomplete="new-password"></label>`,
      onSubmit: async (fd) => {
        if (fd.get("next") !== fd.get("confirm")) throw new Error("غير متطابقين");
        await api("/auth/password", {
          method: "POST",
          body: { current: fd.get("current"), next: fd.get("next") },
        });
        toast("تم تغيير كلمة المرور. سجّل الدخول من جديد.", "ok");
        lock("تم تغيير كلمة المرور. سجّل الدخول من جديد.", false);
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

  const dialogNewAccessCode = async () => {
    let token = "";
    try {
      const data = await api("/admin/token", { method: "POST", body: { generate: true } });
      token = data.token || "";
    } catch {
      toast("تعذّر إنشاء كود جديد.", "bad");
      return;
    }
    openDialog({
      title: "كود دخول جديد",
      body: `
        <p style="font-size:13px;color:var(--fg-dim)">هذا الكود يفتح اللوحة كوصول احتياطي لو ضاعت كلمة المرور. يظهر مرة واحدة فقط — احفظه في مدير كلمات المرور.</p>
        <code dir="ltr" style="display:block;padding:12px;background:var(--surface-2);border:1px solid var(--rule);word-break:break-all;font-family:var(--font-mono);font-size:13px">${esc(token)}</code>
        <p style="font-size:12px;color:var(--fg-faint)">أي كود قديم أصبح غير صالح الآن.</p>`,
    });
  };


  // ── money ──────────────────────────────────────────────────────────

  const invoiceDue = (inv) => Math.max(0, Number(inv.total || 0) - Number(inv.paid || 0));

  function invoiceRow(inv) {
    const due = invoiceDue(inv);
    const late = inv.due_at && due > 0 && String(inv.due_at).slice(0, 10) < todayKey();
    return `
      <li class="ops-inv" data-action="open-invoice" data-id="${inv.id}">
        <span class="ops-inv__num">${esc(inv.number)}</span>
        <span class="ops-inv__main">
          <span class="ops-list__title">${esc(inv.title || "فاتورة بدون عنوان")}</span>
          <span class="ops-list__meta">${esc(inv.client_name || "بدون عميل")}${
            inv.due_at ? ` · استحقاق ${esc(dateLabel(inv.due_at))}` : ""
          }${Number(inv.paid || 0) ? ` · مدفوع ${egp(inv.paid)}` : ""}</span>
        </span>
        <span class="ops-chip ${INVOICE_TONE[inv.status] || ""}${late ? " ops-chip--danger" : ""}">${esc(
          late ? "متأخرة" : INVOICE_STATUS_LABEL[inv.status] || inv.status
        )}</span>
        <span class="ops-inv__amount">${egp(inv.total)}${due > 0 && due < Number(inv.total || 0) ? `<small>باقي ${egp(due)}</small>` : ""}</span>
        <button class="ops-btn ops-btn--sm ops-inv__pay" type="button" data-action="pay-invoice" data-id="${inv.id}" ${
          due <= 0 ? "disabled" : ""
        }>تسجيل دفعة</button>
      </li>`;
  }

  function renderMoney() {
    const rows = state.data.invoices || [];
    const f = state.data.finance || {};
    const due = rows.reduce((sum, inv) => sum + invoiceDue(inv), 0);
    const late = rows.filter((inv) => inv.due_at && invoiceDue(inv) > 0 && String(inv.due_at).slice(0, 10) < todayKey());

    return `
      <div class="ops-kpis">
        ${kpi("محصّل هذا الشهر", egp(f.this_month ?? 0), "كل الدفعات المسجّلة من أول الشهر", "mint")}
        ${kpi("مستحق", egp(due), `${num(rows.filter((i) => invoiceDue(i) > 0).length)} فاتورة لسه مفتوحة`, "gold")}
        ${kpi("إجمالي المفوتر", egp(f.booked ?? 0), "بدون الفواتير الملغاة")}
        ${kpi("متأخر عن الاستحقاق", num(late.length), late.length ? "محتاجة متابعة النهاردة" : "مفيش متأخرات", late.length ? "danger" : "")}
      </div>

      <section class="ops-panel">
        <div class="ops-panel__head">
          <h2>الفواتير</h2>
          <button class="ops-btn ops-btn--sm" type="button" data-action="new-invoice">+ فاتورة</button>
        </div>
        <div class="ops-panel__body ops-panel__body--flush">
          ${
            rows.length
              ? `<ul class="ops-list ops-list--inv">${rows.map(invoiceRow).join("")}</ul>`
              : `<p class="ops-empty">مفيش فواتير بعد. اعمل أول فاتورة وابدأ تسجّل الدفعات عليها.</p>`
          }
        </div>
      </section>

      <section class="ops-panel">
        <div class="ops-panel__head"><h2>أحدث الدفعات</h2></div>
        <div class="ops-panel__body ops-panel__body--flush">
          ${
            (f.recent || []).length
              ? `<ul class="ops-list">${(f.recent || [])
                  .slice(0, 8)
                  .map(
                    (pay) => `<li class="ops-list__row">
                      <span class="ops-avatar ops-avatar--money">${esc(String(pay.amount).charAt(0))}</span>
                      <span class="ops-list__main">
                        <span class="ops-list__title">${egp(pay.amount)} · ${esc(PAYMENT_METHOD_LABEL[pay.method] || pay.method)}</span>
                        <span class="ops-list__meta">${esc(pay.invoice_number || "فاتورة #" + pay.invoice_id)} · ${esc(ago(pay.created_at))}</span>
                      </span>
                    </li>`
                  )
                  .join("")}</ul>`
              : `<p class="ops-empty">أول ما تسجّل دفعة هتظهر هنا.</p>`
          }
        </div>
      </section>`;
  }

  async function openInvoice(id) {
    const inv = (state.data.invoices || []).find((i) => i.id === id);
    if (!inv) return;
    state.drawer = { type: "invoice", id };
    const box = $("[data-drawer]");
    box.hidden = false;
    box.innerHTML = drawerHead(inv.number, `فاتورة #${inv.id}`);
    let payments = [];
    try {
      payments = (await api(`/invoices/${id}/payments`)).rows;
    } catch {}
    const due = invoiceDue(inv);
    box.innerHTML = `
      ${drawerHead(inv.number, `${esc(inv.client_name || "بدون عميل")} · ${INVOICE_STATUS_LABEL[inv.status] || inv.status}`)}
      <div class="ops-drawer__body">
        <div class="ops-money-card">
          <div><span>الإجمالي</span><strong>${egp(inv.total)}</strong></div>
          <div><span>المدفوع</span><strong class="is-mint">${egp(inv.paid || 0)}</strong></div>
          <div><span>الباقي</span><strong class="${due ? "is-gold" : "is-mint"}">${egp(due)}</strong></div>
        </div>
        <button class="ops-btn" type="button" data-action="pay-invoice" data-id="${inv.id}" ${due <= 0 ? "disabled" : ""}>تسجيل دفعة</button>
        <div>
          <p class="ops-mini-head">الدفعات (${payments.length})</p>
          ${
            payments.length
              ? `<ul class="ops-list">${payments
                  .map(
                    (pay) => `<li class="ops-list__row">
                      <span class="ops-list__main">
                        <span class="ops-list__title">${egp(pay.amount)} · ${esc(PAYMENT_METHOD_LABEL[pay.method] || pay.method)}</span>
                        <span class="ops-list__meta">${esc(ago(pay.created_at))}${pay.reference ? " · " + esc(pay.reference) : ""}</span>
                      </span>
                    </li>`
                  )
                  .join("")}</ul>`
              : `<p class="ops-empty">مفيش دفعات على الفاتورة دي.</p>`
          }
        </div>
        ${inv.notes ? `<p class="ops-note">${esc(inv.notes)}</p>` : ""}
      </div>`;
  }

  const dialogNewInvoice = () =>
    openDialog({
      title: "فاتورة جديدة",
      submit: "إنشاء",
      body: `
        <label class="ops-field"><span>العميل</span>
          <select class="ops-select" name="client_id">
            <option value="">بدون عميل</option>
            ${state.data.clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}
          </select>
        </label>
        <label class="ops-field"><span>البيان</span><input class="ops-input" name="title" placeholder="مثال: باقة متجر إلكتروني" required></label>
        <div class="ops-row">
          <label class="ops-field"><span>الإجمالي (ج.م)</span><input class="ops-input" name="total" type="number" min="0" step="100" dir="ltr" required></label>
          <label class="ops-field"><span>الاستحقاق</span><input class="ops-input" name="due_at" type="date" dir="ltr"></label>
        </div>
        <label class="ops-field"><span>الحالة</span><select class="ops-select" name="status">${options(INVOICE_STATUS_LABEL, "sent")}</select></label>
        <label class="ops-field"><span>ملاحظات</span><textarea class="ops-textarea" name="notes" rows="2"></textarea></label>`,
      onSubmit: async (fd) => {
        await api("/invoices", {
          method: "POST",
          body: {
            client_id: fd.get("client_id") || null,
            title: fd.get("title"),
            total: Number(fd.get("total")),
            due_at: fd.get("due_at") || "",
            status: fd.get("status"),
            notes: fd.get("notes"),
          },
        });
        toast("تم إنشاء الفاتورة.", "ok");
      },
    });

  const dialogPayment = (id) => {
    const inv = (state.data.invoices || []).find((i) => i.id === id);
    if (!inv) return;
    const due = invoiceDue(inv);
    openDialog({
      title: `تسجيل دفعة · ${inv.number}`,
      submit: "تسجيل",
      body: `
        <p class="ops-note">الباقي على الفاتورة: <strong>${egp(due)}</strong></p>
        <div class="ops-row">
          <label class="ops-field"><span>المبلغ (ج.م)</span><input class="ops-input" name="amount" type="number" min="1" step="50" value="${due || ""}" dir="ltr" required></label>
          <label class="ops-field"><span>الطريقة</span><select class="ops-select" name="method">${options(PAYMENT_METHOD_LABEL, "cash")}</select></label>
        </div>
        <label class="ops-field"><span>مرجع (اختياري)</span><input class="ops-input" name="reference" dir="ltr" placeholder="رقم التحويل أو الإيصال"></label>
        <label class="ops-field"><span>ملاحظة</span><input class="ops-input" name="note"></label>`,
      onSubmit: async (fd) => {
        const res = await api(`/invoices/${id}/payments`, {
          method: "POST",
          body: {
            amount: Number(fd.get("amount")),
            method: fd.get("method"),
            reference: fd.get("reference"),
            note: fd.get("note"),
          },
        });
        toast(res.status === "paid" ? "الفاتورة اتقفلت بالكامل." : "تم تسجيل الدفعة.", "ok");
        if (res.status === "paid") haptic([14, 50, 14, 50, 20]);
      },
    });
  };

  // ── theme & notifications ──────────────────────────────────────────

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("egx.theme", theme);
    } catch {}
    $$('[data-action="theme"]').forEach((btn) => {
      btn.textContent = theme === "light" ? "☾" : "☀";
      btn.setAttribute("aria-label", theme === "light" ? "الوضع الليلي" : "الوضع النهاري");
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f4f2ee" : "#101010");
  }

  function closeRail() {
    const rail = $("[data-rail]");
    if (rail) rail.removeAttribute("data-open");
    $(".ops__rail-scrim")?.remove();
    $$('[data-action="rail-toggle"]').forEach((btn) => btn.setAttribute("aria-expanded", "false"));
  }

  function toggleRail() {
    const rail = $("[data-rail]");
    if (!rail) return;
    const open = rail.dataset.open !== "true";
    haptic(6);
    if (open) {
      rail.dataset.open = "true";
      const scrim = document.createElement("button");
      scrim.type = "button";
      scrim.className = "ops__rail-scrim";
      scrim.setAttribute("aria-label", "إغلاق القائمة");
      scrim.addEventListener("click", closeRail);
      document.body.appendChild(scrim);
    } else {
      closeRail();
      return;
    }
    $$('[data-action="rail-toggle"]').forEach((btn) => btn.setAttribute("aria-expanded", String(open)));
  }

  function toggleTheme() {
    haptic(8);
    applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
  }

  async function registerWorker() {
    if (!("serviceWorker" in navigator)) return null;
    try {
      return await navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" });
    } catch {
      return null;
    }
  }

  async function showNotification(title, body) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const registration = await navigator.serviceWorker?.getRegistration("/admin/");
      if (registration?.showNotification) {
        await registration.showNotification(title, {
          body,
          icon: "/favicon.ico",
          tag: "egytronic-ops",
          dir: "rtl",
          lang: "ar",
          data: { url: "/admin/" },
        });
        return;
      }
      new Notification(title, { body, icon: "/favicon.ico", tag: "egytronic-ops" });
    } catch {}
  }

  const urlBase64ToUint8Array = (value) => {
    const raw = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const padded = raw + "=".repeat((4 - (raw.length % 4)) % 4);
    const bin = atob(padded);
    return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  };

  async function enableNotifications() {
    if (typeof Notification === "undefined") return toast("المتصفح ده مايدعمش الإشعارات.", "bad");
    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return toast("الإشعارات مرفوضة من إعدادات المتصفح.", "bad");
    }

    const registration = await registerWorker();
    let subscribed = false;
    try {
      const { key, ready } = await api("/push/key");
      if (ready && key && registration) {
        const existing = await registration.pushManager.getSubscription();
        const sub =
          existing ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
          }));
        await api("/push/subscribe", { method: "POST", body: sub.toJSON() });
        subscribed = true;
      }
    } catch {
      subscribed = false;
    }

    try {
      localStorage.setItem("egx.notify", "1");
    } catch {}
    haptic([12, 60, 12]);

    if (!subscribed) {
      toast("الإشعارات المحلية اتفعّلت، لكن الـ push محتاج إذن المتصفح من جديد.", "bad");
      return;
    }

    toast("الإشعارات شغالة — ببعتلك تجربة دلوقتي.", "ok");
    try {
      const res = await api("/push/test", { method: "POST" });
      if (!res.sent) toast("مفيش أجهزة مشتركة لسه. جرّب من تاني بعد إذن الإشعارات.", "bad");
    } catch {
      toast("تم الاشتراك، لكن الإشعار التجريبي ماوصلش.", "bad");
    }
  }

  function watchForNews(prevLeads) {
    let enabled = false;
    try {
      enabled = localStorage.getItem("egx.notify") === "1";
    } catch {}
    if (!enabled || !prevLeads) return;
    const fresh = state.data.leads.filter((lead) => lead.status === "new").length - prevLeads;
    if (fresh > 0 && document.hidden) {
      showNotification("طلب جديد على الموقع", `${fresh} ليد جديد محتاج رد.`);
      haptic([20, 60, 20]);
    }
  }

  // ── render & refresh ───────────────────────────────────────────────

  function render() {
    const fns = {
      me: renderMe,
      overview: renderOverview,
      pipeline: renderPipeline,
      clients: renderClients,
      money: renderMoney,
      tasks: renderTasks,
      team: renderTeam,
      channels: renderChannels,
      code: renderCode,
      integrations: renderIntegrations,
      agents: renderAgents,
    };
    const panel = $(`[data-panel="${state.view}"]`);
    if (panel && fns[state.view]) panel.innerHTML = fns[state.view]();
    $$("[data-count]").forEach((node) => {
      if (node.dataset.count === "pipeline") node.textContent = String(openLeads().length);
      if (node.dataset.count === "tasks") node.textContent = String(openTasks().length);
      if (node.dataset.count === "me") node.textContent = String(state.space?.tasks?.filter((t) => t.status !== "done").length ?? 0);
      if (node.dataset.count === "chat") node.textContent = String(state.space?.unread ?? 0);
      if (node.dataset.count === "money")
        node.textContent = String(state.data.invoices.filter((inv) => inv.status !== "paid" && inv.status !== "void").length);
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

  async function markLeadContacted(id) {
    await api(`/inquiries/${id}`, { method: "PATCH", body: { status: "contacted" } });
    toast("تم تسجيل الرد على الطلب.", "ok");
    await loadAll();
  }

  async function leadToTask(id) {
    const lead = state.data.leads.find((l) => l.id === id);
    if (!lead) return;
    await api("/tasks", {
      method: "POST",
      body: {
        title: `متابعة طلب: ${lead.name}`,
        detail: [lead.package, lead.phone, lead.email].filter(Boolean).join(" · "),
        priority: 1,
      },
    });
    toast("تم إنشاء مهمة متابعة للطلب.", "ok");
    await loadAll();
  }

  async function channelToTask(slug) {
    await api("/tasks", {
      method: "POST",
      body: { title: `متابعة محادثة #${slug}`, detail: `من المحادثة #${slug}`, priority: 2 },
    });
    toast("تم تحويل المحادثة إلى مهمة.", "ok");
    await loadAll();
  }

  async function moveLead(id, status) {
    await api(`/inquiries/${id}`, { method: "PATCH", body: { status } });
    toast(`تم نقل الطلب إلى «${STAGE_LABEL[status]}».`, "ok");
    await refreshKeepingDrawer();
  }

  async function claimTask(id) {
    await api(`/tasks/${id}`, { method: "PATCH", body: { claim: true } });
    toast("تم أخذ المهمة إلى قائمتك.", "ok");
    await refreshKeepingDrawer();
  }

  async function setupOwnerFromGate() {
    const form = $("[data-gate-form]");
    const token = form.querySelector("input[name=token]").value.trim();
    const email = form.querySelector("input[name=email]").value.trim();
    const password = form.querySelector("input[name=password]").value;
    const status = $("[data-gate-status]");
    if (!token || !email || password.length < 8) {
      status.textContent = "اكتب البريد وكلمة مرور من 8 أحرف على الأقل، وكود المالك.";
      status.dataset.state = "error";
      return;
    }
    state.token = token;
    try {
      await api("/auth/setup", { method: "POST", body: { email, password } });
      state.token = "";
      status.textContent = "تم إنشاء حساب المالك. ادخل الآن بالبريد وكلمة المرور.";
      status.dataset.state = "ok";
      toast("حساب المالك جاهز.", "ok");
    } catch (err) {
      state.token = "";
      status.textContent = "تعذّر إنشاء الحساب. تأكد من كود المالك.";
      status.dataset.state = "error";
    }
  }

  async function openDmMember(memberId) {
    const data = await api(`/dm/${memberId}`, { method: "POST" });
    state.activeChannel = data.channel?.id ?? null;
    if (state.view !== "channels") setView("channels");
    await loadAll();
    toast("محادثة خاصة جاهزة.", "ok");
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
    const channelId = form.dataset.channel;
    await api(`/channels/${channelId}/messages`, { method: "POST", body: { body } });
    await api(`/channels/${channelId}/read`, { method: "POST" }).catch(() => {});
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
    "open-channel": async (el) => {
      const id = Number(el.dataset.id);
      if (state.view !== "channels") {
        state.activeChannel = id;
        setView("channels");
      } else {
        state.activeChannel = id;
        render();
      }
      await api(`/channels/${id}/read`, { method: "POST" }).catch(() => {});
      await loadAll();
    },
    "dm-member": (el) => openDmMember(Number(el.dataset.id)),
    "member-access": (el) => dialogAccess(state.data.members.find((m) => m.id === Number(el.dataset.id))),
    "claim-task": (el) => claimTask(Number(el.dataset.id)),
    "setup-owner": (el) => setupOwnerFromGate(el),
    password: () => dialogPassword(),
    "filter-tasks": (el) => {
      state.filters.tasks = el.dataset.value;
      render();
    },
    "toggle-task": (el) => toggleTask(Number(el.dataset.id)),
    "toggle-agent": (el) => toggleAgent(Number(el.dataset.id)),
    "convert-lead": (el) => convertLead(Number(el.dataset.id)),
    pomodoro: () => togglePomodoro(),
    "new-lead": () => dialogNewLead(),
    "new-quote": () => dialogNewQuote(),
    "new-access-code": () => dialogNewAccessCode(),
    "lead-contacted": (el) => markLeadContacted(Number(el.dataset.id)),
    "lead-to-task": (el) => leadToTask(Number(el.dataset.id)),
    "channel-to-task": (el) => channelToTask(el.dataset.slug),
    "new-client": () => dialogNewClient(),
    "new-invoice": () => dialogNewInvoice(),
    "pay-invoice": (el) => dialogPayment(Number(el.dataset.id)),
    "open-invoice": (el) => openInvoice(Number(el.dataset.id)),
    theme: () => toggleTheme(),
    "rail-toggle": () => toggleRail(),
    "notify-enable": () => enableNotifications(),
    "new-task": (el) => dialogNewTask(el.dataset.client || ""),
    "new-member": () => dialogMember(),
    "new-project": (el) => dialogProject(el.dataset.client),
    "new-agent": () => dialogAgent(),
    "edit-member": (el) => dialogMember(state.data.members.find((m) => m.id === Number(el.dataset.id))),
    "int-new-key": () => dialogIntegrationKey(),
    "int-new-connector": () => dialogConnector(),
    "int-new-automation": () => dialogAutomation(),
    "int-new-webhook": () => dialogWebhook(),
    "int-key-toggle": async (el) => {
      await api(`/integrations/keys/${el.dataset.id}`, { method: "PATCH", body: { active: el.dataset.on !== "1" } });
      toast("تم تحديث المفتاح.", "ok");
      await loadAll();
    },
    "int-key-delete": async (el) => {
      await api(`/integrations/keys/${el.dataset.id}`, { method: "DELETE" });
      toast("تم حذف المفتاح.", "ok");
      await loadAll();
    },
    "int-connector-test": async (el) => {
      toast("بيتم اختبار الموصّل…");
      const res = await api(`/integrations/connectors/${el.dataset.id}/test`, { method: "POST" });
      toast(res.ok ? "الموصّل وصل بنجاح." : "الموصّل رجّع خطأ.", res.ok ? "ok" : "bad");
      await loadAll();
    },
    "int-connector-delete": async (el) => {
      await api(`/integrations/connectors/${el.dataset.id}`, { method: "DELETE" });
      toast("تم حذف الموصّل.", "ok");
      await loadAll();
    },
    "int-automation-run": async (el) => {
      const res = await api(`/integrations/automations/${el.dataset.id}/run`, { method: "POST" });
      toast(res.ok ? "تم التشغيل والإرسال." : `لم يُرسل: ${res.result?.detail || ""}`, res.ok ? "ok" : "bad");
      await loadAll();
    },
    "int-automation-runs": async (el) => {
      const { rows } = await api(`/integrations/automations/${el.dataset.id}/runs`);
      state.integRuns = rows;
      render();
      toast(rows.length ? `${rows.length} تشغيل في السجل.` : "مفيش تشغيل لسه.");
    },
    "int-automation-toggle": async (el) => {
      await api(`/integrations/automations/${el.dataset.id}`, { method: "PATCH", body: { enabled: el.dataset.on !== "1" } });
      toast("تم تحديث الأتمتة.", "ok");
      await loadAll();
    },
    "int-automation-delete": async (el) => {
      await api(`/integrations/automations/${el.dataset.id}`, { method: "DELETE" });
      toast("تم حذف الأتمتة.", "ok");
      await loadAll();
    },
    "int-webhook-rotate": async (el) => {
      const res = await api(`/integrations/webhooks/${el.dataset.id}/rotate`, { method: "POST" });
      await loadAll();
      dialogInfo("المفتاح الجديد", `<p class="ops-int__note">انسخه الآن — لن يظهر مرة أخرى.</p><pre class="ops-int__code" dir="ltr">${esc(res.secret)}</pre>`);
    },
    "int-webhook-toggle": async (el) => {
      await api(`/integrations/webhooks/${el.dataset.id}`, { method: "PATCH", body: { active: el.dataset.on !== "1" } });
      toast("تم تحديث المصدر.", "ok");
      await loadAll();
    },
    "int-webhook-delete": async (el) => {
      await api(`/integrations/webhooks/${el.dataset.id}`, { method: "DELETE" });
      toast("تم حذف المصدر.", "ok");
      await loadAll();
    },
    "int-webhook-deliveries": async (el) => {
      const { rows } = await api(`/integrations/webhooks/${el.dataset.id}/deliveries`);
      dialogInfo(
        "آخر الاستقبالات",
        rows.length
          ? `<ul class="ops-list ops-int__dense">${rows
              .map(
                (r) => `<li class="ops-list__row"><span class="ops-list__main"><span class="ops-list__title" dir="ltr">${esc(r.event_key || "—")}</span><span class="ops-list__meta">${esc(r.summary || "")}</span></span><span class="ops-chip ${r.ok ? "ops-chip--mint" : "ops-chip--danger"}">${r.ok ? "تم" : "خطأ"}</span><span class="ops-list__meta">${esc(ago(r.created_at))}</span></li>`
              )
              .join("")}</ul>`
          : `<p class="ops-empty">لا يوجد استقبال بعد.</p>`
      );
    },
    "code-refresh": async () => {
      await codeLoadStatus();
      if (codeState().status?.configured) await codeLoadRepos();
      render();
    },
    "code-open-repo": (el) => codeOpenRepo(el.dataset.id),
    "code-dir": async (el) => {
      try {
        await codeLoadTree(el.dataset.path);
      } catch (err) {
        toast(codeMessage(err), "bad");
      }
      render();
    },
    "code-file": (el) => codeOpenFile(el.dataset.path),
    "code-close-file": () => {
      codeState().file = null;
      render();
    },
    "code-save": () => codeSave(),
    "code-delete": (el) => codeDeleteFile(el.dataset.path),
    "code-commit": (el) => codeOpenCommit(el.dataset.sha),
    "code-tab": (el) => {
      codeState().tab = el.dataset.tab;
      render();
    },
    "code-new-file": () => dialogCodeFile(),
    "code-token": () => dialogCodeToken(),
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

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-int-trigger]")) {
      const form = event.target.closest("form");
      const schedule = form?.querySelector("input[name=schedule]");
      const eventKey = form?.querySelector("input[name=event_key]");
      const cron = event.target.value === "cron";
      if (schedule) schedule.hidden = !cron;
      if (eventKey) eventKey.hidden = cron;
      return;
    }
    if (event.target.matches("[data-code-branch]")) {
      codeSwitchBranch(event.target.value).catch((err) => toast(codeMessage(err), "bad"));
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.drawer) closeDrawer();
    if ((event.key === "Enter" || event.key === " ") && event.target.classList?.contains("ops-lead")) {
      event.preventDefault();
      openLead(Number(event.target.dataset.id));
    }
  });

  let filterTimer = null;
  let codeSearchTimer = null;
  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-code-search]")) {
      codeState().query = event.target.value;
      clearTimeout(codeSearchTimer);
      codeSearchTimer = setTimeout(() => {
        render();
        const box = $("[data-code-search]");
        if (box) {
          box.focus();
          box.setSelectionRange(box.value.length, box.value.length);
        }
      }, 140);
      return;
    }
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
            assignee_member_id: fd.get("assignee_member_id") ? Number(fd.get("assignee_member_id")) : null,
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
      const data = await api("/auth/me");
      state.me = data.member;
      applyPermissions();
      sessionStorage.setItem(KEY, state.token);
      $("[data-gate]").hidden = true;
      $("[data-shell]").hidden = false;
      $("[data-who]").innerHTML = `<i>●</i> ${esc(state.me.name)} · ${esc(ROLES[state.me.role] || state.me.role)}`;
      await loadAll();
      setView(location.hash.replace("#", "") || "me", false);
    } catch (err) {
      if (String(err.message) === "unauthorized") lock("");
      else lock("تعذّر الاتصال بالخادم.");
    }
  }

  $("[data-gate-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const email = form.querySelector("input[name=email]").value.trim();
    const password = form.querySelector("input[name=password]").value;
    const token = form.querySelector("input[name=token]").value.trim();
    const status = $("[data-gate-status]");
    status.textContent = "";
    status.dataset.state = "";
    if (!password && !token) {
      status.textContent = "اكتب البريد وكلمة المرور، أو استخدم كود المالك.";
      status.dataset.state = "error";
      return;
    }
    try {
      if (password && email) {
        await api("/auth/login", { method: "POST", body: { email, password } });
        state.token = "";
      } else {
        state.token = token;
      }
      await unlock();
      if (!state.me) {
        status.textContent = "بيانات الدخول غير صحيحة.";
        status.dataset.state = "error";
      }
    } catch (err) {
      if (String(err.message) !== "unauthorized") {
        status.textContent = "بيانات الدخول غير صحيحة.";
        status.dataset.state = "error";
      }
    }
  });

  $("[data-reveal]").addEventListener("click", (event) => {
    const inputs = $$("[data-gate-form] input[type=password], [data-gate-form] input[type=text]").filter(
      (input) => input.name === "password" || input.name === "token"
    );
    const show = inputs[0]?.type === "password";
    inputs.forEach((input) => (input.type = show ? "text" : "password"));
    event.currentTarget.textContent = show ? "إخفاء" : "إظهار";
  });

  $$("[data-lock]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await fetch(API + "/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
      lock("تم تسجيل الخروج.");
    })
  );
  $$("[data-rotate]").forEach((btn) => btn.addEventListener("click", () => dialogRotate()));
  $("[data-refresh]").addEventListener("click", () => loadAll());
  window.addEventListener("hashchange", () => setView(location.hash.replace("#", "") || "me", false));

  setInterval(() => {
    if (!document.hidden && state.me) loadAll();
  }, 90000);

  try {
    if (localStorage.getItem("egx.notify") === "1" && typeof Notification !== "undefined" && Notification.permission === "granted") {
      registerWorker();
    }
  } catch {}

  try {
    applyTheme(localStorage.getItem("egx.theme") || "dark");
  } catch {
    applyTheme("dark");
  }

  unlock();
})();
