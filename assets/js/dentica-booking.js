/* =============================================================================
   Dentica Dental Clinic — self-hosted booking engine (a small Cal.com for the clinic)
   Flow: service  ->  date + time  ->  patient details  ->  confirmed
   On confirm it POSTs to the n8n webhook, which appends the row to Google Sheets
   and WhatsApps the receptionist. With no webhook configured it runs in DEMO mode:
   the booking is kept in localStorage and the WhatsApp message opens directly.
   ============================================================================= */
(function () {
  'use strict';

  /* ------------------------------- CONFIG --------------------------------- */
  var CFG = window.DENTICA_BOOKING_CONFIG = Object.assign({
    /* paste the n8n Production URL here — until then the widget runs in demo mode */
    webhookUrl: '',
    /* optional: same n8n workflow, GET ?date=YYYY-MM-DD -> {"taken":["09:00","09:30"]} */
    slotsUrl: '',
    receptionistWhatsapp: '201000000000',   /* digits only, country code first */
    clinicPhoneDisplay: '+20 100 000 0000',
    clinicName: { en: 'Dentica Dental Clinic', ar: 'عيادة دنتيكا لطب الأسنان' },
    clinicAddress: { en: 'Dentica Dental Clinic', ar: 'عيادة دنتيكا لطب الأسنان' },
    slotStep: 30,          /* minutes between slot starts */
    leadTimeHours: 2,      /* no booking closer than this to now */
    daysAhead: 45,         /* how far the calendar opens */
    /* 0 = Sunday … 6 = Saturday. null = closed */
    hours: {
      0: ['09:30', '17:30'], 1: ['08:00', '17:00'], 2: ['08:00', '17:00'],
      3: ['08:00', '17:00'], 4: ['08:00', '17:00'], 5: ['08:00', '17:00'],
      6: ['09:30', '17:30']
    },
    breakTime: ['13:00', '14:00'],
    services: [
      { id: 'consult',     en: 'Free consultation',    ar: 'استشارة مجانية',      min: 20 },
      { id: 'preventive',  en: 'Preventive dentistry', ar: 'الطب الوقائي',        min: 30 },
      { id: 'cosmetic',    en: 'Cosmetic dentistry',   ar: 'تجميل الأسنان',       min: 45 },
      { id: 'restorative', en: 'Restorative treatment',ar: 'علاجات ترميمية',      min: 60 },
      { id: 'ortho',       en: 'Orthodontics',         ar: 'تقويم الأسنان',       min: 45 },
      { id: 'emergency',   en: 'Emergency visit',      ar: 'زيارة طوارئ',         min: 30 }
    ]
  }, window.DENTICA_BOOKING_CONFIG || {});

  /* ------------------------------- STRINGS -------------------------------- */
  var T = {
    title:        { en: 'Book your appointment',  ar: 'احجز موعدك' },
    step:         { en: 'Step',                   ar: 'خطوة' },
    of:           { en: 'of',                     ar: 'من' },
    s1:           { en: 'Choose a service',       ar: 'اختار الخدمة' },
    s2:           { en: 'Pick a date & time',     ar: 'اختار اليوم والمعاد' },
    s3:           { en: 'Your details',           ar: 'بياناتك' },
    s4:           { en: 'Appointment confirmed',  ar: 'تم تأكيد الحجز' },
    mins:         { en: 'min',                    ar: 'دقيقة' },
    back:         { en: 'Back',                   ar: 'رجوع' },
    next:         { en: 'Continue',               ar: 'التالي' },
    confirm:      { en: 'Confirm booking',        ar: 'أكّد الحجز' },
    sending:      { en: 'Booking…',               ar: 'جاري الحجز…' },
    noSlots:      { en: 'No free times on this day — try another date.', ar: 'مفيش مواعيد فاضية في اليوم ده — جرّب يوم تاني.' },
    closed:       { en: 'Closed',                 ar: 'مغلق' },
    morning:      { en: 'Morning',                ar: 'صباحًا' },
    afternoon:    { en: 'Afternoon',              ar: 'بعد الظهر' },
    name:         { en: 'Full name',              ar: 'الاسم بالكامل' },
    phone:        { en: 'WhatsApp number',        ar: 'رقم الواتساب' },
    email:        { en: 'Email (optional)',       ar: 'الإيميل (اختياري)' },
    notes:        { en: 'Anything we should know? (optional)', ar: 'أي حاجة تحب تقولهالنا؟ (اختياري)' },
    firstVisit:   { en: 'This is my first visit', ar: 'دي أول زيارة ليا' },
    reqName:      { en: 'Please write your name', ar: 'اكتب اسمك من فضلك' },
    reqPhone:     { en: 'Please write a valid phone number', ar: 'اكتب رقم تليفون صحيح' },
    failed:       { en: 'Could not reach the clinic system. Send us the booking on WhatsApp instead.', ar: 'مقدرناش نوصل لنظام العيادة. ابعتلنا الحجز على واتساب.' },
    doneLead:     { en: 'See you soon', ar: 'نستناك' },
    doneBody:     { en: 'Our receptionist has your booking and will confirm on WhatsApp shortly.', ar: 'موظفة الاستقبال وصلها حجزك وهتأكدلك على الواتساب حالًا.' },
    ref:          { en: 'Reference',               ar: 'رقم الحجز' },
    addCal:       { en: 'Add to calendar',         ar: 'ضيفه للتقويم' },
    waConfirm:    { en: 'Confirm on WhatsApp',     ar: 'أكّد على واتساب' },
    close:        { en: 'Close',                   ar: 'إغلاق' },
    demoNote:     { en: 'Demo mode — no clinic system connected yet.', ar: 'وضع تجريبي — نظام العيادة لسه مش متوصل.' },
    heroCta:      { en: 'Choose a time',           ar: 'اختار معادك' },
    months:       { en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
                    ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'] },
    days:         { en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
                    ar: ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'] }
  };
  function lang() { return document.documentElement.getAttribute('data-lang') === 'ar' ? 'ar' : 'en'; }
  function t(k) { var v = T[k]; return v ? (v[lang()] !== undefined ? v[lang()] : v.en) : k; }

  /* ------------------------------- HELPERS -------------------------------- */
  var state = { step: 1, service: null, date: null, time: null, month: null, taken: [], busy: false, ref: null };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function toMin(hhmm) { var p = hhmm.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function toHHMM(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function pretty(hhmm) {
    var m = toMin(hhmm), h = Math.floor(m / 60), mm = m % 60;
    if (lang() === 'ar') return (h > 12 ? h - 12 : h) + ':' + pad(mm) + (h >= 12 ? ' م' : ' ص');
    var ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + pad(mm) + ' ' + ap;
  }
  function prettyDate(dstr) {
    var d = new Date(dstr + 'T00:00:00');
    return T.days[lang()][d.getDay()] + ' ' + d.getDate() + ' ' + T.months[lang()][d.getMonth()] + ' ' + d.getFullYear();
  }
  function svcName(s) { return s ? s[lang()] : ''; }
  function localBookings() { try { return JSON.parse(localStorage.getItem('dentica-bookings') || '[]'); } catch (e) { return []; } }
  function saveLocal(b) { try { var a = localBookings(); a.push(b); localStorage.setItem('dentica-bookings', JSON.stringify(a)); } catch (e) {} }

  function slotsFor(dstr, svc) {
    var d = new Date(dstr + 'T00:00:00'), h = CFG.hours[d.getDay()];
    if (!h) return [];
    var out = [], start = toMin(h[0]), end = toMin(h[1]), dur = (svc && svc.min) || 30;
    var bs = CFG.breakTime ? toMin(CFG.breakTime[0]) : -1, be = CFG.breakTime ? toMin(CFG.breakTime[1]) : -1;
    var now = new Date(), minTime = now.getTime() + CFG.leadTimeHours * 3600e3;
    for (var m = start; m + dur <= end; m += CFG.slotStep) {
      if (bs >= 0 && m < be && m + dur > bs) continue;                 /* overlaps lunch break */
      var slot = toHHMM(m);
      if (new Date(dstr + 'T' + slot + ':00').getTime() < minTime) continue;
      if (state.taken.indexOf(slot) !== -1) continue;
      out.push(slot);
    }
    return out;
  }

  function loadTaken(dstr, done) {
    var local = localBookings().filter(function (b) { return b.date === dstr; }).map(function (b) { return b.time; });
    if (!CFG.slotsUrl) { state.taken = local; return done(); }
    fetch(CFG.slotsUrl + (CFG.slotsUrl.indexOf('?') > -1 ? '&' : '?') + 'date=' + dstr)
      .then(function (r) { return r.json(); })
      .then(function (j) { state.taken = (j && j.taken ? j.taken : []).concat(local); done(); })
      .catch(function () { state.taken = local; done(); });
  }

  /* --------------------------------- DOM ---------------------------------- */
  var overlay, box;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function open(prefill) {
    if (!overlay) build();
    if (prefill) { state.prefill = prefill; }
    state.step = 1; state.service = null; state.date = null; state.time = null; state.ref = null;
    state.month = new Date(); state.month.setDate(1);
    overlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    render();
  }
  function close() {
    overlay.classList.remove('is-open');
    document.documentElement.style.overflow = '';
  }

  function build() {
    overlay = el('div', 'dbk-overlay');
    box = el('div', 'dbk-modal');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('is-open')) close(); });
  }

  function header() {
    var titles = ['s1', 's2', 's3', 's4'];
    var h = el('div', 'dbk-head');
    h.innerHTML =
      '<div class="dbk-head-txt">' +
        '<div class="dbk-kicker">' + (state.step < 4 ? t('step') + ' ' + state.step + ' ' + t('of') + ' 3' : t('title')) + '</div>' +
        '<h3 class="dbk-title">' + t(titles[state.step - 1]) + '</h3>' +
      '</div>' +
      '<button type="button" class="dbk-x" aria-label="' + t('close') + '">&times;</button>';
    h.querySelector('.dbk-x').addEventListener('click', close);
    var bar = el('div', 'dbk-progress', '<span style="width:' + (state.step / 4 * 100) + '%"></span>');
    var wrap = el('div');
    wrap.appendChild(h); wrap.appendChild(bar);
    return wrap;
  }

  /* step 1 — services */
  function stepService() {
    var w = el('div', 'dbk-body');
    var grid = el('div', 'dbk-svc-grid');
    CFG.services.forEach(function (s) {
      var b = el('button', 'dbk-svc' + (state.service && state.service.id === s.id ? ' is-on' : ''),
        '<span class="dbk-svc-name">' + s[lang()] + '</span><span class="dbk-svc-min">' + s.min + ' ' + t('mins') + '</span>');
      b.type = 'button';
      b.addEventListener('click', function () { state.service = s; state.step = 2; render(); });
      grid.appendChild(b);
    });
    w.appendChild(grid);
    return w;
  }

  /* step 2 — calendar + slots */
  function stepWhen() {
    var w = el('div', 'dbk-body dbk-when');
    var cal = el('div', 'dbk-cal');
    var m = state.month, first = new Date(m.getFullYear(), m.getMonth(), 1);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var last = new Date(today.getTime() + CFG.daysAhead * 864e5);

    var nav = el('div', 'dbk-cal-nav',
      '<button type="button" class="dbk-mo" data-d="-1" aria-label="prev">&#8249;</button>' +
      '<strong>' + T.months[lang()][m.getMonth()] + ' ' + m.getFullYear() + '</strong>' +
      '<button type="button" class="dbk-mo" data-d="1" aria-label="next">&#8250;</button>');
    nav.querySelectorAll('.dbk-mo').forEach(function (b) {
      b.addEventListener('click', function () {
        state.month = new Date(m.getFullYear(), m.getMonth() + (+b.dataset.d), 1);
        render();
      });
    });
    cal.appendChild(nav);

    var dow = el('div', 'dbk-dow');
    T.days[lang()].forEach(function (d) { dow.appendChild(el('span', null, d)); });
    cal.appendChild(dow);

    var grid = el('div', 'dbk-days');
    for (var i = 0; i < first.getDay(); i++) grid.appendChild(el('span', 'dbk-day is-empty'));
    var dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    for (var d = 1; d <= dim; d++) {
      var dt = new Date(m.getFullYear(), m.getMonth(), d), s = ymd(dt);
      var closed = !CFG.hours[dt.getDay()];
      var off = dt < today || dt > last || closed;
      var b = el('button', 'dbk-day' + (off ? ' is-off' : '') + (state.date === s ? ' is-on' : ''), String(d));
      b.type = 'button'; b.dataset.date = s;
      if (off) b.disabled = true;
      else b.addEventListener('click', function () {
        state.date = this.dataset.date; state.time = null;
        loadTaken(state.date, render);
      });
      grid.appendChild(b);
    }
    cal.appendChild(grid);
    w.appendChild(cal);

    var right = el('div', 'dbk-slots');
    if (!state.date) {
      right.appendChild(el('p', 'dbk-hint', lang() === 'ar' ? 'اختار يوم الأول' : 'Pick a day first'));
    } else {
      var slots = slotsFor(state.date, state.service);
      right.appendChild(el('div', 'dbk-slots-head', prettyDate(state.date)));
      if (!slots.length) right.appendChild(el('p', 'dbk-hint', t('noSlots')));
      else {
        ['morning', 'afternoon'].forEach(function (part) {
          var list = slots.filter(function (s) { return part === 'morning' ? toMin(s) < 720 : toMin(s) >= 720; });
          if (!list.length) return;
          right.appendChild(el('div', 'dbk-slot-label', t(part)));
          var g = el('div', 'dbk-slot-grid');
          list.forEach(function (s) {
            var b = el('button', 'dbk-slot' + (state.time === s ? ' is-on' : ''), pretty(s));
            b.type = 'button';
            b.addEventListener('click', function () { state.time = s; state.step = 3; render(); });
            g.appendChild(b);
          });
          right.appendChild(g);
        });
      }
    }
    w.appendChild(right);
    return w;
  }

  /* step 3 — details */
  function stepDetails() {
    var w = el('div', 'dbk-body');
    var p = state.prefill || {};
    w.appendChild(el('div', 'dbk-summary',
      '<span>' + svcName(state.service) + ' · ' + state.service.min + ' ' + t('mins') + '</span>' +
      '<strong>' + prettyDate(state.date) + ' — ' + pretty(state.time) + '</strong>'));
    var f = el('form', 'dbk-form');
    f.innerHTML =
      '<label class="dbk-field"><span>' + t('name') + '</span><input name="name" required value="' + (p.name || '') + '"/></label>' +
      '<label class="dbk-field"><span>' + t('phone') + '</span><input name="phone" inputmode="tel" required value="' + (p.phone || '') + '"/></label>' +
      '<label class="dbk-field"><span>' + t('email') + '</span><input name="email" type="email"/></label>' +
      '<label class="dbk-field"><span>' + t('notes') + '</span><textarea name="notes" rows="2"></textarea></label>' +
      '<label class="dbk-check"><input type="checkbox" name="first"/><span>' + t('firstVisit') + '</span></label>' +
      '<p class="dbk-error" hidden></p>' +
      '<button type="submit" class="dbk-primary">' + t('confirm') + '</button>';
    f.addEventListener('submit', function (e) { e.preventDefault(); submit(f); });
    w.appendChild(f);
    return w;
  }

  /* step 4 — confirmation */
  function stepDone() {
    var w = el('div', 'dbk-body dbk-done');
    var b = state.booking;
    w.innerHTML =
      '<div class="dbk-tick">&#10003;</div>' +
      '<h4>' + t('doneLead') + ', ' + b.name + '</h4>' +
      '<p>' + t('doneBody') + '</p>' +
      '<div class="dbk-recap">' +
        '<div><span>' + t('s1') + '</span><strong>' + b.serviceName + '</strong></div>' +
        '<div><span>' + t('s2') + '</span><strong>' + prettyDate(b.date) + ' — ' + pretty(b.time) + '</strong></div>' +
        '<div><span>' + t('ref') + '</span><strong>' + b.ref + '</strong></div>' +
      '</div>' +
      (state.demo ? '<p class="dbk-demo">' + t('demoNote') + '</p>' : '') +
      '<div class="dbk-done-actions">' +
        '<a class="dbk-primary" id="dbk-wa" target="_blank" rel="noopener">' + t('waConfirm') + '</a>' +
        '<a class="dbk-ghost" id="dbk-ics" download="dentica-appointment.ics">' + t('addCal') + '</a>' +
      '</div>';
    w.querySelector('#dbk-wa').href = waLink(b);
    w.querySelector('#dbk-ics').href = icsLink(b);
    return w;
  }

  function footer() {
    if (state.step === 1 || state.step === 4) return null;
    var f = el('div', 'dbk-foot');
    var back = el('button', 'dbk-ghost', '&#8592; ' + t('back'));
    back.type = 'button';
    back.addEventListener('click', function () { state.step = Math.max(1, state.step - 1); render(); });
    f.appendChild(back);
    return f;
  }

  function render() {
    box.innerHTML = '';
    box.appendChild(header());
    box.appendChild([stepService, stepWhen, stepDetails, stepDone][state.step - 1]());
    var f = footer(); if (f) box.appendChild(f);
    box.scrollTop = 0;
  }

  /* ------------------------------- SUBMIT --------------------------------- */
  function waLink(b) {
    var msg = lang() === 'ar'
      ? '🦷 حجز جديد - ' + CFG.clinicName.ar + '\n\nالاسم: ' + b.name + '\nالتليفون: ' + b.phone +
        '\nالخدمة: ' + b.serviceName + '\nالمعاد: ' + prettyDate(b.date) + ' - ' + pretty(b.time) +
        '\nرقم الحجز: ' + b.ref + (b.notes ? '\nملاحظات: ' + b.notes : '')
      : '🦷 New booking - ' + CFG.clinicName.en + '\n\nName: ' + b.name + '\nPhone: ' + b.phone +
        '\nService: ' + b.serviceName + '\nWhen: ' + prettyDate(b.date) + ' - ' + pretty(b.time) +
        '\nRef: ' + b.ref + (b.notes ? '\nNotes: ' + b.notes : '');
    return 'https://wa.me/' + CFG.receptionistWhatsapp + '?text=' + encodeURIComponent(msg);
  }

  function icsLink(b) {
    function stamp(dstr, hhmm, addMin) {
      var d = new Date(dstr + 'T' + hhmm + ':00');
      d.setMinutes(d.getMinutes() + (addMin || 0));
      return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
    }
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dentica//Booking//EN', 'BEGIN:VEVENT',
      'UID:' + b.ref + '@dentica', 'DTSTART:' + stamp(b.date, b.time), 'DTEND:' + stamp(b.date, b.time, b.duration),
      'SUMMARY:' + b.serviceName + ' — ' + CFG.clinicName.en, 'DESCRIPTION:Ref ' + b.ref + ' · ' + CFG.clinicPhoneDisplay,
      'LOCATION:' + CFG.clinicName.en, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  }

  function makeRef() {
    return 'DEN-' + String(Date.now()).slice(-6) + '-' + Math.floor(Math.random() * 90 + 10);
  }

  function submit(form) {
    if (state.busy) return;
    var fd = new FormData(form), err = form.querySelector('.dbk-error');
    var name = (fd.get('name') || '').toString().trim();
    var phone = (fd.get('phone') || '').toString().trim();
    err.hidden = true;
    if (name.length < 2) { err.textContent = t('reqName'); err.hidden = false; return; }
    if (phone.replace(/\D/g, '').length < 8) { err.textContent = t('reqPhone'); err.hidden = false; return; }

    var b = {
      ref: makeRef(),
      name: name, phone: phone,
      email: (fd.get('email') || '').toString().trim(),
      notes: (fd.get('notes') || '').toString().trim(),
      firstVisit: !!fd.get('first'),
      serviceId: state.service.id,
      serviceName: svcName(state.service),
      serviceEn: state.service.en,
      duration: state.service.min,
      date: state.date, time: state.time,
      startsAt: state.date + 'T' + state.time + ':00',
      lang: lang(),
      source: location.pathname.split('/').pop() || 'index.html',
      createdAt: new Date().toISOString()
    };

    var btn = form.querySelector('.dbk-primary');
    state.busy = true; btn.disabled = true; btn.textContent = t('sending');

    function done(demo) {
      state.busy = false; state.demo = demo; state.booking = b;
      saveLocal({ date: b.date, time: b.time, ref: b.ref });
      state.step = 4; render();
    }

    if (!CFG.webhookUrl) { setTimeout(function () { done(true); }, 450); return; }

    fetch(CFG.webhookUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b)
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json().catch(function () { return {}; });
    }).then(function (j) {
      if (j && j.ref) b.ref = j.ref;
      done(false);
    }).catch(function () {
      err.textContent = t('failed'); err.hidden = false;
      state.busy = false; btn.disabled = false; btn.textContent = t('confirm');
      window.open(waLink(b), '_blank');
    });
  }

  /* ------------------------------- WIRING --------------------------------- */
  function wire() {
    /* every "Book / Get appointment" CTA opens the booking flow instead of raw WhatsApp */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="wa.me"]');
      if (!a || a.closest('.dbk-modal')) return;
      e.preventDefault();
      open();
    });

    /* the hero card becomes step 0: name + phone, then straight into the flow */
    var form = document.querySelector('.lead-form');
    if (form) {
      form.removeAttribute('onsubmit');   /* drop the old "open WhatsApp" handler */
      form.onsubmit = null;
      var btn = form.querySelector('.lead-form_btn');
      if (btn) { btn.setAttribute('data-dbk-cta', ''); btn.textContent = t('heroCta'); }
      form.addEventListener('submit', function (e) {
        e.preventDefault(); e.stopImmediatePropagation();
        var inputs = form.querySelectorAll('input');
        open({ name: (inputs[0] || {}).value || '', phone: (inputs[1] || {}).value || '' });
      }, true);
    }

    /* deep link: /index.html#book or ?book=1 opens the flow straight away
       (handy for ad links, the WhatsApp bio, or a QR code at the reception desk) */
    if (location.hash === '#book' || /[?&]book=1/.test(location.search)) setTimeout(function () { open(); }, 300);

    /* keep the booking UI in the active language */
    document.addEventListener('dentica:lang', function () {
      var b = document.querySelector('.lead-form_btn[data-dbk-cta]');
      if (b) b.textContent = t('heroCta');
      if (overlay && overlay.classList.contains('is-open')) render();
    });
  }

  window.DenticaBooking = { open: open, close: close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
