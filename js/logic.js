// Passport Guide BD \u2014 pure logic (no DOM). Node-testable.
// Fee table: Department of Immigration & Passports (DIP) e-passport fee
// schedule, verified against the official schedule as published
// (updated 12 July 2026) and cross-checked on multiple sources.
// All fees include 15% VAT. Delivery-day ranges per DIP schedule.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.PassportLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PAGES = [48, 64];
  var YEARS = [5, 10];
  var SPEEDS = ['regular', 'express', 'super'];

  // fees[pages][years][speed] = BDT
  var FEES = {
    48: {
      5: { regular: 4025, express: 6325, super: 8625 },
      10: { regular: 5750, express: 8050, super: 10350 }
    },
    64: {
      5: { regular: 6325, express: 8625, super: 12075 },
      10: { regular: 8050, express: 10350, super: 13800 }
    }
  };

  // Delivery time per DIP schedule.
  var DELIVERY = {
    regular: { min: 15, max: 21, label: '15-21 days' },
    express: { min: 7, max: 10, label: '7-10 days' },
    super: { min: 2, max: 2, label: '2 days' }
  };

  var SPEED_LABEL = { regular: 'Regular', express: 'Express', super: 'Super Express' };

  // 10-year validity is only for ages 18-65 (DIP rule). Under 18 or over 65
  // get a 5-year passport.
  function validityAllowed(age, years) {
    if (age === null || age === undefined || age === '') return true;
    var a = Number(age);
    if (!isFinite(a) || a < 0 || a > 120) return false;
    if (years === 10 && (a < 18 || a > 65)) return false;
    return true;
  }

  function getFee(pages, years, speed) {
    pages = Number(pages); years = Number(years);
    if (FEES[pages] && FEES[pages][years] && FEES[pages][years][speed] !== undefined) {
      return FEES[pages][years][speed];
    }
    return null;
  }

  function getDelivery(speed) {
    return DELIVERY[speed] || null;
  }

  function feeTableRows() {
    var rows = [];
    PAGES.forEach(function (p) {
      YEARS.forEach(function (y) {
        SPEEDS.forEach(function (s) {
          rows.push({ pages: p, years: y, speed: s, fee: FEES[p][y][s], days: DELIVERY[s].label });
        });
      });
    });
    return rows;
  }

  // --- date helpers (UTC, so results do not depend on local timezone) ---
  function parseDate(str) {
    if (typeof str !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return d;
  }

  function todayStr(asOf) {
    var d = asOf ? parseDate(asOf) : new Date();
    if (!d) return null;
    if (asOf) return asOf;
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }

  // Whole days from asOf (YYYY-MM-DD, default today) until dateStr.
  // Negative = already passed. 0 = today.
  function daysUntil(dateStr, asOf) {
    var target = parseDate(dateStr);
    var base = asOf ? parseDate(asOf) : new Date();
    if (!target || !base) return null;
    var baseUtc = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
    return Math.round((target.getTime() - baseUtc) / 86400000);
  }

  // Renewal guidance: most countries want 6 months of validity left.
  var RENEW_WITHIN_DAYS = 180;
  function expiryStatus(daysLeft) {
    if (daysLeft === null || daysLeft === undefined) return null;
    if (daysLeft < 0) return 'expired';
    if (daysLeft === 0) return 'today';
    if (daysLeft <= RENEW_WITHIN_DAYS) return 'renew';
    return 'ok';
  }

  // --- checklist definitions (item ids; text lives in i18n) ---
  var CHECKLISTS = {
    new: ['nid', 'form', 'payment', 'photoNote', 'oldPassport', 'profession'],
    renewal: ['oldPassport', 'nid', 'form', 'payment', 'changeProof'],
    lost: ['gd', 'nid', 'form', 'payment', 'affidavit'],
    child: ['brc', 'parentsNid', 'form', 'payment', 'consent']
  };
  var CHECKLIST_TYPES = ['new', 'renewal', 'lost', 'child'];

  // --- tracker entry validation ---
  function validateEntry(label, expiry) {
    var errors = [];
    if (!label || !String(label).trim()) errors.push('label');
    else if (String(label).trim().length > 60) errors.push('label-long');
    if (!parseDate(expiry)) errors.push('expiry');
    return errors;
  }

  // --- export/import validation (strict) ---
  function validateImport(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'not-object';
    if (obj.app !== 'passport-guide-bd') return 'bad-app';
    if (typeof obj.version !== 'number') return 'bad-version';
    if (obj.checklist !== undefined) {
      if (typeof obj.checklist !== 'object' || obj.checklist === null || Array.isArray(obj.checklist)) return 'bad-checklist';
      for (var t in obj.checklist) {
        if (CHECKLISTS[t] === undefined) return 'bad-checklist-type';
        if (!Array.isArray(obj.checklist[t])) return 'bad-checklist-type';
        for (var i = 0; i < obj.checklist[t].length; i++) {
          if (CHECKLISTS[t].indexOf(obj.checklist[t][i]) === -1) return 'bad-checklist-item';
        }
      }
    }
    if (obj.passports !== undefined) {
      if (!Array.isArray(obj.passports)) return 'bad-passports';
      for (var j = 0; j < obj.passports.length; j++) {
        var p = obj.passports[j];
        if (!p || typeof p !== 'object') return 'bad-passport';
        if (validateEntry(p.label, p.expiry).length > 0) return 'bad-passport';
      }
    }
    return null; // valid
  }

  function formatBDT(n) {
    return '\u09f3' + Number(n).toLocaleString('en-US');
  }

  return {
    PAGES: PAGES, YEARS: YEARS, SPEEDS: SPEEDS,
    FEES: FEES, DELIVERY: DELIVERY, SPEED_LABEL: SPEED_LABEL,
    RENEW_WITHIN_DAYS: RENEW_WITHIN_DAYS,
    CHECKLISTS: CHECKLISTS, CHECKLIST_TYPES: CHECKLIST_TYPES,
    validityAllowed: validityAllowed,
    getFee: getFee,
    getDelivery: getDelivery,
    feeTableRows: feeTableRows,
    parseDate: parseDate,
    todayStr: todayStr,
    daysUntil: daysUntil,
    expiryStatus: expiryStatus,
    validateEntry: validateEntry,
    validateImport: validateImport,
    formatBDT: formatBDT
  };
});
