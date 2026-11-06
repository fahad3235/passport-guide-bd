# Passport Guide BD

Offline bilingual (EN / বাংলা) Bangladesh e-passport helper: fee calculator, full fee chart, document checklists, passport expiry tracker, and a 7-step application guide. Pure static site — no server, no network requests, all data stays in the browser.

Live site: https://fahad3235.github.io/passport-guide-bd/

## Problem

Applying for a Bangladeshi e-passport means juggling three things at once: which fee applies (booklet × validity × delivery speed), which documents to carry, and when the current passport expires. The fee table lives on a government portal, checklists live in people's heads, and expiry dates sneak up — many countries refuse entry with under 6 months of validity left. This app puts all three in one offline page.

## Features

- **Fee calculator** — booklet (48 / 64 pages) × validity (5 / 10 years) × delivery (Regular / Express / Super Express) → exact fee + delivery time. Optional age input enforces the DIP rule that 10-year passports are only for ages 18–65.
- **Full fee chart** — all 12 fee combinations in one table; tap a row to load it into the calculator.
- **Document checklists** — New, Renewal, Lost / Damaged, and Child (under 18), with tick-off progress saved in the browser.
- **Expiry tracker** — add passports with expiry dates; Valid / Renew soon (under 180 days) / Expired badges, sorted by nearest expiry.
- **How to apply** — 7 steps from account creation to collection, plus notes (no police verification since February 2025; Super Express only at selected offices; apply only via the official portal).
- **Data** — JSON export, strict-validated import, typed-DELETE erase-all.
- **Bilingual** — full EN / বাংলা toggle, persisted, with Bengali digits in BN mode. Responsive down to 390px.

## Fee source

Fees are the Department of Immigration & Passports (DIP) e-passport schedule, updated 12 July 2026, cross-checked against multiple published sources (TBS News, Wego, Visafoto, tipsoi). All fees include 15% VAT.

| Booklet | Validity | Regular (15–21 days) | Express (7–10 days) | Super Express (2 days) |
|---|---|---|---|---|
| 48 pages | 5 years | ৳4,025 | ৳6,325 | ৳8,625 |
| 48 pages | 10 years | ৳5,750 | ৳8,050 | ৳10,350 |
| 64 pages | 5 years | ৳6,325 | ৳8,625 | ৳12,075 |
| 64 pages | 10 years | ৳8,050 | ৳10,350 | ৳13,800 |

Fees change — the app footer says so, and the calculator note tells users to confirm on epassport.gov.bd before paying. Fees for applications made from outside Bangladesh are charged in USD and are intentionally not included; check the DIP schedule for those.

## Stack

- Vanilla HTML / CSS / JavaScript, no dependencies, no build step.
- `localStorage` for language, calculator state, checklist ticks, and saved passports.
- Node `assert` unit tests (`tests/logic.test.js`) + raw-CDP headless-Chrome smoke test (`smoke/smoke.mjs`, uses the Playwright headless shell).

## Prerequisites

- Any modern browser (or just open `index.html`).
- Node.js 18+ only for running the tests.

## Install & run

```sh
git clone https://github.com/fahad3235/passport-guide-bd.git
cd passport-guide-bd
# open index.html in a browser, or serve it:
npx serve .
```

## Dev commands

```sh
node tests/logic.test.js   # 12 unit tests
node smoke/smoke.mjs       # 39 headless-Chrome checks
```

## Testing

- `tests/logic.test.js` — 12/12 pass: all 12 fee values, invalid-combo rejection, delivery-day ranges, the 18–65 validity rule (17/18/65/66 boundaries), date math (leap day, invalid dates), the 180-day renew threshold, checklist definitions vs i18n, entry + import validation, EN/BN key parity, money formatting.
- `smoke/smoke.mjs` — 39/39 pass in headless Chrome: fee changes across booklet/validity/speed, age warning show/hide, chart 12 rows + row-click loads calculator, checklist tick + progress + type switch, tracker add/validate/badges (Valid / Expired / Renew soon), steps + notes render, BN toggle with Bengali digits, reload persistence (language, passports, checklist tick), typed-DELETE erase, 390px no-overflow on three tabs, zero console errors / page exceptions.

## Deployment

Static site — any static host works. GitHub Pages: Settings → Pages → Deploy from branch `main` / root.

## Limitations

- Fees are a snapshot of the DIP schedule (12 July 2026). They can change; the app labels them and points at the official portal.
- The 6-month renewal warning is the common travel rule, not a legal requirement for every destination.
- Checklist items are general guidance for the usual cases; individual offices can ask for extra documents.
- This is an unofficial guide, not affiliated with the Department of Immigration & Passports.
- No live status check — passport status must be checked on the official portal.

## Status

Complete MVP. Fee table verified against the DIP schedule; calculator, checklist, tracker, and guide all tested with real results (see `TEST_RESULTS.md`).
