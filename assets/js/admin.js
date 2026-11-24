/* Egytronic operations console.
   One script, no build step: every view fetches the API the agents use, so what
   you see here is exactly what an agent can act on. */

const KEY = "egytronic.admin.token";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const el = (html) => {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
};

const when = (value) => {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  return date.toLocaleDateString("ar-EG", { day: "numeric", month: "short" }) + " " + date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
};

const STATUS_AR = {
  new: "جديد",
  contacted: "تم التواصل",
  quoted: "عرض سعر",
  won: "تم الاتفاق",
  lost: "مرفوض",
  lead: "مهتم",
  active: "شغال",
  paused: "متوقف",
  done: "خلص",
  todo: "مطلوب",
  doing: "شغال عليه",
  planned: "مخطط",
  building: "قيد التنفيذ",
  review: "مراجعة",
  shipped: "تم التسليم",
};

const PACKAGE_AR = {
  logo: "لوجو",
  landing: "لاندنج بيدج",
  static: "موقع ستاتيك",
  identity: "هوية كاملة",
  dynamic: "موقع ديناميك",
  transform: "تحول رقمي",
  unsure: "لسه بيحدد",
};

let token = sessionStorage.getItem(KEY) || "";
const state = {
  view: (location.hash.replace("#/", "") || "overview"),
  inquiryStatus: "",
  query: "",
  renderSeq: 0,
  channels: [],
  channel: null,
  channelTimer: null,
  tasks: [],
  clients: [],
  agents: [],
  newAgentKey: "",
  lastEvent: 0,
  pollTimer: null,
  timer: { total: 25 * 60, left: 25 * 60, running: false, taskId: null, interval: null },
};

// ── api ──────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (response.status === 401) {
    lock("التوكن مش مقبول. اعمله دخول تاني.");
    throw new Error("unauthorized");
  }
  if (!response.ok || payload.ok === false) {
    const code = payload.code || response.status;
    throw Object.assign(new Error(code), { code });
  }
  return payload;
}

// ── shell: gate, nav, toast ──────────────────────────────────────────

const gate = $("[data-gate]");
const shell = $("[data-shell]");
const gateStatus = $("[data-gate-status]");
const toastBox = $("[data-toast]");
let toastTimer;

function toast(message, tone = "ok") {
  if (!toastBox) return;
  toastBox.textContent = message;
  toastBox.dataset.tone = tone;
  toastBox.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastBox.hidden = true;
  }, 3200);
}

function lock(message = "") {
  token = "";
  sessionStorage.removeItem(KEY);
  if (gate) gate.hidden = false;
  if (shell) shell.hidden = true;
  stopChannelPoll();
  clearInterval(state.pollTimer);
  if (message) {
    gateStatus.textContent = message;
    gateStatus.dataset.tone = "error";
  }
}

function normalize(raw) {
  const match = String(raw || "").match(/egx_[A-Za-z0-9_]+/);
  return (match ? match[0] : String(raw || "").trim()).replace(/\s+/g, "");
}

async function enter() {
  gate.hidden = true;
  shell.hidden = false;
  await refreshCounts();
  setView(TITLES[state.view] ? state.view : "overview");
  startPolling();
}

const TITLES = {
  overview: "نظرة عامة",
  inquiries: "الطلبات",
  clients: "العملاء",
  channels: "القنوات",
  tasks: "المهام",
  agents: "الوكلاء",
};

