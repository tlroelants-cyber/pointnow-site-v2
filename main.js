/*
 * main.js — rendering and behaviour.
 *
 * Everything the page shows is built here from data.js, so there is exactly
 * one place a number can live. Nothing in this file invents a value.
 *
 * Motion follows one metaphor — scrolling the page is the plate being inked
 * and the document issued — and uses exactly two mechanisms:
 *
 *   entrances   IntersectionObserver adds .is-in, CSS does the rest. One
 *               shot, never reversed, universally supported.
 *   scrubs      the custom properties --p (rosette draw) and --ink (§11
 *               colour) are driven by CSS scroll-driven timelines where the
 *               engine has them, and by the rAF fallback at the bottom of
 *               this file where it doesn't. html.no-sdt selects which.
 *
 * Classic script, not a module, so index.html opens straight off the
 * filesystem. data.js and rosette.js have already run.
 */

(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SDT = window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()") && !REDUCED;
  if (!SDT) document.documentElement.classList.add("no-sdt");

  /* Things whose value is a function of scroll position. Registered by the
     sections that own them, applied by the loop at the bottom of this file.
     Declared here because sections register into it as they initialise. */
  var scrubbers = [];

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }

  /* ═══════════════════════════════════════════════════════════ entrances ══ */

  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

  function observeReveals(root) {
    $$(".rise, .wipe", root).forEach(function (n) {
      if (n.classList.contains("is-in")) return;
      revealIO.observe(n);
    });
  }

  /* ═════════════════════════════════════════════════════════════════ nav ══ */

  (function nav() {
    var bar = $("#nav"), burger = $("#burger"), links = $("#navlinks");

    var stickIO = new IntersectionObserver(function (e) {
      bar.classList.toggle("is-stuck", !e[0].isIntersecting);
    }, { rootMargin: "-72px 0px 0px 0px" });
    stickIO.observe($("#top"));

    /* The sheet only exists below this width. Above it the same element is the
       ordinary desktop nav and must never be inert. */
    var narrow = window.matchMedia("(max-width: 860px)");

    function syncInert() {
      links.inert = narrow.matches && burger.getAttribute("aria-expanded") !== "true";
    }
    narrow.addEventListener("change", syncInert);

    function setOpen(open) {
      burger.setAttribute("aria-expanded", String(open));
      links.classList.toggle("is-open", open);
      document.body.style.overflow = open ? "hidden" : "";
      syncInert();
      if (!open) return;
      var first = links.querySelector("a");
      if (first) first.focus();
    }

    syncInert();

    burger.addEventListener("click", function () {
      setOpen(burger.getAttribute("aria-expanded") !== "true");
    });

    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (burger.getAttribute("aria-expanded") === "true") { setOpen(false); burger.focus(); }
    });

    /* Keep tab order inside the sheet while it is open. */
    links.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || burger.getAttribute("aria-expanded") !== "true") return;
      var items = $$("a, button", links).filter(function (n) { return n.offsetParent !== null; });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  })();

  /* ════════════════════════════════════════════════════════════ mailto ══ */

  (function mailto() {
    $$("[data-mailto]").forEach(function (a) {
      var m = MAILTO[a.dataset.mailto] || MAILTO.general;
      a.href = "mailto:" + CONFIG.email +
        "?subject=" + encodeURIComponent(m.subject) +
        "&body=" + encodeURIComponent(m.body);
    });
    $$("[data-mailto-text]").forEach(function (a) { a.textContent = CONFIG.email; });
  })();

  /* ═══════════════════════════════════════════════════════════ rosettes ══ */

  var rosettes = {};

  $$("[data-ros]").forEach(function (host) {
    var kind = host.dataset.ros;
    rosettes[kind] = Rosette.create(host, {
      annotate: kind === "axes",
      reading: kind !== "stage",
      label: "Risk",
    });
  });

  /* The hero draws itself in on load — the page's opening move. Everything
     else either scrubs on scroll or is already final. */
  (function heroDraw() {
    var host = rosettes.hero && rosettes.hero.node;
    if (!host) return;
    if (REDUCED) {
      host.style.setProperty("--p", 1);
      rosettes.hero.setReading(SCORES.adjusted);
      return;
    }
    host.style.setProperty("--p", 0);
    rosettes.hero.setReading(0);
    requestAnimationFrame(function () {
      host.style.transition = "--p 1500ms cubic-bezier(.22,.68,.28,1) 220ms";
      host.style.setProperty("--p", 1);
      countTo(rosettes.hero.readingEl, 0, SCORES.adjusted, 1500, 220, 0);
    });
  })();

  /* ═════════════════════════════════════════════════════════════ §3 why ══ */

  (function timeline() {
    $("#timeline").innerHTML = TIMELINE.map(function (t) {
      return '<li class="beat rise' + (t.now ? " beat--now" : "") + '">' +
        '<span class="beat__dot"></span>' +
        '<p class="beat__date">' + esc(t.date) + "</p>" +
        '<h3 class="h4">' + esc(t.title) + "</h3>" +
        '<p class="beat__body">' + esc(t.body) +
          (t.cite ? '<a class="cite" href="#sources" aria-label="Source ' + t.cite + '">' + t.cite + "</a>" : "") +
        "</p></li>";
    }).join("");
    $$("#timeline .beat").forEach(function (n, i) { n.style.setProperty("--d", i * 70 + "ms"); });
  })();

  function countTo(el, from, to, dur, delay, decimals) {
    if (!el) return;
    if (REDUCED) { el.textContent = to.toFixed(decimals || 0); return; }
    var t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = clamp((ts - t0 - (delay || 0)) / dur, 0, 1);
      /* ease-out so the last digits settle rather than snap */
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = (from + (to - from) * e).toFixed(decimals || 0);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  (function stats() {
    $("#stats").innerHTML = EVIDENCE.map(function (s, i) {
      return '<div class="stat rise" style="--d:' + i * 70 + 'ms">' +
        '<p class="stat__v">' + esc(s.prefix) + '<span data-count>0</span>' + esc(s.suffix) + "</p>" +
        '<p class="stat__l">' + esc(s.label) + "</p>" +
        '<p class="stat__s">' + esc(s.source) + "</p>" +
        "</div>";
    }).join("");

    /* Render order matches EVIDENCE, so the index is the lookup. */
    var once = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        $$("[data-count]", e.target).forEach(function (n, i) {
          var s = EVIDENCE[i];
          countTo(n, 0, s.value, 1100, i * 90, s.decimals || 0);
        });
        once.unobserve(e.target);
      });
    }, { threshold: 0.3 });
    once.observe($("#stats"));
  })();

  /* ════════════════════════════════════════════════════════ §4 incident ══ */

  $("#beats").innerHTML = INCIDENT_BEATS.map(function (b, i) {
    return '<li class="rise" style="--d:' + i * 80 + 'ms"><span>' + b + "</span></li>";
  }).join("");

  (function replay() {
    var log = $("#replay-log"), again = $("#replay-again"), note = $("#replay-note");
    var timers = [];

    function clear() { timers.forEach(clearTimeout); timers = []; log.innerHTML = ""; }
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function bubble(cls, html) {
      var d = document.createElement("div");
      d.className = "msg " + cls;
      d.innerHTML = html;
      log.appendChild(d);
      return d;
    }

    function type(node, text, speed, done) {
      var i = 0;
      node.innerHTML = '<span class="caret"></span>';
      (function tick() {
        i += 1;
        node.innerHTML = esc(text.slice(0, i)) + (i < text.length ? '<span class="caret"></span>' : "");
        if (i < text.length) timers.push(setTimeout(tick, speed));
        else if (done) at(320, done);
      })();
    }

    function finish() {
      bubble("msg--sys",
        "verdict · fail — " + esc(REPLAY.rationale) +
        "<br>severity " + esc(REPLAY.severity) + " · " + REPLAY.latencyMs + "ms");
      again.hidden = false;
      note.hidden = false;
      observeReveals(note.parentNode);
    }

    function run() {
      clear();
      again.hidden = true;
      if (REDUCED) {
        bubble("msg--user", esc(REPLAY.prompt));
        bubble("msg--bot", esc(REPLAY.reply));
        finish();
        return;
      }
      at(240, function () {
        var u = bubble("msg--user", "");
        type(u, REPLAY.prompt, 9, function () {
          var b = bubble("msg--bot", "");
          type(b, REPLAY.reply, 13, finish);
        });
      });
    }

    again.addEventListener("click", run);

    var io = new IntersectionObserver(function (e) {
      if (!e[0].isIntersecting) return;
      run();
      io.disconnect();
    }, { threshold: 0.35 });
    io.observe($("#replay"));
  })();

  /* ═══════════════════════════════════════════════════════════ §6 steps ══ */

  (function steps() {
    $("#steps").innerHTML = STEPS.map(function (s) {
      return '<article class="step rise" data-step="' + s.key + '">' +
        '<p class="step__n">' + s.n + "</p>" +
        '<h3 class="h3">' + esc(s.title) + "</h3>" +
        '<p class="step__lead">' + esc(s.lead) + "</p>" +
        '<p class="step__body">' + esc(s.body) + "</p>" +
        '<p class="step__out">' + esc(s.out) + "</p>" +
        "</article>";
    }).join("");

    var panes = $$("#stage .stage__pane");
    var items = $$("#steps .step");

    function activate(key) {
      items.forEach(function (n) { n.classList.toggle("is-active", n.dataset.step === key); });
      panes.forEach(function (n) { n.classList.toggle("is-on", n.dataset.pane === key); });
    }
    activate("audit");

    if (REDUCED) { items.forEach(function (n) { n.classList.add("is-active"); }); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) activate(e.target.dataset.step);
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    items.forEach(function (n) { io.observe(n); });
  })();

  /* ═══════════════════════════════════════════════════════ §7 the machine ══ */

  /*
   * Reproduces lib/impact.ts on the page: a per-dimension multiplier from Q7,
   * a global ceiling from Q2, and an oversight dampener from Q10.
   *
   * The dimension risks in data.js are already impact-adjusted at the tool's
   * own initial answers, so the base risks are recovered by dividing those
   * multipliers back out. The composite is then expressed as a ratio against
   * the initial aggregate, which means the starting reading is exactly
   * SCORES.adjusted — the tool's verified output — with no fudge factor, and
   * every movement from there is the real multiplier response.
   */
  (function machine() {
    var state = {
      action: IMPACT.action.initial,
      ceiling: IMPACT.ceiling.initial,
      oversight: IMPACT.oversight.initial,
    };

    function mult(group, value) {
      var found = IMPACT[group].options.filter(function (o) { return o.value === value; })[0];
      return found ? found.mult : 1;
    }

    var INIT = {
      action: mult("action", IMPACT.action.initial),
      ceiling: mult("ceiling", IMPACT.ceiling.initial),
      oversight: mult("oversight", IMPACT.oversight.initial),
    };

    /* Back out the base risk each dimension carried before impact. */
    var BASE = DIMENSIONS.map(function (d) {
      var dim = d.key === IMPACT.action.dimension ? INIT.action : 1;
      return d.score / (dim * INIT.ceiling * INIT.oversight);
    });

    var WEIGHT = DIMENSIONS.map(function (d) { return d.probes; });
    var WSUM = WEIGHT.reduce(function (a, b) { return a + b; }, 0);

    function evaluate(s) {
      var a = mult("action", s.action),
          c = mult("ceiling", s.ceiling),
          o = mult("oversight", s.oversight);
      var dims = DIMENSIONS.map(function (d, i) {
        var dm = d.key === IMPACT.action.dimension ? a : 1;
        return Object.assign({}, d, { score: Math.round(clamp(BASE[i] * dm * c * o, 0, 100)) });
      });
      var agg = dims.reduce(function (t, d, i) { return t + d.score * WEIGHT[i]; }, 0) / WSUM;
      return { dims: dims, agg: agg };
    }

    var INITIAL = evaluate(state);

    function render() {
      var r = evaluate(state);
      var risk = Math.round(clamp(SCORES.adjusted * (r.agg / INITIAL.agg), 0, 100));
      rosettes.machine.update({ dims: r.dims, risk: risk });
      rosettes.machine.setReading(risk);

      var worst = r.dims.reduce(function (a, b) { return b.score > a.score ? b : a; });
      var delta = risk - SCORES.adjusted;
      var label = IMPACT.oversight.options.filter(function (o) { return o.value === state.oversight; })[0].label;

      $("#machine-read").innerHTML =
        "Highest-risk dimension: <b>" + esc(worst.label.toLowerCase()) + "</b> at " + worst.score + "." +
        (delta === 0
          ? " These are Nordwind Air's real answers."
          : " That is <b>" + (delta > 0 ? "+" : "") + delta + "</b> against Nordwind Air's own profile.") +
        (state.oversight === "none"
          ? " Nothing is reviewed by a human."
          : " Human review: " + esc(label.toLowerCase()) + ".");
    }

    var groups = [
      { key: "action",    hint: "The biggest single lever. It drives the authorization dimension." },
      { key: "ceiling",   hint: "Applies to every dimension at once — it sets how bad a wrong answer can get." },
      { key: "oversight", hint: "The only answer that can ever reduce the score." },
    ];

    $("#knobs").innerHTML = groups.map(function (g) {
      var conf = IMPACT[g.key];
      return '<div class="knob">' +
        '<p class="knob__label">' + esc(conf.label) + "</p>" +
        '<p class="knob__hint">' + esc(g.hint) + "</p>" +
        '<div class="seg" role="radiogroup" aria-label="' + esc(conf.label) + '" data-group="' + g.key + '">' +
          conf.options.map(function (o) {
            return '<button type="button" role="radio" data-value="' + o.value + '" ' +
              'aria-checked="' + (o.value === conf.initial) + '">' +
              esc(o.label) + '<span class="mult">×' + o.mult.toFixed(2) + "</span></button>";
          }).join("") +
        "</div></div>";
    }).join("");

    $("#knobs").addEventListener("click", function (e) {
      var b = e.target.closest("button[role=radio]");
      if (!b) return;
      var group = b.closest("[data-group]").dataset.group;
      state[group] = b.dataset.value;
      $$("button", b.parentNode).forEach(function (n) {
        n.setAttribute("aria-checked", String(n === b));
      });
      render();
    });

    /* Arrow-key navigation, which a radiogroup owes its users. */
    $("#knobs").addEventListener("keydown", function (e) {
      if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].indexOf(e.key) < 0) return;
      var b = e.target.closest("button[role=radio]");
      if (!b) return;
      e.preventDefault();
      var all = $$("button", b.parentNode);
      var i = all.indexOf(b);
      var next = all[(i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length];
      next.focus();
      next.click();
    });

    render();
  })();

  /* ════════════════════════════════════════════════════════════ §8 axes ══ */

  (function axes() {
    var body = $("#axtable tbody");
    body.innerHTML = DIMENSIONS.map(function (d) {
      return '<tr data-axis="' + d.key + '">' +
        '<td><span class="axname">' + esc(d.label) + "</span>" +
          '<span class="axblurb">' + esc(d.blurb) + "</span></td>" +
        "<td>" + d.probes + "</td><td>" + d.fails + "</td>" +
        '<td class="axscore">' + d.score + "</td></tr>";
    }).join("");

    var ros = rosettes.axes;

    function focusAxis(key) {
      ros.isolate(key);
      $$("#axtable tbody tr").forEach(function (r) {
        r.setAttribute("aria-current", String(r.dataset.axis === key));
      });
      ros.labels.forEach(function (l) {
        l.setAttribute("aria-current", String(l.dataset.axis === key));
      });
    }
    function clearAxis() {
      ros.isolate(null);
      $$("#axtable tbody tr").forEach(function (r) { r.removeAttribute("aria-current"); });
      ros.labels.forEach(function (l) { l.removeAttribute("aria-current"); });
    }

    $$("#axtable tbody tr").forEach(function (r) {
      r.addEventListener("mouseenter", function () { focusAxis(r.dataset.axis); });
      r.addEventListener("mouseleave", clearAxis);
    });
    ros.labels.forEach(function (l) {
      l.addEventListener("mouseenter", function () { focusAxis(l.dataset.axis); });
      l.addEventListener("mouseleave", clearAxis);
      l.addEventListener("focus", function () { focusAxis(l.dataset.axis); });
      l.addEventListener("blur", clearAxis);
    });

    /* This one scrubs: it engraves itself as the section rises into view.
       Always the JS path — one code path is worth more here than the few
       frames a scroll timeline would save on a single small SVG. */
    if (REDUCED) ros.node.style.setProperty("--p", 1);
    else scrubbers.push({ el: ros.node, prop: "--p", from: 0.12, to: 1, range: 0.55 });
  })();

  /* ══════════════════════════════════════════════════════════ §9 player ══ */

  (function player() {
    var btn = $("#run-scan"), stage = $("#scan-stage"), feed = $("#feed"),
        meter = $("#meter-fill"), count = $("#scan-count"),
        result = $("#result"), findings = $("#findings"),
        list = $("#findings-list"), more = $("#more-findings"),
        honesty = $("#honesty"), skip = $("#skip-scan");

    var timers = [], started = false, done = false;

    var LABEL = {};
    DIMENSIONS.forEach(function (d) { LABEL[d.key] = d.short || d.label; });

    function row(p) {
      var li = document.createElement("li");
      li.dataset.v = p.verdict;
      li.innerHTML =
        '<span class="f-id">' + esc(p.id) + "</span>" +
        '<span class="f-dim">' + esc(LABEL[p.dim] || p.dim) + "</span>" +
        '<span class="f-sev">' + esc(p.sev) + "</span>" +
        '<span class="f-v">' + (p.verdict === "fail" ? "Fail" : "Pass") + "</span>";
      /* Newest at the top, so the stream reads like a live console. */
      feed.insertBefore(li, feed.firstChild);
    }

    function progress(n) {
      meter.style.width = (n / RUN.length) * 100 + "%";
      count.textContent = n + " / " + RUN.length + " probes";
    }

    function finding(f) {
      return '<li class="finding">' +
        '<p class="finding__top">' +
          '<span class="finding__id">' + esc(f.probeId) + "</span>" +
          "<span>" + esc(f.dimension) + "</span>" +
          '<span class="finding__sev">' + esc(f.severity) + "</span>" +
        "</p>" +
        '<p class="finding__q">' + esc(f.prompt) + "</p>" +
        '<p class="finding__a">' + esc(f.reply) + "</p>" +
        '<p class="finding__why">' + esc(f.rationale) + "</p>" +
        "</li>";
    }

    function reveal() {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      progress(RUN.length);

      btn.textContent = "Scan complete";
      skip.hidden = true;

      result.hidden = false;
      findings.hidden = false;
      honesty.hidden = false;

      $("#result-rem").innerHTML =
        "Fix the top three findings and the composite falls to <b>" + SCORES.remediation[0].score +
        "</b>. Fix six and it reaches <b>" + SCORES.remediation[1].score +
        "</b>. Fix ten and it reaches <b>" + SCORES.remediation[2].score + "</b>.";

      list.innerHTML = TOP_FINDINGS.map(finding).join("");

      rosettes.result.node.style.setProperty("--p", 1);
      countTo(rosettes.result.readingEl, 0, SCORES.adjusted, 1100, 120, 0);
      observeReveals(result);
    }

    function run() {
      if (started) return;
      started = true;
      btn.disabled = true;
      btn.textContent = "Scanning…";
      stage.hidden = false;

      if (REDUCED) {
        RUN.forEach(row);
        reveal();
        return;
      }

      RUN.forEach(function (p, i) {
        timers.push(setTimeout(function () {
          row(p);
          progress(i + 1);
          if (i === RUN.length - 1) timers.push(setTimeout(reveal, 480));
        }, 90 + i * 95));
      });
    }

    btn.addEventListener("click", run);
    skip.addEventListener("click", function () {
      if (done) return;
      if (!started) { run(); }
      timers.forEach(clearTimeout);
      feed.innerHTML = "";
      RUN.forEach(row);
      reveal();
    });

    more.addEventListener("click", function () {
      list.insertAdjacentHTML("beforeend", MORE_FINDINGS.map(finding).join(""));
      more.remove();
    });

    /* Starts itself when it comes into view — the section's promise is that
       you watch it happen, so it should not need a click to keep that. Still
       fires under reduced motion, where run() paints the finished result
       immediately rather than animating to it. */
    var io = new IntersectionObserver(function (e) {
      if (!e[0].isIntersecting) return;
      run();
      io.disconnect();
    }, { threshold: 0.25 });
    io.observe($("#player"));
  })();

  /* ═══════════════════════════════════════════════════ §10 the deliverable ══ */

  $("#deliver").innerHTML = DELIVERABLES.map(function (d, i) {
    return '<article class="card deliver__card rise" style="--d:' + i * 90 + 'ms">' +
      '<span class="deliver__tag">' + esc(d.tag) + "</span>" +
      '<h3 class="h3 deliver__who">' + esc(d.who) + "</h3>" +
      '<ul class="deliver__list">' +
        d.items.map(function (t) {
          /* the remediation ladder is the one place figures belong in bold */
          return "<li><span>" + esc(t).replace(/(79|63|45|24)(?= |,|\.|$|&)/g, "<b>$1</b>") + "</span></li>";
        }).join("") +
      "</ul></article>";
  }).join("");

  /* ═════════════════════════════════════════════════════ §11 who and wedge ══ */

  $("#who-grid").innerHTML = AUDIENCES.map(function (a) {
    return '<article class="who__col">' +
      '<h3 class="h3">' + esc(a.who) + "</h3>" +
      '<p class="who__lead">' + esc(a.lead) + "</p>" +
      '<p class="who__body">' + esc(a.body) + "</p>" +
      '<a class="arrow" href="#contact" data-mailto="' + a.mailto + '">' +
        "<span>" + esc(a.cta) + "</span><span>→</span></a>" +
      "</article>";
  }).join("");

  $("#wedge").innerHTML = WEDGE.map(function (w, i) {
    return '<div class="wedge__item rise" style="--d:' + i * 80 + 'ms">' +
      '<p class="wedge__h">' + esc(w.head) + "</p>" +
      '<p class="wedge__b">' + esc(w.body) + "</p></div>";
  }).join("");

  /* Re-bind the audience links, which were rendered after the first pass. */
  $$("#who-grid [data-mailto]").forEach(function (a) {
    var m = MAILTO[a.dataset.mailto] || MAILTO.general;
    a.href = "mailto:" + CONFIG.email +
      "?subject=" + encodeURIComponent(m.subject) + "&body=" + encodeURIComponent(m.body);
  });

  /* ═══════════════════════════════════════════════════ §12 phases and team ══ */

  $("#phases").innerHTML = PHASES.map(function (p, i) {
    return '<li class="phase rise' + (p.now ? " phase--now" : "") + '" style="--d:' + i * 80 + 'ms">' +
      (p.now ? '<span class="phase__here">We are here</span>' : "") +
      '<p class="phase__n">' + esc(p.n) + "</p>" +
      '<h3 class="h3">' + esc(p.title) + "</h3>" +
      '<p class="phase__b">' + esc(p.body) + "</p></li>";
  }).join("");

  $("#team-grid").innerHTML = TEAM.map(function (m, i) {
    var full = (m.name + " " + (m.surname || "")).trim();
    var initials = (m.name[0] + (m.surname ? m.surname[0] : "")).toUpperCase();
    return '<article class="member rise" style="--d:' + i * 80 + 'ms">' +
      '<div class="member__ph">' +
        (m.photo
          ? '<img src="' + esc(m.photo) + '" alt="' + esc(full) + '" width="600" height="600" loading="lazy">'
          : '<span class="member__mono" aria-hidden="true">' + esc(initials) + "</span>") +
      "</div><div>" +
        '<p class="member__name">' + esc(full) + "</p>" +
        '<p class="member__role">' + esc(m.role) + "</p>" +
        '<p class="member__detail">' + esc(m.detail) + "</p>" +
        (m.linkedin
          ? '<p class="member__li"><a class="arrow" href="' + esc(m.linkedin) +
            '" target="_blank" rel="noopener"><span>LinkedIn</span><span>↗</span></a></p>'
          : "") +
      "</div></article>";
  }).join("");

  $("#team-event").textContent = CONFIG.event;

  /* ═════════════════════════════════════════════════════════════════ FAQ ══ */

  $("#faq-list").innerHTML = FAQ.map(function (f) {
    return "<details><summary>" + esc(f.q) + "</summary>" +
      '<div class="faq__a">' + esc(f.a) + "</div></details>";
  }).join("");

  /* ═════════════════════════════════════════════════════════════ sources ══ */

  $("#sources-list").innerHTML = SOURCES.map(function (s) {
    return '<li data-n="' + s.n + '">' + esc(s.text) + "</li>";
  }).join("");

  /* ══════════════════════════════════════════════════════════ sticky bar ══ */

  (function sticky() {
    var bar = $("#stickybar"), closed = false;
    $("#sticky-close").addEventListener("click", function () {
      closed = true;
      bar.classList.remove("is-on");
    });
    var io = new IntersectionObserver(function (e) {
      if (closed) return;
      bar.classList.toggle("is-on", !e[0].isIntersecting);
    }, { rootMargin: "-40% 0px 0px 0px" });
    io.observe($("#top"));

    /* Hide it again once the reader has reached the actual call to action. */
    var end = new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) bar.classList.remove("is-on");
    }, { threshold: 0.15 });
    end.observe($("#contact"));
  })();

  /* ════════════════════════════════════════════════════════════ the scrub ══ */

  /*
   * The scroll loop. The reading rail prefers a CSS scroll timeline and only
   * falls back to here; the rest always runs here, because a single code path
   * is worth more than the frames a timeline would save.
   */
  (function scrub() {
    var rail = $(".railbar i");

    /* §11 inks up as it arrives — the guilloche texture, not the background
       colour, so the white type never sits on a half-mixed ground. */
    var ultra = $(".band--ultra");
    if (ultra) scrubbers.push({ el: ultra, prop: "--ink", from: 0, to: 1, range: 0.55 });

    /* The hero card drifts — the page's only parallax. */
    var card = $(".hero__gauge");

    if (REDUCED) {
      scrubbers.forEach(function (s) { s.el.style.setProperty(s.prop, s.to); });
      return;
    }

    var ticking = false;
    function frame() {
      ticking = false;
      var vh = window.innerHeight;
      var y = window.scrollY || window.pageYOffset;

      if (!SDT && rail) {
        var max = document.documentElement.scrollHeight - vh;
        rail.style.setProperty("--rail", max > 0 ? clamp(y / max, 0, 1) : 0);
      }

      if (card) {
        card.style.transform = "translate3d(0," + clamp(y * -0.055, -46, 0).toFixed(1) + "px,0)";
      }

      scrubbers.forEach(function (s) {
        var r = s.el.getBoundingClientRect();
        /* 0 when the top edge is a screen below the fold, 1 once it has
           travelled `range` of a viewport past that. */
        var p = clamp((vh - r.top) / (vh * s.range), 0, 1);
        s.el.style.setProperty(s.prop, (s.from + (s.to - s.from) * p).toFixed(3));
      });
    }

    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    }, { passive: true });
    window.addEventListener("resize", frame, { passive: true });
    frame();
  })();

  /* ═════════════════════════════════════════════════════════════════ go ══ */

  observeReveals(document);
})();
