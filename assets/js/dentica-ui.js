/* Dentica Dental Clinic — theme (dark/light) + language (EN/AR) controller */
(function () {
  var THEME_KEY = 'dentica-theme', LANG_KEY = 'dentica-lang';
  var root = document.documentElement;
  var originals = new Map();      // element -> original English text
  var origPlaceholders = new Map();

  /* ---------- theme ---------- */
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; } }
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    var b = document.querySelector('.dc-theme');
    if (b) {
      b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      b.innerHTML = t === 'dark' ? SUN : MOON;
    }
  }
  var MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/></svg>';

  /* ---------- language ---------- */
  function norm(s) { return (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }

  /* headings Webflow splits into per-letter spans: Arabic must stay one string,
     otherwise the letters stop joining. Keep a snapshot of the full text. */
  var splitHeads = [];
  function snapshotSplitHeads() {
    document.querySelectorAll('[hero-text-split],.hero-text-split,[class*="text-split"]').forEach(function (el) {
      if (el.__denText) return;
      el.__denText = norm(el.textContent);
      splitHeads.push(el);
    });
  }

  function textNodes() {
    var out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        var t = p.tagName;
        if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        if (p.closest('.dentica-controls')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n; while ((n = w.nextNode())) out.push(n);
    return out;
  }

  function toArabic() {
    var dict = window.DENTICA_AR || {};
    /* 1. split headings first — replace the whole element with one Arabic string */
    splitHeads.forEach(function (el) {
      var ar = dict[el.__denText];
      if (!ar) return;
      if (!originals.has(el)) originals.set(el, el.innerHTML);
      el.textContent = ar;
      el.setAttribute('data-den-i18n', '');
    });
    /* 2. every remaining text node whose exact text has a translation */
    textNodes().forEach(function (n) {
      if (n.parentElement && n.parentElement.hasAttribute('data-den-i18n') && originals.has(n.parentElement)) return;
      var en = originals.has(n) ? originals.get(n) : norm(n.nodeValue);
      var ar = dict[en];
      if (!ar) return;
      if (!originals.has(n)) originals.set(n, n.nodeValue);
      n.nodeValue = ar;
      if (n.parentElement) n.parentElement.setAttribute('data-den-i18n', '');
    });
    document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(function (inp) {
      var en = origPlaceholders.has(inp) ? origPlaceholders.get(inp) : inp.placeholder;
      if (!origPlaceholders.has(inp)) origPlaceholders.set(inp, en);
      if (dict[norm(en)]) inp.placeholder = dict[norm(en)];
    });
  }

  function toEnglish() {
    originals.forEach(function (val, node) {
      if (node.nodeType === 3) node.nodeValue = val;
      else { node.innerHTML = val; node.removeAttribute('data-den-i18n'); }
    });
    document.querySelectorAll('[data-den-i18n]').forEach(function (el) { el.removeAttribute('data-den-i18n'); });
    origPlaceholders.forEach(function (en, inp) { inp.placeholder = en; });
  }

  function setLang(l) {
    try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
    if (l === 'ar') {
      root.setAttribute('data-lang', 'ar'); root.setAttribute('lang', 'ar'); root.setAttribute('dir', 'rtl');
      toArabic();
    } else {
      root.setAttribute('data-lang', 'en'); root.setAttribute('lang', 'en'); root.setAttribute('dir', 'ltr');
      toEnglish();
    }
    document.querySelectorAll('.dc-lang button').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-lang') === l);
    });
    if (window.ScrollTrigger) { try { ScrollTrigger.refresh(); } catch (e) {} }
    document.dispatchEvent(new CustomEvent('dentica:lang', { detail: { lang: l } }));
  }

  /* ---------- controls ---------- */
  function buildControls() {
    var wrap = document.createElement('div');
    wrap.className = 'dentica-controls';
    wrap.innerHTML =
      '<button type="button" class="dc-btn dc-theme" aria-label="Toggle dark mode"></button>' +
      '<div class="dc-lang">' +
        '<button type="button" data-lang="en">EN</button>' +
        '<button type="button" data-lang="ar" class="dc-ar">عربي</button>' +
      '</div>';

    var host = document.querySelector('.navbar-button_wrapper') || document.querySelector('.legal-nav');
    if (host && host.classList.contains('navbar-button_wrapper')) host.insertBefore(wrap, host.firstChild);
    else if (host) host.appendChild(wrap);
    else document.body.appendChild(wrap), wrap.classList.add('is-floating');

    wrap.querySelector('.dc-theme').addEventListener('click', function () {
      setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
    wrap.querySelectorAll('.dc-lang button').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
    });
  }

  function init() {
    snapshotSplitHeads();
    buildControls();
    var q = new URLSearchParams(location.search);      /* ?theme=dark&lang=ar for testing/sharing */
    setTheme(q.get('theme') === 'dark' || q.get('theme') === 'light' ? q.get('theme') : getTheme());
    var l = 'en';
    try { l = localStorage.getItem(LANG_KEY) || 'en'; } catch (e) {}
    if (q.get('lang') === 'ar' || q.get('lang') === 'en') l = q.get('lang');
    setLang(l);
    /* Webflow's interactions split headings a beat after load — re-apply so the
       Arabic text wins and the letters keep joining. */
    [400, 1200, 2800].forEach(function (ms) {
      setTimeout(function () { if (root.getAttribute('data-lang') === 'ar') toArabic(); }, ms);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
