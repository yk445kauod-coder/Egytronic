/* Inquiry board. The read token never leaves sessionStorage; every fetch is a
   single GET to /api/inquiries, so opening the board costs one D1 SELECT. */
const KEY = "egytronic.admin.token";
const PACKAGES = {
  logo: "لوجو",
  landing: "لاندنج بيدج",
  static: "موقع ستاتيك",
  identity: "هوية كاملة",
  dynamic: "موقع ديناميك",
  transform: "تحول كامل",
};

const root = document.querySelector(".admin");
const gate = document.querySelector("[data-gate]");
const gateForm = document.querySelector("[data-gate-form]");
const gateStatus = document.querySelector("[data-gate-status]");
const panel = document.querySelector("[data-panel]");
const list = document.querySelector("[data-list]");
const status = document.querySelector("[data-status]");
const count = document.querySelector("[data-count]");
const rowTemplate = document.querySelector("[data-row]");
const search = document.querySelector("[data-search]");
const lock = document.querySelector("[data-lock]");

let rows = [];
let token = "";

const say = (node, text) => {
  if (node) node.textContent = text;
};

const escape = (value) => String(value ?? "");

function render() {
  const term = (search?.value || "").trim().toLowerCase();
  const shown = term
    ? rows.filter((r) =>
        [r.name, r.email, r.phone, r.message, PACKAGES[r.package] || r.package]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term))
    : rows;

  list.textContent = "";
  if (!shown.length) {
    say(status, rows.length ? "مفيش طلبات مطابقة للبحث." : "مفيش طلبات لسه.");
    count.textContent = "0";
    return;
  }

  say(status, "");
  count.textContent = String(shown.length);

  for (const row of shown) {
    const node = rowTemplate.content.cloneNode(true);
    const set = (field, value, prop = "textContent") => {
      const el = node.querySelector(`[data-field="${field}"]`);
      if (el) el[prop] = escape(value);
    };

    set("name", row.name);
    set("created_at", (row.created_at || "").replace(" ", " · "));
    set("message", row.message);
    set("package", PACKAGES[row.package] || row.package || "غير محدد");

    const email = node.querySelector('[data-field="email"]');
    email.textContent = row.email;
    email.href = `mailto:${row.email}`;

    if (row.phone) {
      const phone = node.querySelector('[data-field="phone"]');
      phone.textContent = row.phone;
      phone.href = `https://wa.me/${row.phone.replace(/[^\d]/g, "")}`;
      phone.hidden = false;
    }

    list.append(node);
  }
}

function csv() {
  const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const head = ["id", "created_at", "name", "email", "phone", "package", "message"];
  const lines = [head.join(",")].concat(
    rows.map((r) => head.map((k) => cell(k === "package" ? PACKAGES[r.package] || r.package : r[k])).join(","))
  );
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `egytronic-inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function load(current) {
  token = current;
  say(status, "بنجيب الطلبات…");

  try {
    const response = await fetch(`/api/inquiries?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (response.status === 404) {
      sessionStorage.removeItem(KEY);
      showGate("التوكن مش صح. جرّب تاني.");
      return;
    }
    if (!response.ok) {
      say(status, "الطلبات مش متاحة دلوقتي. جرّب تحديث بعد شوية.");
      return;
    }

    const data = await response.json();
    rows = Array.isArray(data.rows) ? data.rows : [];
    sessionStorage.setItem(KEY, token);
    gate.hidden = true;
    panel.hidden = false;
    lock.hidden = false;
    render();
  } catch {
    say(status, "مفيش اتصال بالشبكة.");
  }
}

function showGate(message) {
  panel.hidden = true;
  lock.hidden = true;
  gate.hidden = false;
  say(gateStatus, message || "");
  gateForm.querySelector("input").focus();
}

gateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = gateForm.querySelector("input").value.trim();
  if (!value) return say(gateStatus, "اكتب التوكن الأول.");
  say(gateStatus, "");
  load(value);
});

search.addEventListener("input", render);
document.querySelector("[data-reload]").addEventListener("click", () => load(token));
document.querySelector("[data-csv]").addEventListener("click", csv);
lock.addEventListener("click", () => {
  sessionStorage.removeItem(KEY);
  rows = [];
  gateForm.reset();
  showGate("اتقفلت. التوكن اتشال من التاب.");
});

const saved = sessionStorage.getItem(KEY);
if (saved) load(saved)

/* Token rotation: one POST, then the session moves to the new token. */
const rotateForm = document.querySelector("[data-rotate-form]");
const rotateStatus = document.querySelector("[data-rotate-status]");

if (rotateForm) {
  rotateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const next = rotateForm.elements.next.value.trim();
    const confirm = rotateForm.elements.confirm.value.trim();

    if (next.length < 16) return say(rotateStatus, "التوكن الجديد لازم 16 حرف على الأقل.");
    if (next !== confirm) return say(rotateStatus, "التوكنين مش زي بعض.");

    try {
      const response = await fetch("/api/admin/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current: token, next }),
      });
      if (!response.ok) return say(rotateStatus, "مقدرناش نحفظ التوكن. جرّب تاني.");

      sessionStorage.setItem(KEY, next);
      token = next;
      rotateForm.reset();
      say(rotateStatus, "التوكن اتغيّر. أي تاب تاني هيتقفل.");
    } catch {
      say(rotateStatus, "مفيش اتصال بالشبكة.");
    }
  });
}
