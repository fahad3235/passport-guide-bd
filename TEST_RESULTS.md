# TEST RESULTS — passport-guide-bd (run #253, 13:00 slot, 2026-11-06)

## Unit tests — 12/12 PASS
Command: `node tests/logic.test.js`

- Fee table: all 12 combos exact against the DIP schedule (48/5 R 4025 / E 6325 / SE 8625; 48/10 R 5750 / E 8050 / SE 10350; 64/5 R 6325 / E 8625 / SE 12075; 64/10 R 8050 / E 10350 / SE 13800).
- Invalid combos return null; string inputs coerce (48/10/express = 8050).
- Delivery days: Regular 15–21, Express 7–10, Super Express 2.
- Validity rule: 17→10y false, 18→true, 65→true, 66→false; null/empty age allowed; 200/−1 rejected.
- daysUntil: same-day 0, +1/−1, +365, leap day 2028-02-28→2028-02-29 = 1, invalid dates (2026-02-30, 2026-13-01, free text) → null.
- expiryStatus: −5 expired, 0 today, 1 renew, 180 renew, 181 ok, 900 ok.
- Checklist: 4 types (new 6, renewal 5, lost 5, child 5 items); every item id has EN + BN strings.
- validateEntry: empty/blank label, bad date, 61-char label rejected; valid entry passes.
- validateImport: good file passes; null/array/wrong-app/missing-version/bad-type/bad-item/bad-passport/non-array passports all rejected with distinct codes.
- i18n: EN/BN key sets identical (97 keys each), no empty strings, all 7 steps present in both languages.
- formatBDT: 4025 → ৳4,025; 13800 → ৳13,800.

## Headless-Chrome smoke — 39/39 PASS (×1 run)
Command: `node smoke/smoke.mjs` (raw CDP, headless shell 1187, file://)

- Title "Passport Guide BD", 6 tabs, default fee ৳4,025 / 15–21 days.
- Fee follows DIP table on every control: 64p→৳6,325; 10y→৳8,050; Super→৳13,800 + 2 days; Express→৳10,350 + 7–10 days.
- Age 16 + 10y shows the 18–65 warning; age 30 hides it.
- Chart: 12 rows, contains ৳13,800; row click switches to calc tab and loads ৳13,800.
- Checklist: New 6 items, tick → "1/6 done"; Lost 5 items, mentions General Diary.
- Tracker: empty state visible; empty-label submit shows inline error; add 2031-01-01 → Valid badge; add 2020-01-01 → Expired badge; add 2027-03-01 (~115 days out) → Renew soon badge.
- Steps: 7 items, 3 notes, mentions epassport.gov.bd.
- BN toggle: title changes, fee shows Bengali digits; toggle back restores English.
- Reload persistence: language, 3 passports, and checklist tick all survive.
- Typed-DELETE erase clears passports; tracker empty again.
- 390px mobile: no horizontal overflow on calc, chart, and tracker tabs.
- Zero console errors, zero page exceptions.

## Repairs
- 1 real app bug found by unit tests: checklist ids in logic.js used kebab-case (`photo-note`) while i18n/app used camelCase (`photoNote`) — fixed in logic.js, tests green after.
- 3 test-side fixes only (TAKA constant was a stray U+FEFF; `const a` redeclaration across CDP evaluates; Bengali-digit check used a digit absent from the current fee; checklist-persist check ran on the wrong checklist type). 0 app-logic bugs in smoke runs.

## Source hygiene
- All pushed sources pure ASCII (Bengali as \uXXXX escapes in JS, HTML entities in index.html); verified with `grep -P '[^\x00-\x7f]'` = zero matches across js/, index.html, styles.css, tests/, smoke/.

## Fee-data verification
- Fee chart cross-checked 2026-11-06 against the DIP schedule as republished by tipsoi.pro (updated 12 July 2026), visafoto.com, TBS News (Feb 2025 circular article), Wego, and banglapulse — all 12 values agree across sources. Delivery ranges (Regular 15–21d, Express 7–10d, Super Express 2d) likewise agree.