function setView(view) {
  state.view = view;
  location.hash = `#/${view}`;
  $$(".ops__nav-btn").forEach((button) => {
    button.toggleAttribute("aria-current", button.dataset.view === view);
    if (button.dataset.view === view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("[data-title]").textContent = TITLES[view] || "";
  $$("[data-view-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== view;
  });
  if (state.view === "channels" && !state.channel) stopChannelPoll();
  render(view);
}

async function render(view) {
  try {
    if (view === "overview") return await renderOverview();
    if (view === "inquiries") return await renderInquiries();
    if (view === "clients") return renderClients();
    if (view === "channels") return await renderChannels();
    if (view === "tasks") return await renderTasks();
    if (view === "agents") return await renderAgents();
  } catch (error) {
    const panel = $(`[data-view-panel="${view}"]`);
    if (panel && error.message !== "unauthorized") {
      panel.innerHTML = `<div class="ops-empty">تعذّر التحميل: ${esc(error.code || error.message)}</div>`;
    }
  }
}

async function refreshCounts() {
  try {
    const data = await api("/api/overview");
    $("[data-who]").textContent = `${data.who?.name || "—"} · ${data.who?.role === "admin" ? "مدير" : "وكيل"}`;
    setCount("inquiries", data.new_inquiries);
    setCount("tasks", data.open_tasks);
  } catch {
    /* the view will surface the error */
  }
}

function setCount(name, value) {
  const node = $(`[data-count="${name}"]`);
  if (!node) return;
  node.textContent = value ?? 0;
  node.toggleAttribute("data-zero", !value);
}

// ── overview ─────────────────────────────────────────────────────────

async function renderOverview() {
  const [overview, events, time] = await Promise.all([
    api("/api/overview"),
    api("/api/events?limit=14"),
    api("/api/time"),
  ]);

  const panel = $('[data-view-panel="overview"]');
  panel.innerHTML = "";
  panel.append(
    el(`<div class="ops-grid ops-grid--stats">
      <div class="ops-card"><div class="ops-stat">${overview.new_inquiries}</div><div class="ops-stat__label">طلب جديد محتاج رد</div></div>
      <div class="ops-card"><div class="ops-stat">${overview.open_tasks}</div><div class="ops-stat__label">مهمة مفتوحة</div></div>
      <div class="ops-card"><div class="ops-stat">${time.minutes}</div><div class="ops-stat__label">دقيقة تركيز النهارده</div></div>
      <div class="ops-card"><div class="ops-stat">${overview.active_clients}</div><div class="ops-stat__label">عميل نشط</div></div>
      <div class="ops-card"><div class="ops-stat">${overview.agents}</div><div class="ops-stat__label">وكيل متصل</div></div>
    </div>`)
  );

  const quick = el(`<div class="ops-card ops-card--flat" style="padding:16px">
    <div class="ops-head"><h2>اختصارات</h2></div>
    <div class="ops-row">
      <button class="ops-btn ops-btn--quiet" data-quick="inquiries">راجع الطلبات</button>
      <button class="ops-btn ops-btn--quiet" data-quick="tasks">ابدأ بومودورو</button>
      <button class="ops-btn ops-btn--quiet" data-quick="agents">وصل وكيل</button>
    </div>
  </div>`);
  quick.addEventListener("click", (event) => {
    const target = event.target.closest("[data-quick]");
    if (target) setView(target.dataset.quick);
  });
  panel.append(quick);

  const rows = (events.rows || [])
    .map(
      (row) => `<div class="ops-feed__row">
        <span class="ops-feed__kind">${esc(row.kind)}</span>
        <span>${esc(row.actor || "")}${row.entity_id ? ` #${esc(row.entity_id)}` : ""}</span>
        <span class="ops-feed__time">${esc(when(row.created_at))}</span>
      </div>`
    )
    .join("");

  panel.append(
    el(`<div class="ops-card"><div class="ops-head"><h2>النشاط الأخير</h2><span class="ops-item__meta">أحداث الـAPI</span></div>
      <div class="ops-feed">${rows || '<div class="ops-empty">مفيش نشاط لسه.</div>'}</div></div>`)
  );

  state.lastEvent = Math.max(state.lastEvent, ...(events.rows || []).map((row) => row.id), 0);
  setCount("inquiries", overview.new_inquiries);
  setCount("tasks", overview.open_tasks);
}

// ── inquiries ────────────────────────────────────────────────────────

async function renderInquiries() {
  const params = new URLSearchParams();
  if (state.inquiryStatus) params.set("status", state.inquiryStatus);
  if (state.query) params.set("q", state.query);
  const mine = ++state.renderSeq;
  const { rows } = await api(`/api/inquiries?${params}`);
  if (mine !== state.renderSeq) return;

  const panel = $('[data-view-panel="inquiries"]');
  const filters = ["", "new", "contacted", "quoted", "won", "lost"]
    .map(
      (value) =>
        `<button class="ops-chip" data-status="${value}" aria-pressed="${state.inquiryStatus === value}">${
          value ? STATUS_AR[value] : "الكل"
        }</button>`
    )
    .join("");

  const items = rows
    .map(
      (row) => `<button class="ops-item ops-item--button" data-inquiry="${row.id}">
        <span class="ops-item__top">
          <span class="ops-item__name">${esc(row.name)}</span>
          <span class="ops-badge ops-badge--${esc(row.status || "new")}">${esc(STATUS_AR[row.status] || row.status || "جديد")}</span>
        </span>
        <span class="ops-item__meta">${esc(row.email)} · ${esc(PACKAGE_AR[row.package] || row.package || "باقة غير محددة")} · ${esc(when(row.created_at))}</span>
        <span class="ops-item__body">${esc((row.message || "").slice(0, 180))}</span>
      </button>`
    )
    .join("");

  panel.innerHTML = "";
  panel.append(
    el(`<div class="ops-head">
      <div class="ops-row">${filters}</div>
      <input class="ops-form" style="width:220px;padding:8px 10px;border:2px solid var(--line);background:#101010;color:var(--text)"
             data-search placeholder="بحث بالاسم أو الإيميل" value="${esc(state.query)}" aria-label="بحث في الطلبات">
    </div>`)
  );
  panel.append(el(`<div class="ops-list">${items || '<div class="ops-empty">مفيش طلبات في الفلتر ده.</div>'}</div>`));

  $$("[data-status]", panel).forEach((chip) =>
    chip.addEventListener("click", () => {
      state.inquiryStatus = chip.dataset.status;
      renderInquiries();
    })
  );
  const search = $("[data-search]", panel);
  let debounce;
  search.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.query = search.value.trim();
      renderInquiries();
    }, 260);
  });

  $$("[data-inquiry]", panel).forEach((button) =>
    button.addEventListener("click", () => openInquiry(Number(button.dataset.inquiry)))
  );
}

async function openInquiry(id) {
  const { row } = await api(`/api/inquiries/${id}`);
  const drawer = el(`<div class="ops-drawer" data-drawer>
    <div aria-hidden="true" data-close></div>
    <div class="ops-drawer__panel" role="dialog" aria-modal="true" aria-label="تفاصيل الطلب">
      <div class="ops-drawer__scroll">
        <div class="ops-head">
          <h2>${esc(row.name)}</h2>
          <button class="ops__ghost ops__ghost--sm" type="button" data-close>إغلاق</button>
        </div>

        <dl class="ops-kv">
          <dt>الحالة</dt><dd><span class="ops-badge ops-badge--${esc(row.status || "new")}">${esc(STATUS_AR[row.status] || "جديد")}</span></dd>
          <dt>الإيميل</dt><dd dir="ltr"><a href="mailto:${esc(row.email)}" style="color:var(--gold-hi)">${esc(row.email)}</a></dd>
          <dt>الموبايل</dt><dd dir="ltr">${row.phone ? `<a href="tel:${esc(row.phone)}" style="color:var(--gold-hi)">${esc(row.phone)}</a>` : "—"}</dd>
          <dt>الباقة</dt><dd>${esc(PACKAGE_AR[row.package] || row.package || "غير محددة")}</dd>
          <dt>الوقت</dt><dd>${esc(when(row.created_at))}</dd>
        </dl>

        <div class="ops-card">
          <div class="ops-head"><h2>الرسالة</h2></div>
          <div class="ops-item__body">${esc(row.message)}</div>
        </div>

        <div class="ops-row">
          ${["new", "contacted", "quoted", "won", "lost"]
            .map((value) => `<button class="ops-chip" data-set-status="${value}">${esc(STATUS_AR[value])}</button>`)
            .join("")}
          <button class="ops-btn" data-convert>تحويل لعميل + مشروع + مهمة</button>
        </div>

        <div class="ops-form">
          <label for="inquiry-notes">ملاحظات داخلية</label>
          <textarea id="inquiry-notes" data-notes>${esc(row.notes || "")}</textarea>
          <div class="ops-row">
            <button class="ops-btn ops-btn--quiet" data-save-notes>حفظ الملاحظات</button>
            <a class="ops-btn ops-btn--quiet" href="https://wa.me/${esc((row.phone || "").replace(/\D/g, ""))}" target="_blank" rel="noopener">واتساب</a>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  document.body.append(drawer);
  const close = () => drawer.remove();
  $$("[data-close]", drawer).forEach((node) => node.addEventListener("click", close));
  document.addEventListener("keydown", function onKey(event) {
    if (event.key === "Escape") {
      close();
      document.removeEventListener("keydown", onKey);
    }
  });

  $$("[data-set-status]", drawer).forEach((button) =>
    button.addEventListener("click", async () => {
      await api(`/api/inquiries/${id}`, { method: "PATCH", body: { status: button.dataset.setStatus } });
      toast("الحالة اتحدثت");
      close();
      renderInquiries();
      refreshCounts();
    })
  );

  $("[data-save-notes]", drawer).addEventListener("click", async () => {
    await api(`/api/inquiries/${id}`, { method: "PATCH", body: { notes: $("[data-notes]", drawer).value } });
    toast("الملاحظات اتحفظت");
  });

  $("[data-convert]", drawer).addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try {
      const result = await api(`/api/inquiries/${id}/convert`, { method: "POST", body: {} });
      toast(`اتحول: عميل #${result.client_id} · مشروع #${result.project_id} · مهمة #${result.task_id}`);
      close();
      renderInquiries();
      refreshCounts();
    } catch {
      toast("التحويل فشل", "error");
      event.currentTarget.disabled = false;
    }
  });
}

// ── clients ──────────────────────────────────────────────────────────

async function renderClients() {
  const [{ rows: clients }, { rows: projects }] = await Promise.all([api("/api/clients"), api("/api/projects")]);
  state.clients = clients;
  const panel = $('[data-view-panel="clients"]');

  const projectList = (clientId) => projects.filter((project) => project.client_id === clientId);

  const cards = clients
    .map((client) => {
      const own = projectList(client.id);
      const projectsHtml = own.length
        ? `<div class="ops-feed">${own
            .map(
              (project) =>
                `<div class="ops-feed__row"><span class="ops-feed__kind">${esc(PACKAGE_AR[project.package] || "مشروع")}</span>
                 <span>${esc(project.title)}</span><span class="ops-feed__time">${esc(STATUS_AR[project.status] || project.status)}</span></div>`
            )
            .join("")}</div>`
        : "";
      return `<div class="ops-card">
        <div class="ops-item__top">
          <span class="ops-item__name">${esc(client.name)}</span>
          <span class="ops-badge ops-badge--${esc(client.status)}">${esc(STATUS_AR[client.status] || client.status)}</span>
        </div>
        <div class="ops-item__meta" dir="ltr">${esc(client.email || "—")} ${client.phone ? "· " + esc(client.phone) : ""}</div>
        ${client.value ? `<div class="ops-item__meta">القيمة: ${esc(client.value)} جنيه</div>` : ""}
        ${projectsHtml}
        <div class="ops-row" style="margin-top:8px">
          ${["lead", "active", "paused", "done"]
            .map((value) => `<button class="ops-chip" data-client="${client.id}" data-client-status="${value}" aria-pressed="${client.status === value}">${esc(STATUS_AR[value])}</button>`)
            .join("")}
          <button class="ops-chip" data-project-for="${client.id}">+ مشروع</button>
        </div>
      </div>`;
    })
    .join("");

  panel.innerHTML = "";
  panel.append(
    el(`<div class="ops-card">
      <div class="ops-head"><h2>عميل جديد</h2></div>
      <form class="ops-form" data-client-form>
        <div class="ops-form__grid">
          <input name="name" placeholder="الاسم" required>
          <input name="email" type="email" placeholder="الإيميل" dir="ltr">
          <input name="phone" placeholder="الموبايل" dir="ltr">
          <input name="value" type="number" placeholder="قيمة التعاقد (جنيه)">
        </div>
        <div class="ops-row"><button class="ops-btn" type="submit">إضافة</button></div>
      </form>
    </div>`)
  );
  panel.append(el(`<div class="ops-list" style="margin-top:14px">${cards || '<div class="ops-empty">مفيش عملاء لسه. حول طلب من صفحة الطلبات.</div>'}</div>`));

  $("[data-client-form]", panel).addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    await api("/api/clients", { method: "POST", body: data });
    toast("العميل اتضاف");
    render("clients");
  });

  $$("[data-client-status]", panel).forEach((button) =>
    button.addEventListener("click", async () => {
      await api(`/api/clients/${button.dataset.client}`, { method: "PATCH", body: { status: button.dataset.clientStatus } });
      render("clients");
    })
  );

  $$("[data-project-for]", panel).forEach((button) =>
    button.addEventListener("click", async () => {
      const title = prompt("اسم المشروع؟", "موقع جديد");
      if (!title) return;
      await api("/api/projects", { method: "POST", body: { title, client_id: Number(button.dataset.projectFor) } });
      toast("المشروع اتضاف");
      render("clients");
    })
  );
}
// ── channels ─────────────────────────────────────────────────────────

