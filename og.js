var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// jsx-runtime.js
var require_jsx_runtime = __commonJS({
  "jsx-runtime.js"(exports2, module2) {
    function jsx2(type, props) {
      const { children, ...rest } = props || {};
      return { type, props: { ...rest, children } };
    }
    module2.exports = { jsx: jsx2, jsxs: jsx2, Fragment: "Fragment" };
  }
});

// og.jsx
var import_jsx_runtime = __toESM(require_jsx_runtime());
var { default: satori } = require("satori");
var { Resvg } = require("@resvg/resvg-js");
var fs = require("fs");
var path = require("path");
var interRegular = fs.readFileSync(path.join(__dirname, "fonts/Inter-Regular.ttf"));
var interBold = fs.readFileSync(path.join(__dirname, "fonts/Inter-Bold.ttf"));
var WIDTH = 1200;
var HEIGHT = 630;
function NoteBar({ midi, duration, maxDuration }) {
  const height = Math.max(10, Math.min(100, duration / maxDuration * 100));
  const hue = (midi - 48) / 36 * 120;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    width: "6px",
    height: `${height}px`,
    backgroundColor: `hsl(${hue}, 80%, 55%)`,
    borderRadius: "3px",
    flexShrink: "0"
  } });
}
function Visualization({ events }) {
  if (!events || events.length === 0) return null;
  const notes = [];
  const openNotes = {};
  for (const e of events) {
    if (e.type === "on") {
      openNotes[e.midi] = e.time;
    } else if (e.type === "off" && openNotes[e.midi] !== void 0) {
      notes.push({ midi: e.midi, start: openNotes[e.midi], duration: e.time - openNotes[e.midi] });
      delete openNotes[e.midi];
    }
  }
  if (notes.length === 0) return null;
  const maxDuration = Math.max(...notes.map((n) => n.duration));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    width: "600px",
    height: "120px",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: "3px"
  }, children: notes.slice(0, 60).map((note, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoteBar, { midi: note.midi, duration: note.duration, maxDuration }, i)) });
}
function OgCard({ songTitle, instrument, events }) {
  const displayInstrument = instrument ? instrument.replace(/_/g, " ") : null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "60px",
    fontFamily: "Inter"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "#00ff40", fontSize: "28px", fontWeight: 700, letterSpacing: "3px", marginBottom: "30px" }, children: "LUMITONE" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "#fff", fontSize: "48px", fontWeight: 700, textAlign: "center", marginBottom: "16px", maxWidth: "900px" }, children: songTitle }),
    displayInstrument && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "#888", fontSize: "24px", marginBottom: "40px" }, children: displayInstrument }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Visualization, { events })
  ] });
}
async function generateOgImage(songTitle, instrument, events) {
  const svg = await satori(
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OgCard, { songTitle, instrument, events }),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "Inter", data: interRegular, weight: 400, style: "normal" },
        { name: "Inter", data: interBold, weight: 700, style: "normal" }
      ]
    }
  );
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } });
  return resvg.render().asPng();
}
module.exports = { generateOgImage };
