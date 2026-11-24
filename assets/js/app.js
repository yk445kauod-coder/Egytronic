import { mountFx, reduced } from "./fx-runner.js";
import { mountPipeline } from "./pipeline.js";
import * as aurora from "../vendor/pixelfx/fx/weather/aurora.js";
import * as energyCore from "../vendor/pixelfx/fx/scifi/energy-core.js";
import * as confetti from "../vendor/pixelfx/fx/ui/confetti.js";
import * as crtOff from "../vendor/pixelfx/fx/transitions/crt-off.js";
import * as digitalRain from "./fx/digital-rain.js";

const GOLD_RAMP = ["#161616", "#202020", "#3d3d3d", "#8a3a00", "#d95a00", "#ffa45c", "#ffd0a8"];
const CORE_RAMP = [
  "#161616",
  "#221a14",
  "#3a2418",
  "#8a3a00",
  "#d95a00",
  "#ff8a3d",
  "#ffd0a8",
  "#ffffff",
];
const BOOT_RAMP = [
  "#161616",
  "#1a1a1a",
  "#202020",
  "#3d3d3d",
  "#d95a00",
  "#ff8a3d",
  "#ffd0a8",
  "#ffffff",
];
const RAIN_RAMP = ["#161616", "#241a12", "#3d2414", "#8a3a00", "#d95a00", "#ffa45c", "#ffe4cd"];
const CONFETTI_RAMP = [
  "#ff6a00",
  "#ffa45c",
  "#ffd0a8",
  "#ffffff",
  "#d9c1a0",
  "#c4c4c4",
  "#ff6b5e",
];

/* ── nav ────────────────────────────────────────────────── */
const toggle = document.querySelector("[data-nav-toggle]");
const links = document.querySelector("[data-nav-links]");

if (toggle && links) {
  const setOpen = (open) => {
    links.dataset.open = String(open);
    toggle.setAttribute("aria-expanded", String(open));
    const label = open ? toggle.dataset.labelClose : toggle.dataset.labelOpen;
    if (label) toggle.setAttribute("aria-label", label);
  };

  toggle.addEventListener("click", () => setOpen(links.dataset.open !== "true"));
  links.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && links.dataset.open === "true") {
      setOpen(false);
      toggle.focus();
    }
  });
}

/* ── hero aurora ────────────────────────────────────────── */
const heroCanvas = document.querySelector("[data-fx='aurora']");
if (heroCanvas) {
  mountFx(heroCanvas, aurora, {
    palette: GOLD_RAMP,
    upper: ["#161616", "#241a12", "#3d2414", "#8a3a00", "#d95a00", "#ffa45c", "#ffe4cd"],
  });
}

/* ── model cartridge ────────────────────────────────────── */
const coreCanvas = document.querySelector("[data-fx='energy-core']");
if (coreCanvas) mountFx(coreCanvas, energyCore, { palette: CORE_RAMP });

/* ── build pipeline ─────────────────────────────────────── */
const pipelineCanvas = document.querySelector("[data-pipeline]");
if (pipelineCanvas) mountPipeline(pipelineCanvas);

/* ── scroll reveal ──────────────────────────────────────── */
const revealables = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
  );
  revealables.forEach((el) => {
    const group = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    el.style.setProperty("--i", String(Math.min(Math.max(group.indexOf(el), 0), 5)));
    io.observe(el);
  });
} else {
  revealables.forEach((el) => el.classList.add("in"));
}

/* ── copy the e-mail ────────────────────────────────────── */
const copyButton = document.querySelector("[data-copy-mail]");
if (copyButton) {
  const note = document.querySelector("[data-copy-note]");
  const address = copyButton.dataset.copyMail;

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(address);
      if (note) {
        note.textContent = note.dataset.message || "تم نسخ البريد الإلكتروني";
        window.setTimeout(() => (note.textContent = ""), 1600);
      }
    } catch {
      window.location.href = `mailto:${address}`;
    }
  });
}

/* ── code rain behind the contact panel ─────────────────── */
const rainCanvas = document.querySelector("[data-fx='rain']");
if (rainCanvas) mountFx(rainCanvas, digitalRain, { palette: RAIN_RAMP, speed: 0.9 });
/* ── confetti on the contact panel ──────────────────────── */
const ctaCanvas = document.querySelector("[data-fx='confetti']");
if (ctaCanvas) {
  let fireworks = null;
  const burst = () => {
    if (!fireworks) {
      fireworks = mountFx(ctaCanvas, confetti, { palette: CONFETTI_RAMP });
      return;
    }
    fireworks.play();
  };

  document.querySelectorAll("[data-confetti]").forEach((el) => {
    el.addEventListener("click", burst);
  });
}

/* ── CRT boot ───────────────────────────────────────────── */
const boot = document.querySelector(".boot");
if (boot) {
  const done = () => {
    boot.classList.add("is-done");
    document.documentElement.classList.add("ui-ready");
  };
  if (reduced()) done();
  else {
    const canvas = boot.querySelector("canvas");
    const runner = mountFx(canvas, crtOff, { speed: 2.2, palette: BOOT_RAMP });
    window.setTimeout(() => {
      runner.stop();
      done();
    }, 1020);
  }
}

/* ── scroll rail + hero parallax ────────────────────────── */
const rail = document.querySelector(".rail i");
const parallax = [...document.querySelectorAll("[data-parallax]")];
const calm = reduced();

const paint = () => {
  const y = window.scrollY;
  if (rail) {
    const span = document.documentElement.scrollHeight - window.innerHeight;
    rail.style.transform = `scaleX(${span > 0 ? Math.min(y / span, 1) : 0})`;
  }
  if (!calm && y < window.innerHeight * 1.2) {
    for (const el of parallax) {
      const k = parseFloat(el.dataset.parallax) || 0;
      const shift = Math.min(y * k, 48).toFixed(1);
      el.style.transform = `translate3d(0, ${shift}px, 0) scale(var(--px-scale, 1))`;
    }
  }
};

if (rail || parallax.length) {
  let queued = false;
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      paint();
    });
  };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  paint();
}

/* ── active section in the nav ──────────────────────────── */
const navLinks = [...document.querySelectorAll(".nav-links a[href^='#']")];
if (navLinks.length && "IntersectionObserver" in window) {
  const watched = navLinks
    .map((link) => ({ link, section: document.querySelector(link.getAttribute("href")) }))
    .filter((item) => item.section);

  const seen = new Map();
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) seen.set(entry.target, entry.intersectionRatio);
      let best = null;
      let ratio = 0;
      for (const [section, value] of seen) {
        if (value > ratio) {
          ratio = value;
          best = section;
        }
      }
      for (const { link, section } of watched) {
        link.classList.toggle("is-active", section === best && ratio > 0.05);
      }
    },
    { threshold: [0.05, 0.25, 0.5, 0.75] },
  );
  watched.forEach(({ section }) => spy.observe(section));
}

/* ── footer year ────────────────────────────────────────── */
const year = document.querySelector("[data-year]");
if (year) year.textContent = String(new Date().getFullYear());
