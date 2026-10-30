import type { PixelScreenState } from "./adapter";
const W = 480,
  H = 1066;
const round = (
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) => {
  c.fillStyle = fill;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
};
function icon(
  c: CanvasRenderingContext2D,
  app: string,
  x: number,
  y: number,
  accent: string,
  opacity = 1,
) {
  c.save();
  c.globalAlpha = opacity;
  round(c, x, y, 74, 74, 25, app === "calendar" ? "#e5d8bd" : accent);
  c.strokeStyle = "#142532";
  c.lineWidth = 3;
  c.fillStyle = "#142532";
  if (app === "calendar") {
    c.strokeRect(x + 18, y + 19, 38, 38);
    c.fillRect(x + 18, y + 26, 38, 5);
    c.font = "bold 22px Arial";
    c.textAlign = "center";
    c.fillText("29", x + 37, y + 51);
  } else if (app === "browser") {
    c.beginPath();
    c.arc(x + 37, y + 37, 20, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.ellipse(x + 37, y + 37, 9, 20, 0, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(x + 17, y + 37);
    c.lineTo(x + 57, y + 37);
    c.stroke();
  } else if (app === "files") {
    c.beginPath();
    c.moveTo(x + 17, y + 23);
    c.lineTo(x + 32, y + 23);
    c.lineTo(x + 38, y + 29);
    c.lineTo(x + 58, y + 29);
    c.lineTo(x + 58, y + 54);
    c.lineTo(x + 17, y + 54);
    c.closePath();
    c.stroke();
  } else {
    c.font = "28px monospace";
    c.textAlign = "center";
    c.fillText(">_", x + 37, y + 47);
  }
  c.restore();
}
export function createScreen(scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Screen composition unavailable");
  c.scale(scale, scale);
  const previousFrame = document.createElement("canvas");
  previousFrame.width = canvas.width;
  previousFrame.height = canvas.height;
  const previousContext = previousFrame.getContext("2d");
  let lastState = "",
    paletteAt = -Infinity;
  let lastSignature = "";
  let currentApps: readonly string[] = [],
    previousApps: readonly string[] = [];
  let changedAt = 0;
  return {
    canvas,
    draw(state: PixelScreenState, progress: number, motion: number) {
      const chapter = Math.min(6, Math.floor(progress * 6 + 0.001));
      const signature = JSON.stringify([
        state,
        chapter,
        Math.round(motion * 20),
      ]);
      if (signature === lastSignature) return false;
      lastSignature = signature;
      const nextState = JSON.stringify([state, chapter]);
      if (nextState !== lastState) {
        if (lastState && previousContext && motion !== 0) {
          previousContext.clearRect(0, 0, W, H);
          previousContext.drawImage(canvas, 0, 0);
          paletteAt = motion;
        }
        lastState = nextState;
      }
      const finish = () => {
        const amount =
          motion === 0
            ? 1
            : Math.min(1, Math.max(0, (motion - paletteAt) / 0.3));
        if (amount < 1) {
          c.save();
          c.globalAlpha = 1 - amount;
          c.drawImage(previousFrame, 0, 0, W, H);
          c.restore();
        }
        return true;
      };
      if (chapter === 0) {
        c.fillStyle = "#0b1421";
        c.fillRect(0, 0, W, H);
        c.strokeStyle = state.accent;
        c.lineWidth = 4;
        c.beginPath();
        c.ellipse(240, 460, 60, 24, -0.6, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.arc(240, 460, 24, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = "#edf2fa";
        c.textAlign = "center";
        c.font = "500 40px Arial";
        c.fillText("NEXOS", 240, 570);
        c.font = "18px Arial";
        c.fillText(
          state.unlocked ? "Welcome to your workspace" : "Android, reimagined.",
          240,
          610,
        );
        c.font = "13px Arial";
        c.fillStyle = "#a1acbf";
        c.fillText("WELCOME CONCEPT · NOT AN OS BOOT", 240, 990);
        return finish();
      }
      const text = state.dark ? "#edf2fa" : "#142737";
      c.clearRect(0, 0, W, H);
      c.fillStyle = state.dark ? "#0c1a2a" : "#d9e6eb";
      c.fillRect(0, 0, W, H);
      const gradient = c.createLinearGradient(0, 0, W, H);
      gradient.addColorStop(0, state.accent);
      gradient.addColorStop(1, state.dark ? "#13263e" : "#e0ebe9");
      c.fillStyle = gradient;
      c.beginPath();
      c.ellipse(
        420 + Math.sin(motion) * 20,
        360,
        330,
        490,
        -0.5,
        0,
        Math.PI * 2,
      );
      c.fill();
      c.fillStyle = state.dark ? "#19354a" : "#b6cdd6";
      c.beginPath();
      c.ellipse(40, 920, 420, 410, 0.35, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = text;
      c.textAlign = "left";
      c.font = "500 21px Arial";
      c.fillText("9:41", 35, 45);
      c.font = "18px Arial";
      c.fillText("NEXOS", 355, 45);
      c.font = "300 142px Arial";
      c.fillText("09", 36, 244);
      c.fillText("41", 36, 380);
      c.font = "500 17px Arial";
      c.fillText("THURSDAY, OCTOBER 29", 42, 426);
      round(c, 28, 488, 424, 144, 35, state.dark ? "#122436e8" : "#f5f9f4e8");
      c.fillStyle = text;
      c.font = "bold 29px Arial";
      c.fillText(state.name.slice(0, 23), 52, 536);
      c.font = "19px Arial";
      c.fillText(
        chapter === 4
          ? `Preset: ${state.preset}`
          : chapter === 5
            ? "Owned drafts. Verified sessions."
            : chapter === 6
              ? "Configuration draft · build unverified"
              : "Your Android. Your Rules.",
        52,
        575,
      );
      c.font = "15px Arial";
      c.fillText(
        chapter === 4
          ? "Configuration intent · no benchmarks"
          : "Visual concept · not a running Android OS",
        52,
        607,
      );
      if (currentApps.join() !== state.apps.join()) {
        previousApps = currentApps;
        currentApps = [...state.apps];
        changedAt = motion;
      }
      const fraction =
        motion === 0 ? 1 : Math.min(1, Math.max(0, (motion - changedAt) / 0.3));
      const eased = fraction * fraction * (3 - 2 * fraction);
      if (chapter === 3) {
        round(
          c,
          18,
          640 + (1 - eased) * 30,
          444,
          270,
          35,
          state.dark ? "#102236ed" : "#edf4f7ed",
        );
        c.fillStyle = text;
        c.font = "17px Arial";
        c.fillText("YOUR APPLICATIONS", 40, 868);
      }
      const union = [...new Set([...previousApps, ...currentApps])];
      union.forEach((app) => {
        const before = previousApps.indexOf(app),
          after = currentApps.indexOf(app);
        const from = before < 0 ? after : before,
          to = after < 0 ? before : after;
        const opacity = after < 0 ? 1 - eased : before < 0 ? eased : 1;
        icon(
          c,
          app,
          28 + (from + (to - from) * eased) * 108,
          676 + (before < 0 ? (1 - eased) * 16 : 0),
          state.accent,
          opacity,
        );
      });
      if (chapter === 4) {
        round(c, 28, 794, 424, 100, 25, state.dark ? "#122436dd" : "#f5f9f4dd");
        c.fillStyle = text;
        c.font = "19px Arial";
        c.fillText("CONFIGURATION INTENT", 50, 835);
        c.font = "15px Arial";
        c.fillText("No kernel or clock changes applied", 50, 866);
      }
      if (chapter === 5 || chapter === 6) {
        round(c, 28, 786, 424, 132, 24, state.dark ? "#122436e8" : "#f5f9f4e8");
        c.fillStyle = text;
        c.font = "18px Arial";
        c.fillText(
          chapter === 5 ? "SERVER-VERIFIED SESSIONS" : "CONFIGURATION SUMMARY",
          48,
          820,
        );
        c.font = "15px Arial";
        c.fillText(
          chapter === 5
            ? "Projects are scoped to their owner"
            : `${state.apps.length} selected apps · ${state.dark ? "Dark" : "Light"}`,
          48,
          854,
        );
        c.fillText("COMPILATION UNAVAILABLE", 48, 888);
      }
      c.strokeStyle = text;
      c.lineWidth = 4;
      c.beginPath();
      c.roundRect(224, 964, 32, 26, 5);
      c.stroke();
      c.beginPath();
      c.arc(
        240,
        962,
        12,
        Math.PI,
        state.unlocked ? Math.PI * 1.8 : Math.PI * 2,
      );
      c.stroke();
      round(c, 180, 1045, 120, 4, 2, text);
      return finish();
    },
    dispose() {
      previousFrame.width =
        previousFrame.height =
        canvas.width =
        canvas.height =
          0;
    },
  };
}