async function renderChannels() {
  const { rows } = await api("/api/channels");
  state.channels = rows;
  const panel = $('[data-view-panel="channels"]');

  const list = rows
    .map(
      (channel) => `<button class="ops-chan" data-channel="${esc(channel.slug)}" aria-current="${state.channel === channel.slug}">
        <bdi>#${esc(channel.slug)}</bdi>
        <span>${esc(channel.topic || "")} · ${channel.messages} رسالة</span>
      </button>`
    )
    .join("");

  panel.innerHTML = "";
  panel.append(el(`<div class="ops-card" style="padding:8px"><div class="ops-head" style="padding:6px 6px 0"><h2>القنوات</h2></div>${list}
    <button class="ops__ghost ops__ghost--sm" type="button" data-new-channel style="margin-top:8px;width:100%">+ قناة</button></div>`));
  panel.append(el(`<div class="ops-chat" data-chat>
    <div class="ops-chat__log" data-chat-log><div class="ops-empty">اختار قناة من الشمال.</div></div>
    <form class="ops-chat__compose" data-chat-form>
      <textarea name="body" placeholder="اكتب رسالة…" aria-label="رسالة"></textarea>
      <button class="ops-btn" type="submit">إرسال</button>
    </form>
  </div>`));

  $$("[data-channel]", panel).forEach((button) =>
    button.addEventListener("click", () => {
      state.channel = button.dataset.channel;
      $$("[data-channel]", panel).forEach((node) => node.setAttribute("aria-current", String(node === button)));
      loadChannel(true);
      startChannelPoll();
    })
  );

  $("[data-new-channel]", panel).addEventListener("click", async () => {
    const slug = prompt("اسم القناة بالإنجليزي (مثال: client-acme)");
    if (!slug) return;
    try {
      await api("/api/channels", { method: "POST", body: { slug } });
      toast("القناة اتعملت");
      render("channels");
    } catch {
      toast("الاسم مستخدم أو غير صالح", "error");
    }
  });

  $("[data-chat-form]", panel).addEventListener("submit", async (event) => {
    event.preventDefault();
    const field = event.target.elements.body;
    const value = field.value.trim();
    if (!value || !state.channel) return;
    field.value = "";
    try {
      await api(`/api/channels/${encodeURIComponent(state.channel)}/messages`, { method: "POST", body: { body: value } });
      await loadChannel(false);
    } catch {
      toast("الرسالة مبعتتش", "error");
    }
  });

  if (state.channel) {
    await loadChannel(true);
    startChannelPoll();
  }
}

