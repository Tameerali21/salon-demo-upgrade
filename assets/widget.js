/* Ruby — "Never Miss a Customer" demo chat engine (salon edition).
   100% client-side. No network calls, no tracking. Works from file:// .
   Leads are persisted to localStorage (simulated owner dashboard).
   Test hooks: ?fast=1 skips delays; window.__maya exposes state + send();
   window.__getLeads/__clearLeads expose and reset the persisted leads. */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var FAST = qs.get('fast') === '1';

  /* ---------- business profile (personalizable via ?biz= etc.) ---------- */
  var BIZ = {
    name:    qs.get('biz')     || 'Rosegold & Rye Salon',
    tagline: qs.get('tagline') || 'Hair · Color · Bridal',
    city:    qs.get('city')    || 'Scottsdale, AZ',
    address: qs.get('addr') || qs.get('address') || '4178 N Goldwater Blvd, Scottsdale, AZ 85251',
    phone:   qs.get('phone')   || '(480) 555-0187',
    host: 'Ruby'
  };
  // short ref prefix from the name's initials, e.g. "Rosegold & Rye" -> "RR"
  BIZ.refPrefix = (BIZ.name.split(/\s+/).map(function (w) { return w.charAt(0); }).filter(function (c) { return /[A-Za-z]/.test(c); }).join('').slice(0, 2).toUpperCase()) || 'RR';

  /* apply personalization to the page */
  function personalize() {
    document.querySelectorAll('[data-biz="name"]').forEach(function (el) { el.textContent = BIZ.name; });
    document.querySelectorAll('[data-biz="tagline"]').forEach(function (el) { el.textContent = BIZ.tagline; });
    document.querySelectorAll('[data-biz="city"]').forEach(function (el) { el.textContent = BIZ.city; });
    document.querySelectorAll('[data-biz="address"]').forEach(function (el) { el.textContent = BIZ.address; });
    document.querySelectorAll('[data-biz="phone"]').forEach(function (el) { el.textContent = BIZ.phone; });
    document.querySelectorAll('[data-biz="host"]').forEach(function (el) { el.textContent = BIZ.host; });
    document.querySelectorAll('[data-biz="host-initial"]').forEach(function (el) { el.textContent = BIZ.host.charAt(0); });
    document.title = BIZ.name + ' — ' + BIZ.tagline + ' | ' + BIZ.city;
  }
  /* ---------- deep personalization: ?services= ?hours= ----------
     services: pipe-separated REAL service names -> rendered into the services grid (max 8).
     hours: pipe-separated "Day(s): time" pairs -> rendered into the hours table (max 6).
     Graceful fallback: the page keeps its built-in fictional content when a param is absent. */
  function dpEsc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function deepPersonalize() {
    var svc = qs.get('services');
    if (svc) {
      var items = svc.split('|').map(function (s) { return s.trim(); }).filter(function (s) { return s; }).slice(0, 8);
      var grid = document.querySelector('#services .menu-grid, #menu .menu-grid, #rooms .menu-grid, #practice .menu-grid, #services .cards');
      if (grid && items.length) {
        var isCards = grid.classList.contains('cards');
        grid.innerHTML = items.map(function (name) {
          var n = dpEsc(name);
          if (isCards) {
            return '<div class="card"><div class="ico">&#10003;</div><h3>' + n + '</h3>' +
              '<p>Offered at ' + dpEsc(BIZ.name) + ' &mdash; chat below for details &amp; pricing.</p></div>';
          }
          return '<div class="menu-card"><div class="cat">Service</div><h3>' + n + '</h3>' +
            '<p>Offered at ' + dpEsc(BIZ.name) + ' &mdash; ask ' + dpEsc(BIZ.host) + ' below for details &amp; pricing.</p></div>';
        }).join('');
      }
    }
    var hrs = qs.get('hours');
    if (hrs) {
      var rows = hrs.split('|').map(function (s) { return s.trim(); }).filter(function (s) { return s; }).slice(0, 6);
      var table = document.querySelector('table.hours') || document.querySelector('#visit table');
      if (table && rows.length) {
        var chatCell = null;
        Array.prototype.forEach.call(table.rows, function (r) {
          if (/chat/i.test(r.textContent) && r.cells[1]) chatCell = r.cells[1].innerHTML;
        });
        var html = rows.map(function (r) {
          var i = r.indexOf(':');
          var day = (i > 0 ? r.slice(0, i) : r).trim();
          var time = (i > 0 ? r.slice(i + 1) : '').trim();
          return '<tr><td>' + dpEsc(day) + '</td><td>' + dpEsc(time) + '</td></tr>';
        }).join('');
        if (chatCell) html += '<tr><td>Chat with ' + dpEsc(BIZ.host) + '</td><td>' + chatCell + '</td></tr>';
        table.innerHTML = html;
      }
    }
  }


  /* ---------- dom ---------- */
  var panel, msgs, chipsBox, input, bubble, unread, closeBtn;
  var opened = false, autoOpened = false, greeted = false;

  /* conversation state */
  var S = {
    mode: 'idle',          // idle | booking | afterhours | review
    step: 0,
    booking: {},
    ah: {},
    lastTopic: null
  };

  function $(id) { return document.getElementById(id); }

  function delay(ms) {
    return new Promise(function (res) { setTimeout(res, FAST ? 0 : ms); });
  }

  function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }

  /* ---------- rendering ---------- */
  function addUser(text) {
    var row = el('div', 'mrow user');
    row.appendChild(el('div', 'bubble', escapeHtml(text)));
    msgs.appendChild(row); scrollDown();
  }

  function addBot(html, opts) {
    var row = el('div', 'mrow bot');
    row.appendChild(el('div', 'mavatar', BIZ.host.charAt(0)));
    var b = el('div', 'bubble', html);
    row.appendChild(b);
    msgs.appendChild(row);
    if (opts && opts.notice) b.classList.add('notice');
    scrollDown();
    return b;
  }

  function addNotice(html) {
    var row = el('div', 'mrow bot');
    row.appendChild(el('div', 'notice', html));
    row.style.maxWidth = '100%';
    msgs.appendChild(row); scrollDown();
  }

  function addDashCard(rows) {
    var row = el('div', 'mrow bot');
    var card = el('div', 'dashcard');
    card.appendChild(el('div', 'dl-head', '&#128203; Saved to your dashboard'));
    rows.forEach(function (r) {
      card.appendChild(el('div', 'dl-row', '<span>' + r[0] + ':</span> <b>' + escapeHtml(r[1]) + '</b>'));
    });
    row.appendChild(card);
    row.style.maxWidth = '100%';
    msgs.appendChild(row); scrollDown();
  }

  function showTyping() {
    var row = el('div', 'mrow bot', '');
    row.id = 'maya-typing-row';
    row.appendChild(el('div', 'mavatar', BIZ.host.charAt(0)));
    var b = el('div', 'bubble typing', '<i></i><i></i><i></i>');
    row.appendChild(b);
    msgs.appendChild(row); scrollDown();
  }
  function hideTyping() {
    var t = $('maya-typing-row');
    if (t) t.remove();
  }

  function setChips(list) {
    chipsBox.innerHTML = '';
    (list || []).forEach(function (c) {
      var btn = el('button', 'chip', c.label);
      btn.type = 'button';
      btn.addEventListener('click', function () { userSays(c.value || c.label, c.silent); });
      chipsBox.appendChild(btn);
    });
    scrollDown();
  }

  function showStars() {
    chipsBox.innerHTML = '';
    var wrap = el('div', 'stars-row');
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var s = el('button', 'star-btn', '&#11088;');
        s.type = 'button';
        s.setAttribute('aria-label', n + ' star' + (n > 1 ? 's' : ''));
        s.addEventListener('click', function () { pickStars(n); });
        wrap.appendChild(s);
      })(i);
    }
    chipsBox.appendChild(wrap);
    scrollDown();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- bot speech ---------- */
  function say(html, chips, opts) {
    showTyping();
    var wait = Math.min(700 + html.length * 6, 1900);
    return delay(wait).then(function () {
      hideTyping();
      addBot(html);
      setChips(chips);
    });
  }

  function sayMany(items) {
    // items: [{html, chips, notice, dash}]
    var p = Promise.resolve();
    items.forEach(function (it) {
      p = p.then(function () {
        showTyping();
        var wait = Math.min(600 + (it.html || '').length * 5, 1700);
        return delay(wait).then(function () {
          hideTyping();
          if (it.dash) { addDashCard(it.dash); }
          else if (it.notice) { addNotice(it.html); }
          else { addBot(it.html); }
          setChips(it.chips);
        });
      });
    });
    return p;
  }

  /* ---------- helpers ---------- */
  function makeRef() {
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var r = '';
    for (var i = 0; i < 5; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
    return BIZ.refPrefix + '-' + r;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* word-start keyword match (proven 2026-10-03 standard): "anywhere" must not
     trigger the location branch via "where", "foreclosure" must not trip hours
     via "close", "separate my bills" must not trip review via "rate", "recall
     our chat" must not trip the human branch via "call". Prefix keywords like
     'schedul'/'appoint' still match 'schedule'/'appointment'; phrases keep
     word-start match. */
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function has(t) {
    var words = Array.prototype.slice.call(arguments, 1);
    return words.some(function (w) {
      return new RegExp('(^|[^a-z])' + escRe(w)).test(t);
    });
  }

  /* Simulated owner dashboard: leads persist in the browser (localStorage).
     A real client build syncs these to the salon's CRM / booking system. */
  var LEAD_KEY = 'nmc_salon_leads';
  var leads = [];
  try { leads = JSON.parse(localStorage.getItem(LEAD_KEY) || '[]'); } catch (e) { leads = []; }
  function saveLead(l) {
    l.at = new Date().toISOString(); l.biz = BIZ.name;
    leads.push(l);
    try { localStorage.setItem(LEAD_KEY, JSON.stringify(leads)); } catch (e) {}
  }

  /* ---------- intent answers ---------- */
  function hoursHtml() {
    return '<b>Our hours:</b><br>Mon&ndash;Fri &middot; 9 AM &ndash; 7 PM<br>' +
      'Saturday &middot; 9 AM &ndash; 5 PM<br>Sunday &middot; closed<br><br>' +
      'Evening slots book out first &mdash; want me to <b>hold one for you</b>?';
  }

  function servicesHtml() {
    return 'Everything your hair could want, under one golden roof. &#10024;<br><br>' +
      '<b>Most loved:</b><br>&middot; Signature cut &amp; blowout &mdash; from <b>$65</b><br>' +
      '&middot; Balayage &mdash; from <b>$185</b><br>' +
      '&middot; Highlights &mdash; from <b>$145</b><br>' +
      '&middot; Keratin smoothing &mdash; from <b>$225</b><br>' +
      '&middot; Bridal package &mdash; from <b>$295</b><br><br>' +
      'Every color service starts with a <b>free consultation</b> &mdash; zero pressure. What are you dreaming of?';
  }

  function cutHtml() {
    return 'Our <b>Signature Cut &amp; Blowout from $65</b> &mdash; precision cut, wash, and a blowout that actually survives the week. &#9986;<br><br>' +
      'New guests get a <b>free consultation</b> first so the cut fits your face and your routine. Shall I book you in?';
  }

  function colorHtml() {
    return 'Color is our love language. &#127912;<br><br>' +
      '&middot; Full color &mdash; from <b>$95</b><br>' +
      '&middot; Highlights (partial/full) &mdash; from <b>$145</b><br>' +
      '&middot; Balayage &mdash; from <b>$185</b><br><br>' +
      'All with a <b>free consultation</b> &mdash; we map your dream shade before a single foil touches your head. Want me to book you in?';
  }

  function balayageHtml() {
    return 'Balayage from <b>$185</b> &mdash; hand-painted, sun-kissed dimension that <b>grows out soft</b> (no harsh lines, no panic appointments). &#10024;<br><br>' +
      'Our master colorists start every balayage with a <b>free consultation</b>. Shall I book yours?';
  }

  function highlightsHtml() {
    return 'Highlights from <b>$145</b> (partial or full) &mdash; foil-perfect brightness, tailored to your skin tone. &#10024;<br><br>' +
      'Includes a <b>free consultation</b> so we nail the exact shade. Want me to hold a chair for you?';
  }

  function keratinHtml() {
    return 'Keratin Smoothing from <b>$225</b> &mdash; frizz gone for <b>months</b>. Silky, glassy, five-minute mornings. &#127774;<br><br>' +
      'For stressed, over-processed hair, our Deep Repair Ritual from <b>$45</b> rebuilds bonds first. Both start with a <b>free consultation</b>. Book one?';
  }

  function bridalHtml() {
    return 'Bridal is our specialty. &#128141;<br><br>' +
      '<b>Bridal Package from $295</b>: trial + day-of hair for the bride &mdash; champagne on us. Updos &amp; occasion styling from <b>$75</b>.<br><br>' +
      'We book bridal parties up to a year out, and dates go fast. Want a <b>free consultation</b> to start planning?';
  }

  function consultHtml() {
    return 'Yes &mdash; <b>consultations are always free</b>. &#129309;<br><br>' +
      'You&rsquo;ll sit with a real stylist, talk through your hair goals, and leave with an honest plan and exact pricing &mdash; <b>zero pressure, zero charge</b>. Shall I book yours?';
  }

  function defaultChips() {
    return [
      { label: '&#9986; Our services' },
      { label: '&#128197; Book an appointment' },
      { label: '&#127769; After-hours demo' },
      { label: '&#11088; Rate your visit' }
    ];
  }

  function greet() {
    greeted = true;
    return say(
      'Hi beautiful! I\'m <b>' + escapeHtml(BIZ.host) + '</b>, ' + escapeHtml(BIZ.name) + '\'s style coordinator. &#10024;<br><br>' +
      'Ask me about <b>cuts</b>, <b>color</b>, <b>keratin</b> or <b>bridal</b> &mdash; or I can <b>book your appointment</b> right now. What can I help with?',
      defaultChips()
    );
  }

  /* ---------- flows ---------- */
  var REASONS = ['Cut & style', 'Balayage', 'Highlights', 'Full color', 'Keratin', 'Bridal', 'Free consultation'];

  function startBooking() {
    S.mode = 'booking'; S.step = 0; S.booking = {};
    return say('Wonderful &mdash; let\'s get you gorgeous. <b>What are you dreaming of?</b>',
      REASONS.map(function (r) { return { label: r }; }));
  }

  function bookingStep(text) {
    var t = text.toLowerCase().trim();
    if (S.step === 0) {
      /* word-start reason detection (house standard) — no indexOf loop */
      var reason = 'Free consultation';
      if (has(t, 'balayage')) reason = 'Balayage';
      if (has(t, 'highlight', 'foil', 'lowlights')) reason = 'Highlights';
      if (has(t, 'keratin', 'smoothing', 'frizz')) reason = 'Keratin';
      if (has(t, 'bridal', 'wedding', 'bride')) reason = 'Bridal';
      if (has(t, 'cut', 'blowout', 'trim', 'style')) reason = 'Cut & style';
      if (has(t, 'color', 'dye')) reason = 'Full color';
      S.booking.reason = reason; S.step = 1;
      return say('<b>' + escapeHtml(reason) + '</b> &mdash; excellent choice. <b>What\'s your name?</b>');
    }
    if (S.step === 1) {
      var name = text.trim();
      if (name.length < 2 || name.length > 40) {
        return say('And your <b>name</b> for the appointment?');
      }
      S.booking.name = name; S.step = 2;
      return say('Lovely to meet you, ' + escapeHtml(cap(name.split(' ')[0])) +
        '! Want a <b>text reminder</b> before your visit? Drop your number &mdash; or skip it.',
        [{ label: 'Skip', value: 'skip' }]);
    }
    if (S.step === 2) {
      var digits = t.replace(/\D/g, '');
      // FIXED validation: digit-less text like "notaphone" must be rejected
      if (t !== 'skip' && digits.length < 7) {
        return say('Hmm, that doesn\'t look like a complete number &mdash; mind double-checking it? <i>(or tap Skip)</i>',
          [{ label: 'Skip', value: 'skip' }]);
      }
      if (t !== 'skip') S.booking.phone = text.trim();
      S.step = 3;
      return say('<b>Which day</b> works best for you?',
        [{ label: 'Tomorrow' }, { label: 'Thursday' }, { label: 'Friday' }, { label: 'Saturday' }]);
    }
    if (S.step === 3) {
      var day = 'Friday';
      if (has(t, 'tomorrow', 'today')) day = 'Tomorrow';
      else {
        var dm = t.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/);
        if (dm) day = cap(dm[0]);
      }
      S.booking.day = day; S.step = 4;
      return say('<b>' + escapeHtml(day) + '</b> &mdash; perfect. <b>Morning or afternoon</b> &mdash; what time suits you?',
        [{ label: '10:00 AM' }, { label: '12:30 PM' }, { label: '3:00 PM' }, { label: '5:30 PM' }]);
    }
    if (S.step === 4) {
      var tm = t.match(/\d{1,2}(:\d{2})?\s*(am|pm)?/);
      if (!tm) {
        return say('What <b>time</b> should I hold for you? <i>(e.g. 3:00 PM)</i>',
          [{ label: '10:00 AM' }, { label: '3:00 PM' }, { label: '5:30 PM' }]);
      }
      var time = text.trim();
      if (!/am|pm/i.test(time)) time += ' PM';
      var ref = makeRef();
      S.booking.ref = ref;
      var line = '<b>&#9989; You\'re booked!</b><br><br><b>' +
        escapeHtml(S.booking.reason) + '</b> &middot; ' + escapeHtml(S.booking.day) + ' at <b>' + escapeHtml(time) + '</b><br>Guest: <b>' + escapeHtml(S.booking.name) + '</b><br>' +
        'Reference: <span class="ref">' + ref + '</span><br><br>';
      if (S.booking.phone) line += 'We\'ll text your reminder. ';
      line += 'Arrive with clean, dry hair if you can &mdash; we&rsquo;ll take great care of you. Anything else I can help with?';
      S.mode = 'idle'; S.step = 0;
      return say(line, [{ label: '&#9986; Our services' }, { label: '&#128336; Hours & location' }]);
    }
  }

  function startAfterHours() {
    S.mode = 'afterhours'; S.step = 0; S.ah = {};
    return sayMany([
      {
        notice: true,
        html: '&#127769; <b>It\'s 11:42 PM</b> &mdash; we\'re closed right now, but I\'m ' + escapeHtml(BIZ.host) +
          ', ' + escapeHtml(BIZ.name) + '\'s style coordinator, and I\'m still here. <b>Hair dreams don\'t keep office hours.</b>'
      },
      { html: 'Tell me your <b>name</b> and I\'ll make sure the morning team reaches out first thing &mdash; <b>Saturday chairs go fast</b>.' }
    ]);
  }

  function afterHoursStep(text) {
    var t = text.trim();
    if (S.step === 0) {
      if (t.length < 2 || t.length > 40 || /\d/.test(t)) {
        return say('What <b>name</b> should I save this under?');
      }
      S.ah.name = t; S.step = 1;
      return say('Thanks, ' + escapeHtml(cap(t.split(' ')[0])) + '! And the best <b>number</b> for the morning team to reach you?');
    }
    if (S.step === 1) {
      var digits = t.replace(/\D/g, '');
      // FIXED validation: digit-less text like "notaphone" must be rejected
      if (digits.length < 7) {
        return say('Hmm, that doesn\'t look like a complete number &mdash; mind double-checking it? <i>(digits only is fine)</i>');
      }
      S.ah.phone = t; S.step = 2;
      return say('Got it. And just between us &mdash; <b>what\'s your hair dream?</b>',
        [{ label: 'Balayage', value: 'Balayage' }, { label: 'Color', value: 'Color' }, { label: 'Keratin', value: 'Keratin' }, { label: 'Skip', value: 'skip' }]);
    }
    if (S.step === 2) {
      S.ah.goal = (t === 'skip') ? 'General inquiry' : t;
      S.mode = 'idle'; S.step = 0;
      saveLead({
        name: S.ah.name,
        phone: S.ah.phone,
        goal: S.ah.goal,
        captured: '11:42 PM (after hours)',
        source: 'after-hours demo'
      });
      return sayMany([
        { html: '<b>&#9989; Saved!</b> The morning team will reach out <b>first thing</b> &mdash; Saturday chairs go fast, and now you&rsquo;re first in line. No need to wonder till 9 AM if anyone saw your message.' },
        {
          dash: [
            ['New lead', S.ah.name],
            ['Phone', S.ah.phone],
            ['Hair goal', S.ah.goal],
            ['Captured', '11:42 PM (after hours)']
          ]
        },
        {
          html: 'That\'s the whole point &mdash; <b>every midnight hair-dreamer becomes a morning booking</b>, not a client lost to the salon down the street. Anything else tonight?',
          chips: defaultChips()
        }
      ]);
    }
  }

  function startReview() {
    S.mode = 'review'; S.step = 0;
    return say('We\'d love to hear it &mdash; <b>how was your visit?</b> Tap the stars:').then(function () {
      showStars();
    });
  }

  function pickStars(n) {
    chipsBox.innerHTML = '';
    addUser('\u2B50'.repeat(n));
    if (n === 5) {
      S.mode = 'idle';
      say('You just made our whole team shine! &#128525;<br><br>Would you <b>share that on Google</b>? It genuinely keeps a local salon like ours thriving.',
        [{ label: 'Not now', value: 'not now' }]).then(function () {
          var row = document.querySelector('#maya-msgs .mrow.bot:last-child .bubble');
          if (row) {
            var a = document.createElement('a');
            a.className = 'gbtn'; a.href = 'https://www.google.com/maps'; a.target = '_blank'; a.rel = 'noopener';
            a.textContent = '\u2B50 Leave a Google review';
            row.appendChild(document.createElement('br'));
            row.appendChild(a); scrollDown();
          }
        });
    } else {
      S.mode = 'review'; S.step = 1;
      say('Thank you for being honest &mdash; that\'s how we get better. <b>What could we do better</b> next time?');
    }
  }

  function reviewStep(text) {
    S.mode = 'idle'; S.step = 0;
    /* 1-4 star feedback is private — persisted as a lead, like the dental/med-spa standard */
    saveLead({ name: '(review feedback)', phone: '\u2014', topic: 'Private feedback', details: text.trim(), source: 'review routing' });
    return say('<b>Noted &mdash; truly.</b> Our salon manager will personally follow up on this.<br><br>' +
      'We\'d love a second chance to earn those last stars. Can I book you a free consultation?',
      [{ label: '&#128197; Book an appointment' }, { label: 'No thanks', value: 'no thanks' }]);
  }

  /* ---------- main router ---------- */
  function route(text) {
    var t = text.toLowerCase().trim();

    if (S.mode === 'booking') return bookingStep(text);
    if (S.mode === 'afterhours') return afterHoursStep(text);
    if (S.mode === 'review' && S.step === 1) return reviewStep(text);

    if (has(t, 'book', 'appoint', 'schedul')) return startBooking();
    if (has(t, 'after hour', 'after-hour', 'closed', 'late night', 'midnight', '11:42')) return startAfterHours();
    if (has(t, 'review', 'rate', 'stars', 'feedback')) return startReview();
    if (has(t, 'balayage')) return say(balayageHtml(), [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'highlight', 'foil', 'lowlights')) return say(highlightsHtml(), [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'keratin', 'smoothing', 'frizz', 'repair', 'treatment', 'bond')) return say(keratinHtml(), [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'bridal', 'bride', 'wedding')) return say(bridalHtml(), [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'cut', 'blowout', 'trim', 'bangs')) return say(cutHtml(), [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'color', 'dye', 'root', 'ombre', 'ombr')) return say(colorHtml(), [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'updo', 'occasion', 'prom', 'styling')) return say('Updo &amp; occasion styling from <b>$75</b> &mdash; weddings, galas, date night, hair that photographs beautifully. &#128141;<br><br>Every style starts with a <b>free consultation</b>. Shall I book you in?', [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'consult')) return say(consultHtml(), [{ label: '&#128197; Book an appointment' }]);
    /* location branch runs before service branches (house standard) */
    if (has(t, 'where', 'address', 'location', 'direction', 'park', 'find you')) {
      return say('Find us at <b>' + escapeHtml(BIZ.address) + '</b> &mdash; easy in-and-out in ' + escapeHtml(BIZ.city) + ', free parking right outside. &#128205;<br><br>Call us anytime: <b>' + escapeHtml(BIZ.phone) + '</b>',
        [{ label: '&#128197; Book an appointment' }]);
    }
    if (has(t, 'hour', 'open', 'close', 'when do you', 'what time')) return say(hoursHtml(), [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'service', 'offer', 'do you do', 'price list', 'menu')) return say(servicesHtml(), [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'price', 'cost', 'how much', 'expensive', 'cheap', '$$', 'fee')) return say('Honest pricing, in writing: signature cut &amp; blowout from <b>$65</b>, full color from <b>$95</b>, highlights from <b>$145</b>, balayage from <b>$185</b>, keratin from <b>$225</b>, bridal package from <b>$295</b>. Consultations are <b>always free</b>. &#10024;', [{ label: '&#9986; Our services' }]);
    if (has(t, 'human', 'person', 'real person', 'call you', 'phone number', 'speak to', 'stylist', 'colorist')) return say('Of course &mdash; call us at <b>' + escapeHtml(BIZ.phone) + '</b> during open hours and a real human picks up. But honestly? I can handle <b>appointments, services, and pricing</b> right here, even at 2 AM. &#128521;', defaultChips());
    if (has(t, 'thank', 'thanks', 'thx', 'great', 'awesome', 'perfect')) return say('Anytime! That\'s what I\'m here for. &#10024;', defaultChips());
    if (has(t, 'bye', 'goodbye', 'see you', 'later')) { S.mode = 'idle'; return say('Stay gorgeous &mdash; see you soon at ' + escapeHtml(BIZ.name) + '! &#10024;'); }
    if (/\b(hi+|hello|hey+|hola|yo)\b/.test(t) || has(t, 'good morning', 'good evening')) return say('Hey hey! &#128075; What can I do for you &mdash; <b>cuts</b>, <b>color</b>, or shall I <b>book your appointment</b>?', defaultChips());
    if (has(t, 'no thanks', 'not now', 'nope', "i'm good", 'im good')) { S.mode = 'idle'; return say('No worries at all! I\'m here whenever you need me. &#10024;', defaultChips()); }

    /* graceful fallback — never dead-ends */
    S.lastTopic = text;
    return say('Great question &mdash; let me have the team confirm that for you. &#128172;<br><br>Meanwhile, can I help with an <b>appointment</b>, our <b>services</b>, or <b>pricing</b>?',
      [{ label: '&#128197; Book an appointment' }, { label: '&#9986; Our services' }, { label: '&#128336; Hours & location' }]);
  }

  function userSays(text, silent) {
    if (!text || !text.trim()) return Promise.resolve();
    text = text.trim();
    setChips([]);
    if (!silent) addUser(text);
    return route(text);
  }

  /* ---------- open / close ---------- */
  function openPanel(silent) {
    opened = true;
    panel.classList.add('open');
    bubble.classList.add('hidden');
    unread.classList.add('hidden');
    if (!greeted && !silent) greet();
  }
  function closePanel() {
    opened = false;
    panel.classList.remove('open');
    bubble.classList.remove('hidden');
  }

  function init() {
    panel = $('maya-panel'); msgs = $('maya-msgs'); chipsBox = $('maya-chips');
    input = $('maya-input'); bubble = $('maya-bubble'); unread = $('maya-unread'); closeBtn = $('maya-close');
    personalize();
    deepPersonalize();

    /* bubble click greets normally; hero CTA passes silent=true to skip straight to booking */
    bubble.addEventListener('click', function () { openPanel(); });
    closeBtn.addEventListener('click', closePanel);
    $('maya-send').addEventListener('click', function () { userSays(input.value); input.value = ''; input.focus(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { userSays(input.value); input.value = ''; }
    });

    /* hero CTA opens widget straight into booking */
    document.querySelectorAll('[data-action="book"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        openPanel(true); /* silent: goes straight to booking, no greeting */
        setTimeout(function () { if (S.mode === 'idle') startBooking(); }, FAST ? 50 : 600);
      });
    });

    /* proactive nudge — once, ~8s in */
    setTimeout(function () {
      if (!opened && !autoOpened) {
        autoOpened = true;
        unread.classList.remove('hidden');
        bubble.classList.add('hidden');
        panel.classList.add('open');
        opened = true;
        if (!greeted) greet();
      }
    }, FAST ? 600 : 8000);

    /* test hooks */
    window.__maya = {
      BIZ: BIZ, S: S,
      send: function (t) { openPanel(); return userSays(t); },
      open: openPanel, close: closePanel,
      pickStars: pickStars,
      getLeads: function () { return leads; },
      clearLeads: function () { leads = []; try { localStorage.removeItem(LEAD_KEY); } catch (e) {} }
    };
    window.__getLeads = function () { return leads; };
    window.__clearLeads = function () { leads = []; try { localStorage.removeItem(LEAD_KEY); } catch (e) {} };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
