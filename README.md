# "Never Miss a Customer" — Interactive Demo (SALON)

A fictional US salon (**Rosegold & Rye Salon — Hair · Color · Bridal, Scottsdale AZ**)
with an embedded AI style coordinator (**Ruby**) that demonstrates Tameer Ali's
**"Never Miss a Customer"** automation system to a salon owner in ~60 seconds.

**100% static. No backend, no build step, zero external requests, zero tracking.**
Works from `file://` and any static host.

Part of the multi-niche demo factory (see `~/workspace/outreach/demo-links.md`).
Siblings: `~/workspace/outreach/demo/` (Casa Verde restaurant + Maya),
`~/workspace/outreach/demo-dental/` (Bright Smile Dental Studio + Nora),
`~/workspace/outreach/demo-medspa/` (Glow Haus Med Spa + Ava).

## What it demonstrates (the 4 flows)

1. **Services / pricing Q&A** — ask about cuts (from $65), full color (from $95),
   highlights (from $145), balayage (from $185), keratin smoothing (from $225),
   deep repair (from $45), bridal package (from $295), updos (from $75).
   Consultations are always free — zero pressure.
2. **Appointment booking** — service interest → name → optional text reminder →
   preferred day → time → confirmation card with booking reference (e.g. `RR-KT9X2`).
3. **After-hours lead capture** *(the money flow)* — tap "🌙 After-hours demo":
   a notice reads *"It's 11:42 PM — we're closed right now, but I'm Ruby,
   Rosegold & Rye's style coordinator, and I'm still here."* A midnight
   hair-dream inquiry → name + phone + hair goal → "Saved! The morning team
   will reach out first thing" → a mini **"Saved to your dashboard"** card
   appears, and the lead is persisted to the browser's `localStorage`
   (`nmc_salon_leads`) as the simulated owner dashboard. This is the moment that
   sells the system: *every midnight hair-dreamer becomes a morning booking,
   not a client lost to the salon down the street.*
4. **Review request** — tap "⭐ Rate your visit" → tap the stars:
   - **5 stars** → "Would you share that on Google?" + Google review button.
   - **1–4 stars** → "What could we do better?" → feedback captured →
     "Our salon manager will personally follow up."

Plus: graceful fallbacks for off-script input (never dead-ends), quick-reply chips,
typing indicator with realistic delays, auto-open nudge after ~8s, and the site's
"Book an appointment" buttons jump straight into the booking flow.

Phone validation: the optional-reminder / after-hours phone fields reject
digit-less text (e.g. "notaphone") — the fixed `digits.length < 7` check.

Copy is in **buyer language** ("never miss a client", "after-hours", "Saturday
chairs go fast") — never "AI chatbot" jargon. Widget header/footer carries a small
credit: *"Live demo by Tameer Ali · AI Automation"*.

## Personalize per prospect

Append query params — the salon name, tagline, city, address and phone swap
everywhere (page + widget + booking-reference prefix):

```
index.html?biz=Golden%20Hour%20Hair%20Co&tagline=Hair%20Studio&city=Tempe%2C%20AZ&address=88%20Main%20St%2C%20Tempe%2C%20AZ%2085281&phone=%28480%29%20555-0119
```

| Param     | Default                              |
|-----------|--------------------------------------|
| `biz`     | Rosegold & Rye Salon                 |
| `tagline` | Hair · Color · Bridal                |
| `city`    | Scottsdale, AZ                       |
| `address` | 4178 N Goldwater Blvd, Scottsdale, AZ 85251 |
| `phone`   | (480) 555-0187                       |

`?fast=1` skips animation delays (used by the automated test harness).

**Outreach workflow:** for each salon prospect, generate their link with
`?biz=<Their Salon Name>` so the demo greets them as *their own* salon.
The personalized demo is the outreach hook — audit opens, demo closes.

## Hosting options

- **Fastest (recommended):** Netlify Drop / Vercel / Cloudflare Pages / GitHub Pages —
  drag the `demo-salon/` folder, get a public HTTPS link in ~1 minute.
- **Any static host** works — it's plain HTML/CSS/JS.
- **Local preview:** `python3 -m http.server` inside `demo-salon/`, or just double-click
  `index.html` (works from `file://`).

Hosting is handled by the parent agent — this subagent builds and verifies only.

## Verification

End-to-end harness at `../demo-deploy-zips/salon-verify-2026-10-03.js` (puppeteer-core
+ local Chromium): honesty markers gone, OG/Twitter meta tags present, all 4 flows,
the 5-star and 3-star review branches, bad-phone rejection in BOTH phone fields,
localStorage lead persistence, full `?biz=&city=&tagline=&phone=&addr=&services=&hours=`
personalization (incl. caps + XSS escaping, chat-host-row preserved), hero-CTA booking
jump, and a 390px mobile viewport — and fails on **any** console/page error or any
external request.

## Files

- `index.html` — salon site + widget markup
- `assets/style.css` — all styling (blush/charcoal/gold palette, system fonts only, no external requests)
- `assets/widget.js` — Ruby conversation engine (intents, booking/after-hours/review
  state machines, personalization, test hooks via `window.__maya`)

*Note: bookings, leads and reviews in this demo are simulated in the browser —
the footer says so. A real client build wires these to the salon's actual
scheduling/CRM/notification stack.*