async function loadChannel(reset) {
  if (!state.channel) return;
  const log = $("[data-chat-log]");
  if (!log) return;
  const after = reset ? 0 : Number(log.dataset.last || 0);
  const { rows } = await api(`/api/channels/${encodeURIComponent(state.channel)}/messages?after=${after}`);
  if (reset) log.innerHTML = "";

  if (!log.children.length && !rows.length) {
    log.append(el('<div class="ops-empty">القناة فاضية. أول رسالة بتفتح الموضوع.</div>'));
  }

  rows.forEach((row) => {
    log.append(
      el(`<div class="ops-msg" data-kind="${esc(row.kind)}">
        <div class="ops-msg__head"><span class="ops-msg__author">${esc(row.author)}</span><span>${esc(when(row.created_at))}</span></div>
        <div>${esc(row.body)}</div>
      </div>`)
    );
    log.dataset.last = row.id;
  });

  log.scrollTop = log.scrollHeight;
}

function startChannelPoll() {
  stopChannelPoll();
  state.channelTimer = setInterval(() => loadChannel(false).catch(() => {}), 5000);
}

function stopChannelPoll() {
  clearInterval(state.channelTimer);
  state.channelTimer = null;
}

// ── tasks + pomodoro ─────────────────────────────────────────────────

async function renderTasks() {
  const [{ rows }, time] = await Promise.all([api("/api/tasks"), api("/api/time")]);
  state.tasks = rows;
  const panel = $('[data-view-panel="tasks"]');

  const columns = [
    ["todo", "مطلوب"],
    ["doing", "شغال عليه"],
    ["done", "خلص"],
  ];

  const card = (task) => `<div class="ops-task" data-priority="${task.priority}">
      <div class="ops-task__title">${esc(task.title)}</div>
      <div class="ops-item__meta">#${task.id}${task.assignee ? " · " + esc(task.assignee) : ""}${task.source ? " · " + esc(task.source) : ""}</div>
      <div class="ops-task__actions">
        ${task.status !== "doing" ? `<button data-move="${task.id}" data-to="doing">ابدأ</button>` : ""}
        ${task.status !== "done" ? `<button data-move="${task.id}" data-to="done">خلصت</button>` : `<button data-move="${task.id}" data-to="todo">رجّع</button>`}
        <button data-focus="${task.id}">بومودورو</button>
      </div>
    </div>`;

  const board = columns
    .map(
      ([status, label]) => `<div class="ops-col">
        <div class="ops-col__title">${label} · ${rows.filter((task) => task.status === status).length}</div>
        ${rows.filter((task) => task.status === status).map(card).join("") || '<div class="ops-empty">فاضي</div>'}
      </div>`
    )
    .join("");

  const timer = state.timer;
  const minutes = String(Math.floor(timer.left / 60)).padStart(2, "0");
  const seconds = String(timer.left % 60).padStart(2, "0");
  const taskTitle = timer.taskId ? rows.find((task) => task.id === timer.taskId)?.title : "";

  panel.innerHTML = "";
  panel.append(
    el(`<div class="ops-timer">
      <div class="ops-item__top">
        <span class="ops-timer__clock" data-clock>${minutes}:${seconds}</span>
        <span class="ops-timer__hint">${time.minutes} دقيقة تركيز النهارده · ${time.sessions} جلسة</span>
      </div>
      <div class="ops-timer__bar"><div class="ops-timer__fill" data-fill style="width:${(1 - timer.left / timer.total) * 100}%"></div></div>
      <div class="ops-timer__row">
        <button class="ops-btn" data-timer="toggle">${timer.running ? "إيقاف مؤقت" : "ابدأ"}</button>
        <button class="ops-btn ops-btn--quiet" data-timer="reset">تصفير</button>
        <button class="ops-btn ops-btn--quiet" data-timer="log">سجّل الجلسة</button>
        <select data-timer-length aria-label="مدة الجلسة">
          ${[25, 50, 15].map((value) => `<option value="${value}" ${timer.total === value * 60 ? "selected" : ""}>${value} دقيقة</option>`).join("")}
        </select>
        <span class="ops-timer__hint">${taskTitle ? "على: " + esc(taskTitle) : "بدون مهمة"}</span>
      </div>
    </div>`)
  );

  panel.append(
    el(`<div class="ops-card" style="margin:14px 0">
      <form class="ops-form" data-task-form>
        <div class="ops-form__grid">
          <input name="title" placeholder="مهمة جديدة" required>
          <select name="priority" aria-label="الأولوية">
            <option value="1">عالية</option>
            <option value="2" selected>عادية</option>
            <option value="3">منخفضة</option>
          </select>
        </div>
        <div class="ops-row"><button class="ops-btn" type="submit">إضافة مهمة</button></div>
      </form>
    </div>`)
  );

  panel.append(el(`<div class="ops-board">${board}</div>`));

  $("[data-task-form]", panel).addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    await api("/api/tasks", { method: "POST", body: { title: data.title, priority: Number(data.priority) } });
    toast("المهمة اتضافت");
    render("tasks");
  });

  $$("[data-move]", panel).forEach((button) =>
    button.addEventListener("click", async () => {
      await api(`/api/tasks/${button.dataset.move}`, { method: "PATCH", body: { status: button.dataset.to } });
      render("tasks");
      refreshCounts();
    })
  );

  $$("[data-focus]", panel).forEach((button) =>
    button.addEventListener("click", () => {
      state.timer.taskId = Number(button.dataset.focus);
      render("tasks");
      toast("البومودورو مربوط بالمهمة");
    })
  );

  $$("[data-timer]", panel).forEach((button) =>
    button.addEventListener("click", () => handleTimer(button.dataset.timer))
  );

  $("[data-timer-length]", panel).addEventListener("change", (event) => {
    if (state.timer.running) return;
    state.timer.total = state.timer.left = Number(event.target.value) * 60;
    render("tasks");
  });
}

