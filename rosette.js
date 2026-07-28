/*
 * rosette.js — the guilloche.
 *
 * This is the one drawing on the site, and it does two jobs at once so that
 * the brand mark and the data visualisation are the same object:
 *
 *   FIELD    a security-print rosette. N wavy petals whose centres sit on a
 *            ring, the construction used on banknotes and share certificates.
 *            Its DENSITY encodes composite risk. More risk means more curves,
 *            tighter waves, heavier ink. Nothing here is ever coloured red —
 *            a high-risk rosette reads as "measured precisely", not as an
 *            accusation, which matters when this ends up on a slide.
 *
 *   PROFILE  a closed curve through six radii, one per scored dimension,
 *            smoothed with a periodic Catmull-Rom so it reads as an engraved
 *            lobe rather than a spiky radar polygon. This is the risk profile.
 *
 * Both layers are driven from the same DIMENSIONS array in data.js, so the
 * picture cannot drift from the numbers.
 *
 * Animation is done by CSS. Everything the timeline needs is exposed as the
 * custom property --p (0 → 1) on the container: the field reveals petal by
 * petal off --p, and the profile draws on via stroke-dashoffset off --p.
 * main.js decides whether --p is driven by a scroll timeline, a one-shot
 * reveal, or pinned at 1 for reduced motion. This file never animates.
 *
 * Classic script, not a module. Exposes window.Rosette.
 */

