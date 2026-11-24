import { useEffect, useRef } from "react";
import { mountFx, reduced } from "../js/fx-runner";
import * as crtOff from "../vendor/pixelfx/fx/transitions/crt-off.js";

const RAMP = ["#161616", "#1a1a1a", "#202020", "#3d3d3d", "#d95a00", "#ff8a3d", "#ffd0a8", "#ffffff"];

export default function Boot() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".boot");
    if (!root || !canvas.current) return;
    const done = () => {
      root.classList.add("is-done");
      document.documentElement.classList.add("ui-ready");
    };
    if (reduced()) {
      done();
      return;
    }
    const runner = mountFx(canvas.current, crtOff, { speed: 2.2, palette: RAMP });
    const timer = window.setTimeout(() => {
      runner.stop();
      done();
    }, 1020);
    return () => {
      window.clearTimeout(timer);
      runner.stop();
    };
  }, []);

  return (
    <div className="boot" aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  );
}