function paintTimer() {
  const clock = $("[data-clock]");
  const fill = $("[data-fill]");
  const timer = state.timer;
  if (clock) {
    clock.textContent = `${String(Math.floor(timer.left / 60)).padStart(2, "0")}:${String(timer.left % 60).padStart(2, "0")}`;
  }
  if (fill) fill.style.width = `${(1 - timer.left / timer.total) * 100}%`;
}

function handleTimer(action) {
  const timer = state.timer;

  if (action === "toggle") {
    timer.running = !timer.running;
    clearInterval(timer.interval);
    if (timer.running) {
      timer.interval = setInterval(() => {
        if (timer.left > 0) {
          timer.left -= 1;
          paintTimer();
          if (timer.left === 0) handleTimer("complete");
          return;
        }
      }, 1000);
    }
    const button = $('[data-timer="toggle"]');
    if (button) button.textContent = timer.running ? "إيقاف مؤقت" : "ابدأ";
    return;
  }

  if (action === "reset") {
    clearInterval(timer.interval);
    timer.running = false;
    timer.left = timer.total;
    paintTimer();
    const button = $('[data-timer="toggle"]');
    if (button) button.textContent = "ابدأ";
    return;
  }

  if (action === "log" || action === "complete") {
    clearInterval(timer.interval);
    timer.running = false;
    const minutes = Math.max(1, Math.round((timer.total - timer.left) / 60));
    api("/api/time", { method: "POST", body: { minutes, task_id: timer.taskId, label: "pomodoro" } })
      .then(() => {
        toast(`اتسجلت ${minutes} دقيقة`);
        timer.left = timer.total;
        render("tasks");
      })
      .catch(() => toast("التسجيل فشل", "error"));
  }
}
// ── agents ───────────────────────────────────────────────────────────

