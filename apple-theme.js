/* ============================================================
   DUCAR Priority Studio — Apple-style visual refresh (JS pass)
   Handles what CSS alone cannot reach: literal hex `fill`
   attributes set by the chart-rendering code on SVG shapes, and
   the active nav icon color set inline by the preserved bundle.
   Idempotent + MutationObserver-driven so it keeps working across
   tab switches, data reloads and re-renders.
   ============================================================ */
(function () {
  "use strict";

  var COLOR_MAP = {
    "#278a50": "#278a50", // green    -> systemGreen
    "#16a34a": "#278a50",
    "#5f8f2f": "#0f8fa8", // lime     -> systemTeal-ish (kept distinct from green)
    "#a3e635": "#0f8fa8",
    "#b77900": "#b77900", // yellow   -> systemYellow
    "#facc15": "#b77900",
    "#c75a24": "#c75a24", // orange   -> systemOrange
    "#fb923c": "#c75a24",
    "#c43d4d": "#c43d4d", // red      -> systemRed
    "#dc2626": "#c43d4d",
    "#0ea5e9": "#2563eb", // sky      -> systemBlue (brand)
    "#38bdf8": "#2563eb",
    "#8b5cf6": "#7258b7", // violet   -> systemPurple
    "#a78bfa": "#7258b7",
    "#ec4899": "#b83d6b", // pink     -> systemPink
    "#f472b6": "#b83d6b",
    "#06b6d4": "#0f8fa8", // cyan     -> systemTeal
    "#eab90a": "#b77900"
  };

  function remapAttr(el, attrName) {
    var v = el.getAttribute(attrName);
    if (!v) return;
    var lower = v.toLowerCase();
    var mapped = COLOR_MAP[lower];
    if (mapped && v !== mapped) {
      el.setAttribute(attrName, mapped);
    }
  }

  function pass(root) {
    var scope = root || document;
    var shapes = scope.querySelectorAll ? scope.querySelectorAll("rect, path, circle, polygon, line") : [];
    for (var i = 0; i < shapes.length; i++) {


    }














  }

  function schedule() {
    if (schedule._t) return;
    schedule._t = setTimeout(function () {
      schedule._t = null;
      pass(document);
    }, 60);
  }

  function start() {
    pass(document);
    var mo = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === "attributes" && (m.attributeName === "fill" || m.attributeName === "stroke")) continue; // avoid self-trigger loops
        schedule();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