(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  /* Geometry constants, in viewBox units. The viewBox is 220 square, centred,
     so 100 is the nominal outer edge and there is a little air beyond it. */
  var VIEW      = 110;  /* half the viewBox */
  var RING      = 38;   /* radius of the circle the petal centres sit on */
  var PETAL     = 52;   /* radius of one petal — RING + PETAL is the outer edge */
  var PROF_IN   = 22;   /* profile radius at the bottom of the domain */
  var PROF_OUT  = 84;   /* profile radius at 100 */
  var TICK_R    = 94;   /* the graduated ring */

  /*
   * Scores are mapped from 30 rather than 0. Real assessments cluster in the
   * 55-95 band, and mapping the full 0-100 range squeezes that cluster into a
   * few units of radius — the six lobes come out as an almost perfect circle
   * and the shape stops carrying information. The floor is stated here rather
   * than hidden so the distortion is on the record: anything at or below 30
   * sits on the inner limit.
   */
  var DOMAIN_LO = 30;

  /* Six axes, starting at the top and running clockwise. */
  var AXES = 6;
  var A0   = -90;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function rad(deg) { return (deg * Math.PI) / 180; }
  function round(n, p) { var f = Math.pow(10, p || 2); return Math.round(n * f) / f; }

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) {
      if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    }
    return node;
  }

  /* ------------------------------------------------------------- the field --
   * How risk becomes ink. Every one of these is a straight interpolation on
   * risk/100, so the relationship stays legible: denser and tighter is worse.
   */
  function fieldParams(risk) {
    var t = clamp01(risk / 100);
    return {
      count:   Math.round(lerp(20, 64, t)),   /* how many petals */
      waves:   Math.round(lerp(6, 14, t)),    /* crests per petal */
      amp:     lerp(0.020, 0.048, t),         /* how deep the crests cut */
      ink:     lerp(0.26, 0.72, t),           /* group opacity */
      weight:  lerp(0.28, 0.42, t),           /* stroke width */
    };
  }

  /* One petal: a circle of radius PETAL with `waves` sinusoidal crests. */
  function petalPath(waves, amp) {
    var steps = 240, d = "", i, phi, r, x, y;
    for (i = 0; i <= steps; i++) {
      phi = (i / steps) * Math.PI * 2;
      r = PETAL * (1 + amp * Math.sin(waves * phi));
      x = round(r * Math.cos(phi));
      y = round(r * Math.sin(phi));
      d += (i === 0 ? "M" : "L") + x + " " + y;
    }
    return d + "Z";
  }

  /* ----------------------------------------------------------- the profile --
   * A closed periodic Catmull-Rom through the six score vertices, converted to
   * cubic beziers. Always six segments, whatever the scores, so the `d`
   * attribute keeps a stable command structure and CSS can transition it when
   * the impact machine changes the numbers.
   */
  function radiusFor(score) {
    return lerp(PROF_IN, PROF_OUT, clamp01(((score || 0) - DOMAIN_LO) / (100 - DOMAIN_LO)));
  }

  function vertices(scores) {
    var pts = [], i, r, a;
    for (i = 0; i < AXES; i++) {
      r = radiusFor(scores[i]);
      a = rad(A0 + i * (360 / AXES));
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return pts;
  }

  function profilePath(pts, tension) {
    var t = tension === undefined ? 0.88 : tension;
    var n = pts.length, d = "M" + round(pts[0][0]) + " " + round(pts[0][1]), i;
    for (i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n],
          p1 = pts[i],
          p2 = pts[(i + 1) % n],
          p3 = pts[(i + 2) % n];
      var c1x = p1[0] + ((p2[0] - p0[0]) / 6) * t,
          c1y = p1[1] + ((p2[1] - p0[1]) / 6) * t,
          c2x = p2[0] - ((p3[0] - p1[0]) / 6) * t,
          c2y = p2[1] - ((p3[1] - p1[1]) / 6) * t;
      d += "C" + round(c1x) + " " + round(c1y) + "," +
                 round(c2x) + " " + round(c2y) + "," +
                 round(p2[0]) + " " + round(p2[1]);
    }
    return d + "Z";
  }

  /* --------------------------------------------------------------- ticks -- */
  function tickMarks(g) {
    for (var i = 0; i < 60; i++) {
      var a = rad(i * 6 - 90);
      var major = i % 5 === 0;
      var r1 = TICK_R, r2 = TICK_R + (major ? 6 : 3);
      g.appendChild(el("line", {
        x1: round(r1 * Math.cos(a)), y1: round(r1 * Math.sin(a)),
        x2: round(r2 * Math.cos(a)), y2: round(r2 * Math.sin(a)),
        class: major ? "ros__tick ros__tick--maj" : "ros__tick",
      }));
    }
  }

  /* =========================================================== the builder == */

  /*
   * opts:
   *   dims      array of {key,label,short,score,fails,probes}  (defaults to DIMENSIONS)
   *   risk      composite 0-100                                 (defaults to SCORES.adjusted)
   *   annotate  render axis labels + hit targets                (default false)
   *   reading   show the composite in the middle                (default true)
   *   label     the caption under the reading                   (default "RISK")
   */
  function create(host, opts) {
    opts = opts || {};
    var dims  = opts.dims || (typeof DIMENSIONS !== "undefined" ? DIMENSIONS : []);
    var risk  = opts.risk === undefined
      ? (typeof SCORES !== "undefined" ? SCORES.adjusted : 0)
      : opts.risk;
    var showReading = opts.reading !== false;

    host.classList.add("ros");
    host.innerHTML = "";

    var uid = "ros" + Math.random().toString(36).slice(2, 8);

    /* Annotated variants get a roomier viewBox so the drawing shrinks inside
       the same square and the axis labels have somewhere to sit that isn't
       on top of the engraving. */
    var view = opts.annotate ? 142 : VIEW;

    var svg = el("svg", {
      class: "ros__svg",
      viewBox: -view + " " + -view + " " + view * 2 + " " + view * 2,
      "aria-hidden": "true",
      focusable: "false",
    });

    var defs  = el("defs");
    var petal = el("path", { id: uid + "-petal", class: "ros__petal" });
    defs.appendChild(petal);

    /* The centre is wiped back to the ground so the reading stays legible on
       top of the engraving — the same thing a certificate does to clear space
       for its denomination. Soft-edged, so it reads as a wipe, not a sticker. */
    var grad = el("radialGradient", { id: uid + "-knock" });
    [["0%", 1], ["52%", 0.96], ["78%", 0.62], ["100%", 0]].forEach(function (s) {
      grad.appendChild(el("stop", {
        offset: s[0], "stop-color": "var(--ros-ground, #FAFCFB)", "stop-opacity": s[1],
      }));
    });
    defs.appendChild(grad);
    svg.appendChild(defs);

    /* --- field ------------------------------------------------------------ */
    var field = el("g", { class: "ros__field" });
    svg.appendChild(field);

    /* --- graduated ring --------------------------------------------------- */
    var ticks = el("g", { class: "ros__ticks" });
    tickMarks(ticks);
    svg.appendChild(ticks);

    /* --- spokes ----------------------------------------------------------- */
    var spokes = el("g", { class: "ros__spokes" });
    for (var s = 0; s < AXES; s++) {
      var sa = rad(A0 + s * (360 / AXES));
      spokes.appendChild(el("line", {
        x1: 0, y1: 0,
        x2: round(TICK_R * Math.cos(sa)), y2: round(TICK_R * Math.sin(sa)),
      }));
    }
    svg.appendChild(spokes);

    /* --- profile ---------------------------------------------------------- */
    /* Two ghosted echoes under the main stroke give it the doubled look of an
       engraved plate. They are the same path scaled, so they cost nothing. */
    var prof = el("g", { class: "ros__profile" });
    var echo2 = el("path", { class: "ros__echo", transform: "scale(1.045)" });
    var echo1 = el("path", { class: "ros__echo", transform: "scale(0.955)" });
    var fill  = el("path", { class: "ros__fill" });
    var line  = el("path", { class: "ros__line" });
    prof.appendChild(echo2);
    prof.appendChild(echo1);
    prof.appendChild(fill);
    prof.appendChild(line);
    svg.appendChild(prof);

    /* --- vertices --------------------------------------------------------- */
    var dots = el("g", { class: "ros__dots" });
    svg.appendChild(dots);

    /* --- the amber mark on the worst axis --------------------------------- */
    var mark = el("g", { class: "ros__mark" });
    svg.appendChild(mark);

    /* --- centre wipe, last so it sits over the engraving ------------------- */
    if (showReading) {
      svg.appendChild(el("circle", {
        class: "ros__knock", cx: 0, cy: 0, r: 34,
        fill: "url(#" + uid + "-knock)",
      }));
    }

    host.appendChild(svg);

    /* --- reading ---------------------------------------------------------- */
    var readEl = null;
    if (showReading) {
      var read = document.createElement("div");
      read.className = "ros__read";
      read.innerHTML =
        '<span class="ros__num" data-ros-num>0</span>' +
        '<span class="ros__unit">/100</span>' +
        '<span class="ros__lab">' + (opts.label || "Risk") + "</span>";
      host.appendChild(read);
      readEl = read.querySelector("[data-ros-num]");
    }

    /* --- annotations ------------------------------------------------------ */
    var labelEls = [];
    if (opts.annotate) {
      var wrap = document.createElement("div");
      wrap.className = "ros__labels";
      /* Sit just outside the graduated ring. The ring is at TICK_R of `view`
         half-units, which is (TICK_R/view) of the container's half-width. */
      var LR = ((TICK_R + 16) / view) * 50;
      dims.forEach(function (d, i) {
        var a = rad(A0 + i * (360 / AXES));
        var lx = 50 + Math.cos(a) * LR;
        var ly = 50 + Math.sin(a) * LR;
        var b = document.createElement("button");
        b.type = "button";
        b.className = "ros__label";
        b.dataset.axis = d.key;
        b.style.left = round(lx, 1) + "%";
        b.style.top  = round(ly, 1) + "%";
        b.setAttribute("aria-label", d.label + ", risk " + d.score + " of 100");
        b.innerHTML =
          '<span class="ros__lname">' + (d.short || d.label) + "</span>" +
          '<span class="ros__lscore">' + d.score + "</span>";
        wrap.appendChild(b);
        labelEls.push(b);
      });
      host.appendChild(wrap);
    }

    /* ------------------------------------------------------------- render -- */
    var current = { dims: dims, risk: risk };

    function paint(next, animate) {
      var d = next.dims, r = next.risk;
      var scores = d.map(function (x) { return x.score; });
      var fp = fieldParams(r);

      /* field */
      petal.setAttribute("d", petalPath(fp.waves, fp.amp));
      field.style.setProperty("--ros-ink", round(fp.ink, 3));
      field.style.setProperty("--ros-weight", round(fp.weight, 3));
      field.style.setProperty("--ros-n", fp.count);

      var have = field.childNodes.length;
      var i, use;
      for (i = have; i < fp.count; i++) {
        use = el("use", { href: "#" + uid + "-petal" });
        /* Safari still wants the namespaced form as well. */
        use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#" + uid + "-petal");
        field.appendChild(use);
      }
      while (field.childNodes.length > fp.count) field.removeChild(field.lastChild);

      for (i = 0; i < fp.count; i++) {
        var ang = (i * 360) / fp.count;
        field.childNodes[i].setAttribute(
          "transform", "rotate(" + round(ang, 2) + ") translate(" + RING + " 0)"
        );
        field.childNodes[i].style.setProperty("--ros-i", i);
      }

      /* profile */
      var pts = vertices(scores);
      var pd  = profilePath(pts);
      echo1.setAttribute("d", pd);
      echo2.setAttribute("d", pd);
      fill.setAttribute("d", pd);
      line.setAttribute("d", pd);
      try {
        host.style.setProperty("--ros-len", Math.ceil(line.getTotalLength()));
      } catch (e) {
        host.style.setProperty("--ros-len", 700);
      }

      /* vertices */
      while (dots.firstChild) dots.removeChild(dots.firstChild);
      pts.forEach(function (p) {
        dots.appendChild(el("circle", { cx: round(p[0]), cy: round(p[1]), r: 2 }));
      });

      /* The amber mark calls out the highest-risk axis: one unbroken leader
         from that vertex out through the graduated ring, so it reads as a
         callout rather than a stray tick. */
      while (mark.firstChild) mark.removeChild(mark.firstChild);
      var worst = 0;
      for (i = 1; i < d.length; i++) if (d[i].score > d[worst].score) worst = i;
      var wa = rad(A0 + worst * (360 / AXES));
      var wr = radiusFor(d[worst].score);
      mark.appendChild(el("line", {
        x1: round(wr * Math.cos(wa)), y1: round(wr * Math.sin(wa)),
        x2: round((TICK_R + 8) * Math.cos(wa)), y2: round((TICK_R + 8) * Math.sin(wa)),
      }));
      mark.appendChild(el("circle", {
        cx: round(wr * Math.cos(wa)), cy: round(wr * Math.sin(wa)),
        r: 3.4, class: "ros__markdot",
      }));

      /* reading */
      if (readEl && !animate) readEl.textContent = Math.round(r);

      current = { dims: d, risk: r };
    }

    paint(current, false);

    return {
      node: host,
      svg: svg,
      labels: labelEls,
      readingEl: readEl,
      get risk() { return current.risk; },
      /* Repaint from new numbers. The profile `d` and the field opacity both
         carry CSS transitions, so this reads as a morph, not a redraw. */
      update: function (next) {
        paint({
          dims: next && next.dims ? next.dims : current.dims,
          risk: next && next.risk !== undefined ? next.risk : current.risk,
        }, true);
      },
      /* Set the reading without repainting the geometry — used by the counter. */
      setReading: function (v) { if (readEl) readEl.textContent = Math.round(v); },
      /* Dim every lobe but one. Pass null to clear. */
      isolate: function (key) {
        if (!key) { host.removeAttribute("data-isolate"); return; }
        host.setAttribute("data-isolate", key);
        var idx = current.dims.findIndex(function (x) { return x.key === key; });
        host.style.setProperty("--ros-iso", idx < 0 ? 0 : A0 + idx * (360 / AXES));
      },
    };
  }

  window.Rosette = { create: create, fieldParams: fieldParams };
})();