async function renderAgents() {
  const { rows } = await api("/api/agents");
  state.agents = rows;
  const panel = $('[data-view-panel="agents"]');
  const base = location.origin;

  const cards = rows
    .map(
      (agent) => `<div class="ops-card">
        <div class="ops-item__top">
          <span class="ops-item__name">${esc(agent.name)}</span>
          <span class="ops-badge ${agent.active ? "ops-badge--done" : "ops-badge--lost"}">${agent.active ? "متصل" : "موقوف"}</span>
        </div>
        <div class="ops-item__meta">${esc(agent.model || "أي موديل")} · صلاحيات: ${esc(agent.scopes)} · آخر اتصال: ${esc(agent.last_seen ? when(agent.last_seen) : "لسه")}</div>
        <div class="ops-row" style="margin-top:8px">
          <button class="ops-chip" data-agent-toggle="${agent.id}" data-active="${agent.active ? 0 : 1}">${agent.active ? "إيقاف" : "تشغيل"}</button>
        </div>
      </div>`
    )
    .join("");

  panel.innerHTML = "";
  panel.append(
    el(`<div class="ops-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
      <div class="ops-card">
        <div class="ops-head"><h2>وكيل جديد</h2></div>
        <form class="ops-form" data-agent-form>
          <input name="name" placeholder="اسم الوكيل (مثال: Claude Ops)" required>
          <input name="model" placeholder="الموديل (اختياري)" dir="ltr">
          <select name="scopes" aria-label="الصلاحيات">
            <option value="read">قراءة فقط</option>
            <option value="read,write" selected>قراءة وكتابة</option>
            <option value="read,write,admin">كامل (يقدر يعمل وكلاء)</option>
          </select>
          <div class="ops-row"><button class="ops-btn" type="submit">إنشاء مفتاح</button></div>
        </form>
        <div data-new-key></div>
      </div>

      <div class="ops-card">
        <div class="ops-head"><h2>ازاي توصّل وكيل</h2></div>
        <p class="ops-item__meta" style="margin-bottom:8px">أي وكيل MCP (Claude Code، Cursor، Claude Desktop، أو سكربتك) بيكلمنا على نفس العنوان. المفتاح ده بيدير الطلبات والعملاء والمهام والقنوات، والريبو فيه ملفات جاهزة: <bdi>.mcp.json</bdi> و <bdi>.cursor/mcp.json</bdi> — بس حدّد المفتاح في <bdi>EGYTRONIC_AGENT_KEY</bdi>.</p>
        <pre class="ops-code">export EGYTRONIC_AGENT_KEY=egx_agent_...</pre>
        <pre class="ops-code">claude mcp add --transport http egytronic-ops \\
  ${esc(base)}/mcp \\
  --header "Authorization: Bearer egx_agent_..."</pre>
        <p class="ops-item__meta" style="margin:10px 0 6px">Claude Desktop أو أي عميل بيقرا JSON:</p>
        <pre class="ops-code">{
  "mcpServers": {
    "egytronic-ops": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "${esc(base)}/mcp",
        "--header", "Authorization: Bearer egx_agent_..."
      ]
    }
  }
}</pre>
        <p class="ops-item__meta" style="margin:10px 0 6px">أو REST مباشرة:</p>
        <pre class="ops-code">curl ${esc(base)}/api/context \\
  -H "Authorization: Bearer egx_agent_..."

curl -X POST ${esc(base)}/api/tasks \\
  -H "Authorization: Bearer egx_agent_..." \\
  -H "content-type: application/json" \\
  -d '{"title":"رد على العميل","priority":1}'</pre>
      </div>
    </div>`)
  );

  $$(".ops-code", panel).forEach((pre) => {
    const bar = el(`<div class="ops-code__bar"><button class="ops-chip" type="button">نسخ</button></div>`);
    bar.firstElementChild.addEventListener("click", async () => {
      await navigator.clipboard.writeText(pre.innerText).catch(() => {});
      toast("اتنسخ");
    });
    pre.after(bar);
  });

  if (state.newAgentKey) {
    panel.append(
      el(`<div class="ops-card" style="border-color:var(--gold)">
        <div class="ops-item__meta" style="margin-bottom:8px">المفتاح بيظهر مرة واحدة بس — انسخه دلوقتي:</div>
        <div class="ops-key"><code>${esc(state.newAgentKey)}</code><button class="ops-btn ops-btn--quiet" type="button" data-copy>نسخ</button></div>
      </div>`)
    );
    $("[data-copy]", panel).addEventListener("click", async () => {
      await navigator.clipboard.writeText(state.newAgentKey).catch(() => {});
      toast("المفتاح اتنسخ");
    });
  }

  panel.append(el(`<div class="ops-head" style="margin-top:20px"><h2>الوكلاء المسجلين</h2></div>`));
  panel.append(el(`<div class="ops-list">${cards || '<div class="ops-empty">مفيش وكلاء. اعمل مفتاح وابدأ.</div>'}</div>`));

  $("[data-agent-form]", panel).addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const created = await api("/api/agents", { method: "POST", body: data });
    state.newAgentKey = created.row.key;
    event.target.reset();
    renderAgents();
  });

  $$("[data-agent-toggle]", panel).forEach((button) =>
    button.addEventListener("click", async () => {
      await api(`/api/agents/${button.dataset.agentToggle}`, { method: "PATCH", body: { active: button.dataset.active === "1" } });
      renderAgents();
    })
  );
}

