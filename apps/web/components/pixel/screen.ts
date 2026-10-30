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
  // Adaptive squircle icon background
  const bg = app === "calendar" ? "#f1f5f9" : accent;
  round(c, x, y, 74, 74, 24, bg);

  c.strokeStyle = app === "calendar" ? "#0f172a" : "#ffffff";
  c.lineWidth = 3;
  c.fillStyle = app === "calendar" ? "#0f172a" : "#ffffff";

  if (app === "calendar") {
    // Pixel Calendar Icon
    c.strokeRect(x + 18, y + 18, 38, 38);
    c.fillStyle = "#38bdf8";
    c.fillRect(x + 18, y + 18, 38, 10);
    c.fillStyle = "#0f172a";
    c.font = "bold 20px Arial";
    c.textAlign = "center";
    c.fillText("29", x + 37, y + 48);
  } else if (app === "browser") {
    // Pixel Chrome/Browser Globe
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
    // Pixel Files Folder
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
    // Terminal / Tools
    c.font = "bold 26px monospace";
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

      // Chapter 0: Minimalist Nexus / Pixel boot & welcome sequence
      if (chapter === 0) {
        c.fillStyle = "#030816";
        c.fillRect(0, 0, W, H);

        // Radiant cyan ambient orb
        const glow = c.createRadialGradient(240, 460, 10, 240, 460, 140);
        glow.addColorStop(0, "rgba(56, 189, 248, 0.25)");
        glow.addColorStop(1, "transparent");
        c.fillStyle = glow;
        c.fillRect(100, 320, 280, 280);

        c.strokeStyle = state.accent;
        c.lineWidth = 4;
        c.beginPath();
        c.ellipse(240, 460, 60, 24, -0.6, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.arc(240, 460, 24, 0, Math.PI * 2);
        c.stroke();

        c.fillStyle = "#f0f6fc";
        c.textAlign = "center";
        c.font = "700 42px Arial";
        c.fillText("NEXOS", 240, 565);
        c.font = "500 18px Arial";
        c.fillStyle = "#94a3b8";
        c.fillText(
          state.unlocked ? "Welcome to your workspace" : "Android, reimagined.",
          240,
          605,
        );
        c.font = "12px Arial";
        c.fillStyle = "#38bdf8";
        c.fillText("WELCOME CONCEPT · NOT AN OS BOOT", 240, 990);
        return finish();
      }

      const text = state.dark ? "#f0f6fc" : "#091e42";
      c.clearRect(0, 0, W, H);

      // Deep dark blue Material You wallpaper with soft organic curves
      c.fillStyle = state.dark ? "#040916" : "#e0eeff";
      c.fillRect(0, 0, W, H);

      const gradient = c.createLinearGradient(0, 0, W, H);
      gradient.addColorStop(0, state.accent);
      gradient.addColorStop(0.5, state.dark ? "#1d4ed8" : "#93c5fd");
      gradient.addColorStop(1, state.dark ? "#091b3e" : "#dbeafe");
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

      // Secondary floating cyan curve
      c.fillStyle = state.dark ? "#0b2046" : "#bfdbfe";
      c.beginPath();
      c.ellipse(40, 920, 420, 410, 0.35, 0, Math.PI * 2);
      c.fill();

      // Top status bar (Pixel style)
      c.fillStyle = text;
      c.textAlign = "left";
      c.font = "600 20px Arial";
      c.fillText("9:41", 36, 44);

      // Status icons: 5G, Wi-Fi, battery pill
      c.textAlign = "right";
      c.font = "500 14px Arial";
      c.fillText("5G  100%", 444, 44);

      // Pixel "At a Glance" Weather & Date Widget
      c.textAlign = "left";
      c.font = "500 17px Arial";
      c.fillStyle = state.dark ? "#7dd3fc" : "#0284c7";
      c.fillText("Thursday, Oct 29 · 21°C Clear", 40, 95);

      // Pixel Signature Dual-Row Lockscreen Clock
      c.fillStyle = text;
      c.font = "300 138px Arial";
      c.fillText("09", 36, 235);
      c.fillText("41", 36, 368);

      c.font = "600 16px Arial";
      c.fillStyle = state.dark ? "#94a3b8" : "#475569";
      c.fillText("THURSDAY, OCTOBER 29", 40, 416);

      // Floating Glass Feature Card (Superconscious & Video Reference Style)
      round(
        c,
        28,
        475,
        424,
        146,
        30,
        state.dark ? "rgba(7, 18, 44, 0.88)" : "rgba(255, 255, 255, 0.88)",
      );
      c.strokeStyle = state.dark
        ? "rgba(56, 189, 248, 0.22)"
        : "rgba(37, 99, 235, 0.2)";
      c.lineWidth = 1.5;
      c.stroke();

      c.fillStyle = text;
      c.font = "bold 28px Arial";
      c.fillText(state.name.slice(0, 23), 50, 522);

      c.font = "18px Arial";
      c.fillStyle = state.dark ? "#7dd3fc" : "#0369a1";
      c.fillText(
        chapter === 4
          ? `Preset: ${state.preset}`
          : chapter === 5
            ? "Owned drafts. Verified sessions."
            : chapter === 6
              ? "Configuration draft · build unverified"
              : "Your Android. Your Rules.",
        50,
        560,
      );

      c.font = "14px Arial";
      c.fillStyle = state.dark ? "#94a3b8" : "#64748b";
      c.fillText(
        chapter === 4
          ? "Configuration intent · no benchmarks"
          : "Visual concept · not a running Android OS",
        50,
        592,
      );

      // App state tracking for smooth entrance animation
      if (currentApps.join() !== state.apps.join()) {
        previousApps = currentApps;
        currentApps = [...state.apps];
        changedAt = motion;
      }
      const fraction =
        motion === 0 ? 1 : Math.min(1, Math.max(0, (motion - changedAt) / 0.3));
      const eased = fraction * fraction * (3 - 2 * fraction);

      // Applications Drawer / Section
      if (chapter === 3) {
        round(
          c,
          18,
          635 + (1 - eased) * 30,
          444,
          275,
          32,
          state.dark ? "rgba(8, 20, 48, 0.9)" : "rgba(240, 246, 255, 0.9)",
        );
        c.fillStyle = text;
        c.font = "600 17px Arial";
        c.fillText("YOUR APPLICATIONS", 40, 865);
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
          672 + (before < 0 ? (1 - eased) * 16 : 0),
          state.accent,
          opacity,
        );
      });

      // Chapter 4: Performance card
      if (chapter === 4) {
        round(
          c,
          28,
          794,
          424,
          100,
          24,
          state.dark ? "rgba(9, 22, 54, 0.88)" : "rgba(241, 245, 249, 0.9)",
        );
        c.fillStyle = text;
        c.font = "bold 19px Arial";
        c.fillText("CONFIGURATION INTENT", 50, 835);
        c.font = "15px Arial";
        c.fillStyle = state.dark ? "#94a3b8" : "#64748b";
        c.fillText("No kernel or clock changes applied", 50, 866);
      }

      // Chapters 5 & 6: Verification & Compilation cards
      if (chapter === 5 || chapter === 6) {
        round(
          c,
          28,
          786,
          424,
          132,
          24,
          state.dark ? "rgba(9, 22, 54, 0.92)" : "rgba(241, 245, 249, 0.92)",
        );
        c.fillStyle = text;
        c.font = "bold 18px Arial";
        c.fillText(
          chapter === 5 ? "SERVER-VERIFIED SESSIONS" : "CONFIGURATION SUMMARY",
          48,
          820,
        );
        c.font = "15px Arial";
        c.fillStyle = state.dark ? "#94a3b8" : "#64748b";
        c.fillText(
          chapter === 5
            ? "Projects are scoped to their owner"
            : `${state.apps.length} selected apps · ${state.dark ? "Dark" : "Light"}`,
          48,
          854,
        );
        c.fillStyle = state.dark ? "#38bdf8" : "#0284c7";
        c.fillText("COMPILATION UNAVAILABLE", 48, 888);
      }

      // Pixel Lock icon
      c.strokeStyle = text;
      c.lineWidth = 4;
      c.beginPath();
      c.roundRect(224, 960, 32, 26, 5);
      c.stroke();
      c.beginPath();
      c.arc(
        240,
        958,
        12,
        Math.PI,
        state.unlocked ? Math.PI * 1.8 : Math.PI * 2,
      );
      c.stroke();

      // Bottom gesture pill bar
      round(c, 180, 1042, 120, 4, 2, text);

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
