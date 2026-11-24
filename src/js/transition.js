import { mountFx, reduced } from "./fx-runner.js";
import * as pixelDissolve from "../vendor/pixelfx/fx/transitions/pixel-dissolve.js";

/* Page changes leave through the same pixel grid the brand is built on: a fixed overlay
   plays the dissolve while the next document loads underneath. Reduced motion and any
   link we cannot honour (new tab, download, modifier, other origin) navigate normally. */

const RAMP = ["#161616", "#1d1d1d", "#3d3d3d", "#8a3a00", "#d95a00", "#ffa45c", "#ffd0a8"];
const SPEED = 3.4;
const COVER_AT = 330;

const skip = (event, link) => {
  if (event.defaultPrevented || event.button !== 0) return true;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
  if (!link || link.target || link.hasAttribute("download")) return true;
  let url;
  try {
    url = new URL(link.href);
  } catch {
    return true;
  }
  if (url.origin !== location.origin) return true;
  if (!/^https?:$/.test(url.protocol)) return true;
  if (url.pathname === location.pathname && url.search === location.search) return true;
  return false;
};

export function mountPageTransitions() {
  if (typeof document === "undefined" || reduced()) return;
  if (!document.body) return;

  let layer = null;
  let runner = null;

  const build = () => {
    layer = document.createElement("div");
    layer.className = "page-fx";
    layer.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    layer.append(canvas);
    document.body.append(layer);
    let mounted = null;
    return {
      show() {
        layer.classList.add("is-on");
        if (!mounted) mounted = mountFx(canvas, pixelDissolve, { palette: RAMP, speed: SPEED, paused: true });
        mounted.play();
      },
      hide() {
        layer.classList.remove("is-on");
        mounted?.stop();
      },
    };
  };

  let fx = null;
  let leaving = false;

  const reset = () => {
    leaving = false;
    fx?.hide();
  };

  document.addEventListener("click", (event) => {
    if (leaving) return;
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (skip(event, link)) return;

    event.preventDefault();
    leaving = true;
    fx = fx || build();
    fx.show();

    window.setTimeout(() => {
      location.assign(link.href);
      // a cancelled navigation must not leave the blocks on screen
      window.setTimeout(reset, 1600);
    }, COVER_AT);
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) reset();
  });
}
