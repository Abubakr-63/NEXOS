import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";

// Reuse the existing web app's React/Lucide and Next.js image tooling.
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { Orbit } = require("lucide-react");
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp = nextRequire("sharp");
const orbit = renderToStaticMarkup(
  createElement(Orbit, {
    x: 10,
    y: 10,
    width: 44,
    height: 44,
    color: "#38bdf8",
    strokeWidth: 1.7,
    "aria-hidden": true,
  }),
);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>NEXOS</title><rect width="64" height="64" rx="16" fill="#101d35"/>${orbit}</svg>\n`;
await writeFile(new URL("../apps/web/app/icon.svg", import.meta.url), svg);
const png = await sharp(Buffer.from(svg)).resize(32, 32).png().toBuffer();
// ICO container with a standard PNG image entry.
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 32;
header[7] = 32;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile(
  new URL("../apps/web/app/favicon.ico", import.meta.url),
  Buffer.concat([header, png]),
);
