// Passport Guide BD \u2014 UI logic (vanilla JS, localStorage, no network).
(function () {
  'use strict';
  var Logic = window.PassportLogic;
  var I18n = window.PassportI18n.STR;
  var KEY = 'passport-guide-bd-v1';
  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];

  var DEFAULTS = {
    lang: 'en', tab: 'calc',
    calc: { pages: 48, years: 5, speed: 'regular', age: '' },
    checkType: 'new',
    checklist: { new: [], renewal: [], lost: [], child: [] },
    passports: []
  };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return null;
      return s;
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
  }
  var state = load() || JSON.parse(JSON.stringify(DEFAULTS));
  // Merge defaults for forward-compat.
  state.calc = Object.assign({}, DEFAULTS.calc, state.calc || {});
  state.checklist = Object.assign({}, DEFAULTS.checklist, state.checklist || {});
  if (!Array.isArray(state.passports)) state.passports = [];
  if (!I18n[state.lang]) state.lang = 'en';

  var $ = function (id) { return document.getElementById(id); };

  function t(key) { return (I18n[state.lang] && I18n[state.lang][key]) || I18n.en[key] || key; }

  function digits(str) {
    str = String(str);
    if (state.lang !== 'bn') return str;
    return str.replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }
  function money(n) { return digits(Logic.formatBDT(n)); }

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  // ---------- tabs ----------
  var TABS = ['calc', 'chart', 'check', 'track', 'steps', 'data'];
  function showTab(name) {
    state.tab = name;
    TABS.forEach(function (n) {
      var btn = $('tab-' + n), panel = $('panel-' + n);
      if (btn) btn.classList.toggle('active', n === name);
      if (panel) panel.classList.toggle('active', n === name);
    });
    save();
  }

  // ---------- calculator ----------
  function seg(id, value, group) {
    var el = $(id);
    el.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', String(b.dataset.value) === String(value));
      b.setAttribute('aria-pressed', String(b.dataset.value) === String(value));
    });
  }
  function renderCalc() {
    seg('seg-pages', state.calc.pages);
    seg('seg-years', state.calc.years);
    seg('seg-speed', state.calc.speed);
    $('age-input').value = state.calc.age;
    var fee = Logic.getFee(state.calc.pages, state.calc.years, state.calc.speed);
    var del = Logic.getDelivery(state.calc.speed);
    $('fee-amount').textContent = fee === null ? '\u2014' : money(fee);
    $('delivery-result').textContent = del ? digits(del.label) : '\u2014';
    var warn = $('age-warn');
    var ageErr = $('age-error');
    warn.hidden = true; ageErr.hidden = true;
    var ageRaw = String(state.calc.age).trim();
    if (ageRaw !== '') {
      var age = Number(ageRaw);
      if (!isFinite(age) || age < 0 || age > 120 || ageRaw !== String(Math.trunc(age)) && !/^\d+$/.test(ageRaw)) {
        ageErr.textContent = t('ageInvalid');
        ageErr.hidden = false;
      } else if (!Logic.validityAllowed(age, state.calc.years)) {
        warn.textContent = t('ageWarn');
        warn.hidden = false;
      }
    }
  }

  // ---------- chart ----------
  function renderChart() {
    var tbody = $('chart-body');
    tbody.innerHTML = '';
    Logic.feeTableRows().forEach(function (r) {
      var tr = document.createElement('tr');
      var active = r.pages === state.calc.pages && r.years === state.calc.years && r.speed === state.calc.speed;
      if (active) tr.className = 'active-row';
      tr.tabIndex = 0;
      var cells = [
        digits(r.pages) + ' \u2014 ' + t(r.pages === 48 ? 'pages48' : 'pages64'),
        digits(r.years) + ' \u2014 ' + t(r.years === 5 ? 'years5' : 'years10'),
        t(r.speed),
        money(r.fee),
        digits(r.days)
      ];
      cells.forEach(function (c) {
        var td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      });
      tr.addEventListener('click', function () {
        state.calc.pages = r.pages; state.calc.years = r.years; state.calc.speed = r.speed;
        save(); renderCalc(); renderChart(); showTab('calc');
      });
      tbody.appendChild(tr);
    });
  }

  // ---------- checklist ----------
  var CHECK_ITEM_IDS = {
    new: ['nid', 'form', 'payment', 'photoNote', 'oldPassport', 'profession'],
    renewal: ['oldPassport', 'nid', 'form', 'payment', 'changeProof'],
    lost: ['gd', 'nid', 'form', 'payment', 'affidavit'],
    child: ['brc', 'parentsNid', 'form', 'payment', 'consent']
  };
  function renderChecklist() {
    var type = state.checkType;
    document.querySelectorAll('#check-types button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.value === type);
    });
    var list = $('checklist-list');
    list.innerHTML = '';
    var done = state.checklist[type] || [];
    CHECK_ITEM_IDS[type].forEach(function (id) {
      var li = document.createElement('li');
      var label = document.createElement('label');
      label.className = 'check-item' + (done.indexOf(id) !== -1 ? ' done' : '');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = done.indexOf(id) !== -1;
      cb.setAttribute('aria-label', t('item_' + id));
      cb.addEventListener('change', function () {
        var arr = state.checklist[type] || [];
        if (cb.checked && arr.indexOf(id) === -1) arr.push(id);
        if (!cb.checked) arr = arr.filter(function (x) { return x !== id; });
        state.checklist[type] = arr;
        save(); renderChecklist();
      });
      var span = document.createElement('span');
      span.textContent = t('item_' + id);
      label.appendChild(cb); label.appendChild(span);
      li.appendChild(label);
      list.appendChild(li);
    });
    $('check-progress').textContent = digits(done.length) + '/' + digits(CHECK_ITEM_IDS[type].length) + ' ' + t('done');
    var bar = $('check-bar');
    bar.style.width = (CHECK_ITEM_IDS[type].length ? Math.round(done.length / CHECK_ITEM_IDS[type].length * 100) : 0) + '%';
  }

  // ---------- tracker ----------
  function renderTracker() {
    var list = $('tracker-list');
    list.innerHTML = '';
    $('tracker-empty').hidden = state.passports.length !== 0;
    var sorted = state.passports.slice().sort(function (a, b) {
      return a.expiry < b.expiry ? -1 : a.expiry > b.expiry ? 1 : 0;
    });
    var today = Logic.todayStr();
    sorted.forEach(function (p) {
      var days = Logic.daysUntil(p.expiry, today);
      var status = Logic.expiryStatus(days);
      var card = document.createElement('div');
      card.className = 'passport-card status-' + status;
      var head = document.createElement('div');
      head.className = 'passport-head';
      var name = document.createElement('strong');
      name.textContent = p.label;
      var badge = document.createElement('span');
      badge.className = 'badge badge-' + status;
      badge.textContent = status === 'expired' ? t('expired')
        : status === 'today' ? t('expiresToday')
        : status === 'renew' ? t('renewSoon') : t('valid');
      head.appendChild(name); head.appendChild(badge);
      var meta = document.createElement('div');
      meta.className = 'passport-meta';
      var dateText = digits(p.expiry);
      var daysText = status === 'expired'
        ? digits(Math.abs(days)) + ' ' + t('daysAgo')
        : status === 'today' ? '' : digits(days) + ' ' + t('daysLeft');
      meta.textContent = dateText + (daysText ? ' \u00b7 ' + daysText : '');
      var del = document.createElement('button');
      del.className = 'btn btn-danger btn-small';
      del.textContent = t('deleteBtn');
      del.addEventListener('click', function () {
        state.passports = state.passports.filter(function (x) { return x.id !== p.id; });
        save(); renderTracker(); toast(t('saved'));
      });
      card.appendChild(head); card.appendChild(meta); card.appendChild(del);
      list.appendChild(card);
    });
  }

  // ---------- steps ----------
  function renderSteps() {
    var ol = $('steps-list');
    ol.innerHTML = '';
    for (var i = 1; i <= 7; i++) {
      var li = document.createElement('li');
      var h = document.createElement('strong');
      h.textContent = digits(i) + '. ' + t('step' + i + 't');
      var p = document.createElement('p');
      p.textContent = t('step' + i + 'd');
      li.appendChild(h); li.appendChild(p);
      ol.appendChild(li);
    }
    var notes = $('notes-list');
    notes.innerHTML = '';
    ['notePolice', 'noteSuper', 'notePortal'].forEach(function (k) {
      var li = document.createElement('li');
      li.textContent = t(k);
      notes.appendChild(li);
    });
  }

  // ---------- i18n ----------
  function applyLang() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.dataset.i18nPh));
    });
    $('lang-toggle').textContent = state.lang === 'bn' ? 'English' : '\u09ac\u09be\u0982\u09b2\u09be';
    document.title = t('title');
    renderCalc(); renderChart(); renderChecklist(); renderTracker(); renderSteps();
  }

  // ---------- data tab ----------
  function exportData() {
    var payload = {
      app: 'passport-guide-bd', version: 1,
      checklist: state.checklist, passports: state.passports
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'passport-guide-bd-data.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast(t('saved'));
  }
  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        if (Logic.validateImport(obj) !== null) { toast(t('importBad')); return; }
        if (obj.checklist) state.checklist = Object.assign({}, DEFAULTS.checklist, obj.checklist);
        if (obj.passports) state.passports = obj.passports;
        save(); renderChecklist(); renderTracker(); toast(t('importOk'));
      } catch (e) { toast(t('importBad')); }
    };
    reader.readAsText(file);
  }

  // ---------- wire up ----------
  function segWire(id, key, parse) {
    $(id).querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.calc[key] = parse ? parse(b.dataset.value) : b.dataset.value;
        save(); renderCalc(); renderChart();
      });
    });
  }
  segWire('seg-pages', 'pages', Number);
  segWire('seg-years', 'years', Number);
  segWire('seg-speed', 'speed', null);
  $('age-input').addEventListener('input', function () {
    state.calc.age = $('age-input').value;
    save(); renderCalc();
  });
  document.querySelectorAll('#check-types button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.checkType = b.dataset.value;
      save(); renderChecklist();
    });
  });
  $('check-reset').addEventListener('click', function () {
    state.checklist[state.checkType] = [];
    save(); renderChecklist(); toast(t('saved'));
  });
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.dataset.tab); });
  });
  $('lang-toggle').addEventListener('click', function () {
    state.lang = state.lang === 'bn' ? 'en' : 'bn';
    save(); applyLang();
  });
  $('add-passport').addEventListener('submit', function (e) {
    e.preventDefault();
    var label = $('p-label').value.trim();
    var expiry = $('p-expiry').value;
    var errors = Logic.validateEntry(label, expiry);
    $('err-label').hidden = errors.indexOf('label') === -1 && errors.indexOf('label-long') === -1;
    $('err-expiry').hidden = errors.indexOf('expiry') === -1;
    if (errors.length) return;
    state.passports.push({ id: 'p' + Date.now().toString(36), label: label, expiry: expiry });
    $('p-label').value = ''; $('p-expiry').value = '';
    save(); renderTracker(); toast(t('saved'));
  });
  $('export-btn').addEventListener('click', exportData);
  $('import-file').addEventListener('change', function () {
    if (this.files && this.files[0]) importData(this.files[0]);
    this.value = '';
  });
  $('erase-btn').addEventListener('click', function () {
    if ($('erase-input').value.trim() !== 'DELETE') { toast(t('erasePrompt')); return; }
    state.checklist = JSON.parse(JSON.stringify(DEFAULTS.checklist));
    state.passports = [];
    $('erase-input').value = '';
    save(); renderChecklist(); renderTracker(); toast(t('eraseDone'));
  });

  // ---------- init ----------
  applyLang();
  showTab(TABS.indexOf(state.tab) !== -1 ? state.tab : 'calc');
})();