// ── polling: badges + new-lead toast ─────────────────────────────────

function startPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    try {
      const events = await api(`/api/events?after=${state.lastEvent}&limit=10`);
      const fresh = events.rows || [];
      if (fresh.length) {
        state.lastEvent = Math.max(...fresh.map((row) => row.id));
        const lead = fresh.find((row) => row.kind === "inquiry.created");
        if (lead) toast("طلب جديد وصل من الموقع", "ok");
      }
      await refreshCounts();
      if (state.view === "overview") renderOverview();
    } catch {
      $("[data-sync]").dataset.stale = "1";
      $("[data-sync]").textContent = "انقطع الاتصال";
    }
  }, 20000);
}

// ── boot ─────────────────────────────────────────────────────────────

$$(".ops__nav-btn").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
$("[data-lock]").addEventListener("click", () => lock("اتقفلت اللوحة."));

$("[data-rotate]").addEventListener("click", async () => {
  const next = prompt("التوكن الجديد (16 حرف على الأقل). هتحتاجه في الدخول الجاي:");
  if (!next || next.trim().length < 16) return;
  try {
    await api("/api/admin/token", { method: "POST", body: { current: token, next: next.trim() } });
    token = next.trim();
    sessionStorage.setItem(KEY, token);
    toast("التوكن اتغير. احفظه دلوقتي.");
  } catch {
    toast("التغيير فشل", "error");
  }
});
$("[data-refresh]").addEventListener("click", () => {
  refreshCounts();
  render(state.view);
  toast("اتحدث");
});

