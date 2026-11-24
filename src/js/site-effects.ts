import { mountFx, reduced } from "./fx-runner.js";
import { mountPipeline } from "./pipeline.js";
import * as aurora from "../vendor/pixelfx/fx/weather/aurora.js";
import * as energyCore from "../vendor/pixelfx/fx/scifi/energy-core.js";
import * as confetti from "../vendor/pixelfx/fx/ui/confetti.js";
import * as digitalRain from "./fx/digital-rain.js";
import { mountPageTransitions } from "./transition.js";

const GOLD_RAMP = ["#161616", "#202020", "#3d3d3d", "#8a3a00", "#d95a00", "#ffa45c", "#ffd0a8"];
const CORE_RAMP = ["#161616", "#221a14", "#3a2418", "#8a3a00", "#d95a00", "#ff8a3d", "#ffd0a8", "#ffffff"];
const RAIN_RAMP = ["#161616", "#241a12", "#3d2414", "#8a3a00", "#d95a00", "#ffa45c", "#ffe4cd"];
const CONFETTI_RAMP = ["#ff6a00", "#ffa45c", "#ffd0a8", "#ffffff", "#d9c1a0", "#c4c4c4", "#ff6b5e"];

type Ctx = { stop: () => void; play: () => void };

/** Everything the pages need from the DOM: PixelFx canvases, scroll choreography, transitions. */
export function mountSiteEffects(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];
  const on = (target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };
  const runners: Array<{ stop: () => void }> = [];

  const heroCanvas = root.querySelector<HTMLCanvasElement>("[data-fx='aurora']");
  if (heroCanvas) {
    runners.push(
      mountFx(heroCanvas, aurora, {
        palette: GOLD_RAMP,
        upper: ["#161616", "#241a12", "#3d2414", "#8a3a00", "#d95a00", "#ffa45c", "#ffe4cd"],
      }),
    );
  }

  const coreCanvas = root.querySelector<HTMLCanvasElement>("[data-fx='energy-core']");
  if (coreCanvas) runners.push(mountFx(coreCanvas, energyCore, { palette: CORE_RAMP }));

  const rail = root.querySelector<HTMLElement>(".rail i");
  const parallax = [...root.querySelectorAll<HTMLElement>("[data-parallax]")];
  const calm = reduced();

  const paint = () => {
    const y = window.scrollY;
    if (rail) {
      const span = document.documentElement.scrollHeight - window.innerHeight;
      rail.style.transform = `scaleX(${span > 0 ? Math.min(y / span, 1) : 0})`;
    }
    if (!calm && y < window.innerHeight * 1.2) {
      for (const el of parallax) {
        const k = parseFloat(el.dataset.parallax || "0") || 0;
        const shift = Math.min(y * k, 48).toFixed(1);
        el.style.transform = `translate3d(0, ${shift}px, 0) scale(var(--px-scale, 1))`;
      }
    }
  };

  const pipelineCanvas = root.querySelector<HTMLCanvasElement>("[data-pipeline]");
  const pipeline = pipelineCanvas ? mountPipeline(pipelineCanvas) : null;
  if (pipeline) cleanups.push(() => pipeline.stop?.());

  const stepItems = [...root.querySelectorAll<HTMLElement>(".steps li")];
  let stage = -1;
  const syncStage = () => {
    if (!pipeline || !stepItems.length) return;
    const mid = window.innerHeight * 0.45;
    let best = -1;
    let distance = Infinity;
    stepItems.forEach((item, i) => {
      const box = item.getBoundingClientRect();
      const d = Math.abs(box.top + box.height / 2 - mid);
      if (box.bottom > 0 && box.top < window.innerHeight && d < distance) {
        distance = d;
        best = i;
      }
    });
    if (best === stage) return;
    stage = best;
    pipeline.setStage(best);
    stepItems.forEach((item, i) => item.classList.toggle("is-active", i === best));
  };

  let queued = false;
  const ask = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      paint();
      syncStage();
    });
  };
  on(window, "scroll", ask, { passive: true });
  on(window, "resize", ask);

  /* reveal: stagger by sibling index, keep content visible without JS */
  const revealables = [...root.querySelectorAll<HTMLElement>(".reveal")];
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
      const group = [...(el.parentElement?.children ?? [])].filter((c) => c.classList.contains("reveal"));
      el.style.setProperty("--i", String(Math.min(Math.max(group.indexOf(el), 0), 5)));
      io.observe(el);
    });
    cleanups.push(() => io.disconnect());
  } else {
    revealables.forEach((el) => el.classList.add("in"));
  }

  const copyButton = root.querySelector<HTMLElement>("[data-copy-mail]");
  if (copyButton) {
    const note = root.querySelector<HTMLElement>("[data-copy-note]");
    const address = copyButton.dataset.copyMail || "";
    const flash = (text: string) => {
      if (!note) return;
      note.textContent = text;
      window.setTimeout(() => (note.textContent = ""), 2400);
    };
    on(copyButton, "click", async () => {
      try {
        await navigator.clipboard.writeText(address);
        flash(note?.dataset.message || "تم نسخ البريد");
      } catch {
        flash(note?.dataset.fail || "تعذّر النسخ. انسخ البريد يدويًا.");
      }
    });
  }

  const rainCanvas = root.querySelector<HTMLCanvasElement>("[data-fx='rain']");
  if (rainCanvas) runners.push(mountFx(rainCanvas, digitalRain, { palette: RAIN_RAMP, speed: 0.9 }));

  const ctaCanvas = root.querySelector<HTMLCanvasElement>("[data-fx='confetti']");
  if (ctaCanvas) {
    let fireworks: Ctx | null = null;
    const burst = () => {
      if (!fireworks) {
        fireworks = mountFx(ctaCanvas, confetti, { palette: CONFETTI_RAMP });
        return;
      }
      fireworks.play();
    };
    root.querySelectorAll("[data-confetti]").forEach((el) => on(el, "click", burst));
  }

  const navLinks = [...root.querySelectorAll<HTMLAnchorElement>(".nav-links a[href^='#'], .site-footer a[href^='#']")];
  if (navLinks.length && "IntersectionObserver" in window) {
    const watched = navLinks
      .map((link) => ({ link, section: root.querySelector(link.getAttribute("href") || "") }))
      .filter((item): item is { link: HTMLAnchorElement; section: Element } => Boolean(item.section));
    if (watched.length) {
      const seen = new Map<Element, number>();
      const spy = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) seen.set(entry.target, entry.intersectionRatio);
          let best: Element | null = null;
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
      cleanups.push(() => spy.disconnect());
    }
  }

  const year = root.querySelector<HTMLElement>("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  mountPageTransitions();
  ask();
  syncStage();

  return () => {
    runners.forEach((runner) => runner.stop());
    cleanups.forEach((fn) => fn());
  };
}
