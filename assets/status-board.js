/* =====================================================================
   Split-flap status board: turns the plain table that Quarto renders
   (from data/projects.yml via _templates/status-board.ejs) into flap
   tiles, then runs the "flip" animation.

   Without JavaScript the table still shows as plain text.
   ===================================================================== */
(function () {
  "use strict";

  const POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // characters shown while flipping
  const TICK_MS = 70;       // time between flips
  const MAX_TICKS = 40;     // the animation stops after this many flips
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const show = (ch) => (ch === " " ? " " : ch); // keep blank tiles from collapsing

  // Build the tiles for one board and return a list of them for animating.
  function build(board) {
    const rows = Array.from(board.querySelectorAll(".sb-row"));
    const widths = {}; // longest text in each column, so the columns line up

    rows.forEach((row) => {
      row.querySelectorAll("td[data-col]").forEach((td) => {
        const text = td.textContent.trim();
        td.dataset.text = text;
        widths[td.dataset.col] = Math.max(widths[td.dataset.col] || 0, text.length);
      });
    });

    // Tell the CSS how many characters wide the board is, so the tiles fit.
    const root = board.querySelector(".sb-board");
    const total = Object.values(widths).reduce((a, b) => a + b, 0);
    root.style.setProperty("--total-chars", total);
    root.style.setProperty("--cols", Object.keys(widths).length);
    root.style.setProperty("--project-chars", widths.project || 17);
    root.style.setProperty("--theme-chars", widths.theme || 12);
    root.style.setProperty("--eta-chars", widths.eta || 8);

    const tiles = [];
    rows.forEach((row, r) => {
      row.querySelectorAll("td[data-col]").forEach((td, c) => {
        const original = td.dataset.text;
        const target = original.toUpperCase().padEnd(widths[td.dataset.col], " ");

        const text = document.createElement("span"); // for screen readers
        text.className = "sb-text";
        text.textContent = original;

        const flaps = document.createElement("span"); // what you see
        flaps.className = "sb-flaps";
        flaps.setAttribute("aria-hidden", "true");

        Array.from(target).forEach((ch, i) => {
          const tile = document.createElement("span");
          tile.className = "sb-tile";
          const glyph = document.createElement("span");
          glyph.className = "sb-glyph";
          glyph.textContent = show(ch);
          tile.appendChild(glyph);
          flaps.appendChild(tile);
          tiles.push({
            glyph: glyph,
            ch: ch,
            // when this tile stops on its real character: staggered but repeatable
            settle: 6 + ((r * 11 + c * 5 + i * 7) % 26),
            seed: i * 13 + r * 5 + c * 3,
          });
        });

        // If the cell holds a link (rows with a `path` in the YAML), keep the
        // link and put the tiles inside it; otherwise fill the cell directly.
        const link = td.querySelector("a");
        if (link) {
          link.replaceChildren(text, flaps);
        } else {
          td.replaceChildren(text, flaps);
        }
      });
    });
    return tiles;
  }

  function animate(board, tiles) {
    clearInterval(board._sbTimer);
    if (reduceMotion) return; // the tiles already show the final text

    let tick = 0;
    board._sbTimer = setInterval(() => {
      tick += 1;
      tiles.forEach((t) => {
        const next = tick >= t.settle ? t.ch : POOL[(tick * 7 + t.seed) % POOL.length];
        const shown = show(next);
        if (t.glyph.textContent !== shown) {
          t.glyph.textContent = shown;
          // a quick squash-and-stretch that reads as a flap falling
          if (t.glyph.animate) {
            t.glyph.animate(
              [{ transform: "scaleY(0.15)" }, { transform: "scaleY(1)" }],
              { duration: TICK_MS - 10, easing: "ease-out" }
            );
          }
        }
      });
      if (tick >= MAX_TICKS) clearInterval(board._sbTimer);
    }, TICK_MS);
  }

  function init() {
    document.querySelectorAll("[data-status-board]").forEach((board) => {
      const tiles = build(board);

      // Whole-row click: forward to the row's link (Safari can't stretch a link over a <tr>)
      board.querySelectorAll(".sb-row").forEach((row) => {
        const link = row.querySelector("a.sb-link");
        if (!link) return;
        row.addEventListener("click", (e) => {
          if (e.target.closest("a") || window.getSelection().toString()) return; // real link click, or selecting text
          if (e.metaKey || e.ctrlKey) window.open(link.href, "_blank");
          else window.location.href = link.href;
        });
      });

      animate(board, tiles);
      const replay = board.querySelector(".sb-replay");
      if (replay) {
        if (reduceMotion) replay.hidden = true;
        replay.addEventListener("click", () => animate(board, tiles));
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