$("[data-reveal]").addEventListener("click", (event) => {
  const input = $('[data-gate-form] input');
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  event.currentTarget.textContent = show ? "إخفاء" : "إظهار";
});

$("[data-gate-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = event.target.elements.token;
  const candidate = normalize(input.value);
  if (candidate.length < 12) {
    gateStatus.textContent = "التوكن قصير — انسخه كامل.";
    return;
  }
  gateStatus.textContent = "بنتحقق…";
  gateStatus.dataset.tone = "";
  token = candidate;
  try {
    await api("/api/overview");
    sessionStorage.setItem(KEY, token);
    input.value = "";
    gateStatus.textContent = "";
    history.replaceState(null, "", "#/" + state.view);
    await enter();
  } catch (error) {
    if (error.message !== "unauthorized") {
      gateStatus.textContent = "الشبكة مش راضية ترد. جرّب كمان شوية.";
    }
  }
});

window.addEventListener("hashchange", () => {
  const next = location.hash.replace("#/", "") || "overview";
  if (next !== state.view && TITLES[next]) setView(next);
});

(async function boot() {
  if (!token) {
    gate.hidden = false;
    return;
  }
  try {
    const me = await api("/api/overview");
    $("[data-who]").textContent = `${me.who?.name || "—"} · ${me.who?.role === "admin" ? "مدير" : "وكيل"}`;
    await enter();
  } catch {
    lock("");
  }
})();




