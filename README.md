# PointNow — landing page (v2, "Certificate")

A single static page for insurers, enterprise buyers and investors who open the
link cold and decide in ninety seconds whether PointNow is real.

**No build step, no dependencies, no package.json.** Open `index.html` by
double-clicking it and the whole page works — every animation, the scan player,
the impact machine, all of it. That constraint is deliberate: nothing should be
able to break between here and a pitch.

```
open index.html            # that's it
npx vercel --prod          # or drag the folder onto Netlify
```

`../pointnow-site/` is v1 and is left untouched as a fallback.

---

## The two rules

Everything else in the design is negotiable. These two are not.

**1. Nothing on this page is ever red or green.**
Risk is encoded as *ink density* in the rosette — more risk means more curves,
tighter waves, heavier ink — and as *full versus ghosted ink* on probe rows.
A high-risk rosette has to read as "measured precisely", never as "you failed",
because these end up as screenshots in decks and in front of the company being
assessed. The one accent, amber, marks the highest-risk axis and seals the
issued profile. It never means danger.

**2. Dark blocks are neutral graphite, never navy.**
This started life as a rule about *keeping away from* the prototype, which was a
dark navy console. The prototype has since been brought into this same system,
so the rule now means the opposite of what it used to: **graphite is the shared
dark ground of both properties, and navy appears in neither.** The console at
[pointnow.vercel.app](https://pointnow.vercel.app/) is supposed to look like this
page — same faces, same tokens, same wordmark, same rosette.

Its half of the system is `../pointnow/app/globals.css`, and the two files carry
the same token *names* deliberately so a value can be traced across by name.
Change one, change the other. The prototype adds one thing this page does not
have: its ground moves across the three steps — porcelain for the audit, graphite
for the scan, porcelain again for the issued profile — which is §6 of this page
acted out rather than described.

One deliberate exception on that side: `/bot`, the Nordwind Air target, is
excluded from all of it and keeps its own typeface and palette. It has to look
like an ordinary airline product right up until it is measured.

---

## Palette

Security printing: a blue intaglio plate on porcelain stock, with a gold seal.

| token | hex | role |
|---|---|---|
| `--porcelain` | `#EDF0EF` | page ground. Cool, faintly green-grey, **zero yellow** — this is not cream |
| `--chalk` | `#FAFCFB` | raised block surface |
| `--putty-lo` | `#E7E2D7` | warm tonal band, one section only |
| `--graphite` | `#15181A` | ink, and the dark blocks |
| `--graphite-2` | `#4A5250` | secondary text — 7.0:1 on porcelain |
| `--ultra` | `#2B3DF5` | brand. CTAs, links, all rosette line-work, all data ink — 5.9:1 on porcelain |
| `--ultra-lift` | `#8E9BFF` | the **only** blue allowed to carry text on graphite (`--ultra` is 2.7:1 there) |
| `--amber` | `#E8A02E` | the seal, the live dot, "we are here", the worst-axis mark |
| `--on-dark` | `#E6EAE8` | text on graphite |

**Amber is 1.9:1 on porcelain.** It may never carry text on a light ground —
fills, seals and marks only, with graphite on top (8.1:1, which is why the
badges are dark text on amber). On graphite it clears 8.1:1 and may carry text.

Every pairing the page actually uses passes WCAG AA for normal text. The check
lives in the verification section below.

## Type

| role | face | notes |
|---|---|---|
| display | **Archivo** variable | `font-stretch: 112%`, weight 620, tracking −0.022em |
| body / UI | **Instrument Sans** variable | |
| figures, probe IDs, eyebrows | **IBM Plex Mono** 400/500 | carried over from v1 |

All self-hosted in `assets/fonts/`, latin + latin-ext subsets, `font-display: swap`.

**There are no `<link rel=preload>` tags for the fonts, on purpose.** A font
preload needs `crossorigin` to be reused by `@font-face`, and `crossorigin`
fails outright on `file://` — which would break the double-click-to-open
requirement and print CORS errors on every load.

---

## The rosette

`rosette.js`. The one drawing on the site, doing two jobs so the brand mark and
the data visualisation are the same object.

- **Field** — a security-print rosette: N wavy petals whose centres sit on a
  ring, the construction used on banknotes and share certificates. `count`,
  `waves`, `amp`, `ink` and `weight` are all straight interpolations on
  `risk/100`. At risk 79 it draws 55 petals; at risk 20 it draws 29. That is
  the whole "no red" encoding.
- **Profile** — a closed periodic Catmull-Rom through six radii, one per scored
  dimension. Always six cubic segments whatever the scores, so the `d`
  attribute keeps a stable command structure and CSS can transition it when the
  impact machine changes the numbers.

One caveat, stated in the code as well: **scores map to radius from 30, not 0.**
Real assessments cluster in the 55–95 band and mapping the full range squeezes
that cluster into a few units of radius — the six lobes come out as an almost
perfect circle and the shape stops carrying information. Anything at or below
30 sits on the inner limit.

The centre is wiped back to the ground with a soft radial gradient so the
reading stays legible over the engraving — the same thing a certificate does to
clear space for its denomination.

---

## Motion

One metaphor: **scrolling the page is the plate being inked and the document
issued.** Two mechanisms, and only two.

| | |
|---|---|
| **entrances** | `IntersectionObserver` adds `.is-in`, CSS does the rest. One shot, never reversed. |
| **scrubs** | `--p` (rosette draw) and `--ink` (§11 engraving) are written by the rAF loop at the bottom of `main.js`. The reading rail prefers a CSS scroll timeline and falls back to the same loop; `html.no-sdt` selects which. |

The five moves: the reading rail, the hero rosette drawing itself in on load
with the counter, the engraving wipe on headlines, the one pinned sequence in
§6 (audit sheet → probe stream → issued certificate), and blocks arriving on a
60ms stagger. Two colour changes, one parallax, one pin. Everything else is a
wipe or a stagger.

**`.wipe` uses a mask, not `clip-path`.** `clip-path` collapses the element's
visual rect to zero, which makes `IntersectionObserver` unable to ever see it —
so the reveal that depends on the observer can never fire. This was a real bug;
don't reintroduce it.

**The mobile nav sheet uses `inert`, not `visibility: hidden`.** Hiding it by
visibility means the `focus()` that should move into the sheet on open lands one
frame before the transition starts and is silently dropped. `inert` also does
the right thing for the tab order and the accessibility tree. It is applied only
below 860px — above that the same element is the ordinary desktop nav.

**`.nav` must never carry `backdrop-filter`** — the frosted ground lives on
`.nav::before` instead. `backdrop-filter`, like `transform` and `filter`, makes an
element the containing block for its `position: fixed` descendants, and the sheet
is a fixed child of the bar. With the filter on `.nav`, `inset: 0` resolved
against a 63px bar rather than the viewport: the menu opened as a one-line strip,
and since opening also locks body scroll, the page froze. Two related traps closed
at the same time — the reading rail (z 120) and the sticky CTA bar (z 110) both
outrank the nav's z 100 and are hidden via `html.nav-open` while the sheet is up,
and crossing the breakpoint while open now closes the sheet properly instead of
leaving `body { overflow: hidden }` behind at desktop width.

Under `prefers-reduced-motion: reduce` **everything renders final**: rosette at
full density, headlines revealed, counters at their end values, §6 unpinned into
three static blocks, the scan player already at its result, no rail, no parallax.

---

## Where the numbers come from

`data.js` is the only place a number lives. Nothing is written for the website —
every measured value is lifted from the prototype's recorded run:

```
pointnow/fixtures/captured-run.json   prompts, replies, verdicts, latencies
pointnow/lib/types.ts                 dimension labels, blurbs, severity weights
pointnow/lib/impact.ts                the impact multipliers used in §7
pointnow/lib/scorer.ts                the scores
```

Verified byte-identical to `../pointnow-site/data.js`, which was itself verified
2026-07-27 against the fixture using the app's own `EXAMPLE_PROFILE`. **If the
fixture is ever re-captured these must be re-derived — do not hand-edit them.**

One visible consequence: our editorial copy uses typographic apostrophes (`’`),
but the captured prompts and replies keep the straight `'` they were recorded
with. That inconsistency is deliberate — a quoted transcript is evidence, and
we don't retouch it, not even the punctuation.

### Polarity, because it trips everyone up

`lib/scorer.ts` returns a **safety** composite where higher is safer. Everything
in `data.js` is **`RISK = 100 − safety`**, so high is bad and the number falls as
findings get fixed.

**79 is a bad score.** Remediation runs 79 → 63 → 45 → 24 as the top 3, 6 and 10
findings are closed.

### The impact machine

§7 reproduces `lib/impact.ts` on the page: a per-dimension multiplier from Q7, a
global ceiling from Q2, an oversight dampener from Q10. The dimension risks in
`data.js` are already impact-adjusted at the tool's own initial answers, so the
base risks are recovered by dividing those multipliers back out, and the
composite is expressed as a ratio against the initial aggregate. That means the
starting reading is exactly `SCORES.adjusted` — the tool's verified 79 — with no
fudge factor, and every movement from there is the real multiplier response.

Turn every lever to its safest setting and it reads 20, with the highest-risk
axis correctly shifting from authorization to factual accuracy.

---

## Editorial rules

Carried over from v1, and still correct.

**Not on this page:** logo bars, "trusted by", testimonials, customer counts.
Every competitor's homepage is built on borrowed credibility. PointNow has none
of that and isn't an insurer, so the page inverts it — *don't take our word for
it, watch it break.*

**Claims to keep out:** premium figures, "certified", "insurable", any euro
amount attached to risk, and anything about probing third parties' bots.

**Deliberate, don't "fix" them:** the honesty box under the demo (verdicts are
expert-graded, not model-graded), "We are here" on phase one, no competitor
named anywhere, and the two disclaimers in the footer.

---

## Still to land

Both are marked `TODO` in `data.js`.

1. **Team** — `TEAM[].surname`, `.photo` (square, ≥600px, into `assets/team/`)
   and `.linkedin`. Setting `photo` swaps the placeholder for the image with no
   other change. Three first names and initials is currently the weakest thing
   on the page for an investor.
2. **Domain and email** — `CONFIG.email`. A gmail `mailto:` on an insurtech page
   is the loudest "not real yet" signal there is. It also unblocks the
   `og:image`, which is deliberately absent until it can be an absolute URL
   pointing at a real 1200×630 PNG.

Then, in rough order of value: a sample risk-profile PDF for §10 to link to;
traction numbers; a standards mapping (AI Act / ISO 42001 / NIST AI RMF) for the
method section; a concrete verb on the investor CTA; a data-and-privacy stance;
and the legal footer (entity, registration number, privacy policy, EU imprint).

---

## Verified

Run against Chromium at 360 / 390 / 480 / 768 / 1024 / 1440px.

- Opens off `file://` with no server, no build, no network. Zero console errors,
  zero failed requests.
- **No horizontal overflow at any width.**
- **JavaScript disabled:** the page still renders 5,720 characters of readable
  text, the headline and every section intact. Animations are gated behind a
  `js` class set before first paint.
- **Reduced motion:** rosette `--p: 1` and reading at 79, headline mask off, rail
  hidden, §6 unpinned, scan player already showing 26 rows and its result.
- **Keyboard:** skip link first, visible 2px focus ring on every interactive
  element, mobile sheet takes focus on open, traps Tab, closes on Escape and
  returns focus to the burger. Desktop nav is never inert.
- **Mobile nav sheet:** fills the viewport at 360/390/768px, all five items in
  view and hit-testable, closes on link click and on crossing the breakpoint,
  and releases the body scroll lock every way out.
  *This one is checked by screenshot, not only by assertion — the first pass
  verified the sheet's focus and Tab behaviour, all of which passed inside a
  63px strip that was visibly broken.*
- **Contrast:** every text pairing the page uses passes AA (lowest is 5.26:1,
  `--ultra` on putty). Amber-on-light measured at 1.7–2.2:1 and is used only for
  fills, exactly as intended.

Not yet done: a real-device pass and a Lighthouse run on a served copy.
