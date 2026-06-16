/* ==========================================================================
   Animal Health Center & Pet Resort — Sample 3
   widgets.js — ALL shared interactive logic for every page.
   Each widget inits only if its anchor element exists on the page, so this
   one file is safe to load everywhere (guarded inits = no duplication).
   Classic IIFE (not a module) so it works from file:// too.
   ========================================================================== */
(function () {
  "use strict";

  var KENNELBOOKER =
    "https://www.kennelbooker.com/clientlogin.aspx?id=a0013ce4-96fa-44ef-9320-bb3de01b8c44";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = function () { return !!window.gsap; };
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ======================================================================
     1. LIVE OPEN / CLOSED BADGE  (every page)
     Hours — KEEP IN SYNC with the visible "Hours" blocks in the HTML/footer:
       Mon–Fri 8:00am–5:30pm · Sat 8:00am–12:00pm · Sun closed
     Times are minutes-from-midnight. 480 = 8:00, 1050 = 17:30, 720 = 12:00.
     ====================================================================== */
  var HOURS = {
    0: null,          // Sun closed
    1: [480, 1050],   // Mon
    2: [480, 1050],   // Tue
    3: [480, 1050],   // Wed
    4: [480, 1050],   // Thu
    5: [480, 1050],   // Fri
    6: [480, 720]     // Sat
  };
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function fmtTime(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    var ap = h >= 12 ? "pm" : "am";
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + (m ? ":" + (m < 10 ? "0" + m : m) : "") + ap;
  }

  function nextOpenLabel(day, mins) {
    // rest of today?
    var t = HOURS[day];
    if (t && mins < t[0]) return "Opens today " + fmtTime(t[0]);
    // search the next 7 days
    for (var i = 1; i <= 7; i++) {
      var d = (day + i) % 7;
      var slot = HOURS[d];
      if (slot) {
        var when = i === 1 ? "tomorrow" : DAY_NAMES[d];
        return "Opens " + when + " " + fmtTime(slot[0]);
      }
    }
    return "Reopening soon";
  }

  function renderBadge() {
    var badges = $$("[data-hours-badge]");
    if (!badges.length) return;
    var now = new Date();
    var day = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();
    var t = HOURS[day];
    var isOpen = !!t && mins >= t[0] && mins < t[1];
    var text, cls;
    if (isOpen) {
      text = "Open Now";
      cls = "hours-badge is-open";
    } else {
      text = "Closed · " + nextOpenLabel(day, mins);
      cls = "hours-badge is-closed";
    }
    badges.forEach(function (b) {
      b.textContent = text;
      b.className = cls + (b.dataset.hoursBadge === "inline" ? "" : "");
    });
  }

  /* ======================================================================
     2. PET PROFILE BUILDER  (home preview + shop.html)
     Tiles set the active category; [data-pet] items below are filtered.
     Items are scoped to the nearest [data-pet-scope] so the home preview and
     the full shop page don't fight each other.
     ====================================================================== */
  function initProfileBuilder(root) {
    var tiles = $$("[data-pet-tile]", root);
    var scope = root.closest("[data-pet-scope]") || document;
    var items = $$("[data-pet]", scope);
    if (!tiles.length) return;

    function apply(cat) {
      tiles.forEach(function (t) {
        var on = t.getAttribute("data-pet-tile") === cat;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-pressed", on ? "true" : "false");
      });
      var show = items.filter(function (i) {
        return cat === "all" || (" " + i.getAttribute("data-pet") + " ").indexOf(" " + cat + " ") > -1;
      });
      var hide = items.filter(function (i) { return show.indexOf(i) === -1; });

      if (hasGsap() && !reduce) {
        if (hide.length) {
          window.gsap.to(hide, {
            opacity: 0, y: 8, duration: 0.2, stagger: 0.02,
            onComplete: function () { hide.forEach(function (i) { i.hidden = true; }); refreshST(); }
          });
        }
        show.forEach(function (i) { i.hidden = false; });
        window.gsap.fromTo(show, { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.3, stagger: 0.04, delay: 0.08, onComplete: refreshST });
      } else {
        items.forEach(function (i) { i.hidden = show.indexOf(i) === -1; });
        refreshST();
      }

      // reflect category name anywhere that asks for it
      $$("[data-pet-label]", scope).forEach(function (el) { el.textContent = labelFor(cat); });
    }

    function labelFor(cat) {
      return ({ dog: "Dogs", cat: "Cats", horse: "Horses & Equine", farm: "Farm Animals" })[cat] || "All Animals";
    }

    tiles.forEach(function (t) {
      t.setAttribute("role", "button");
      t.setAttribute("tabindex", "0");
      var go = function () { apply(t.getAttribute("data-pet-tile")); };
      t.addEventListener("click", go);
      t.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
      });
    });

    apply(root.getAttribute("data-default") || "dog");
  }

  /* ======================================================================
     3. "IS MY PET READY" CHECKLIST  (resort.html)
     ====================================================================== */
  function initReadyCheck(root) {
    var boxes = $$('input[type="checkbox"][data-required]', root);
    var cta = $("[data-ready-cta]", root);
    var todo = $("[data-ready-todo]", root);
    if (!boxes.length || !cta) return;

    var link = cta.querySelector("a") || cta;
    if (link.tagName === "A") link.setAttribute("href", KENNELBOOKER);

    function update() {
      var missing = boxes.filter(function (b) { return !b.checked; });
      var ready = missing.length === 0;
      cta.hidden = !ready;
      if (todo) {
        todo.hidden = ready;
        if (!ready) {
          var names = missing.map(function (b) { return b.getAttribute("data-label"); });
          todo.textContent = "Still to sort: " + names.join(", ") + ".";
        }
      }
      if (ready && hasGsap() && !reduce) {
        window.gsap.fromTo(cta, { scale: 0.96, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.7)" });
      }
      refreshST();
    }
    boxes.forEach(function (b) { b.addEventListener("change", update); });
    update();
  }

  /* ======================================================================
     4. LOYALTY PUNCH CARD  (home widget + promotions.html) — DEMO MODE
     User types email/phone; card "activates" and shows a partial demo fill.
     Tracks: grooming (5th free) and/or boarding (10th free) per markup.
     ====================================================================== */
  var DEMO_FILL = { grooming: 3, boarding: 6 };

  function initPunchCard(root) {
    var input = $("[data-punch-input]", root);
    var go = $("[data-punch-go]", root);
    if (!go) return;

    function render() {
      $$("[data-track]", root).forEach(function (track) {
        var key = track.getAttribute("data-track");
        var slots = $$("[data-slot]", track);
        var filled = Math.min(DEMO_FILL[key] || 0, slots.length);
        slots.forEach(function (s, i) { s.classList.toggle("is-stamped", i < filled); });
        var reward = $("[data-reward]", track);
        if (reward) reward.classList.toggle("is-earned", filled >= slots.length);
        var count = $("[data-count]", track);
        if (count) count.textContent = filled + " / " + slots.length;
      });
    }

    function activate() {
      if (input && !input.value.trim()) {
        input.focus();
        input.setAttribute("aria-invalid", "true");
        return;
      }
      if (input) input.removeAttribute("aria-invalid");
      root.setAttribute("data-active", "true");
      render();
      if (hasGsap() && !reduce) {
        window.gsap.from($$(".stamp.is-stamped", root),
          { scale: 0, duration: 0.4, stagger: 0.05, ease: "back.out(2)" });
      }
    }

    go.addEventListener("click", activate);
    if (input) input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); activate(); }
    });
  }

  /* ======================================================================
     5. DAYCARE PRICING TOGGLE  (services.html + resort.html)
     Half $12 (<5 hrs)  /  Full $22 (>5 hrs)
     ====================================================================== */
  function initPricingToggle(root) {
    var buttons = $$("[data-plan]", root);
    var priceEl = $("[data-price]", root);
    var subEl = $("[data-price-sub]", root);
    if (!buttons.length || !priceEl) return;

    var DATA = {
      half: { p: "$12", s: "Half day · under 5 hours" },
      full: { p: "$22", s: "Full day · 5 hours or more" }
    };

    function set(plan) {
      buttons.forEach(function (b) {
        var on = b.getAttribute("data-plan") === plan;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      var d = DATA[plan]; if (!d) return;
      if (hasGsap() && !reduce) {
        window.gsap.to(priceEl, {
          opacity: 0, y: -10, duration: 0.15,
          onComplete: function () {
            priceEl.textContent = d.p;
            if (subEl) subEl.textContent = d.s;
            window.gsap.fromTo(priceEl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.2 });
          }
        });
      } else {
        priceEl.textContent = d.p;
        if (subEl) subEl.textContent = d.s;
      }
    }

    buttons.forEach(function (b) {
      b.addEventListener("click", function () { set(b.getAttribute("data-plan")); });
    });
    set("half");
  }

  /* ======================================================================
     6. WEEKLY PROMOTIONS — auto-highlight TODAY  (promotions.html + home)
     ====================================================================== */
  function initWeeklyPromos(root) {
    var today = new Date().getDay();
    var cards = $$("[data-day]", root);
    cards.forEach(function (card) {
      var isToday = parseInt(card.getAttribute("data-day"), 10) === today;
      card.classList.toggle("is-today", isToday);
      var flag = $("[data-day-flag]", card);
      if (flag) flag.hidden = !isToday;
    });
  }

  /* ======================================================================
     7. COUNT-UP STATS  (services.html + about.html)
     <p data-countup data-to="25" data-suffix="+">25+</p> counts 0 -> 25 on view.
     Honors reduced motion / no-IO by snapping straight to the final value.
     ====================================================================== */
  function initCountUps() {
    var els = $$("[data-countup]");
    if (!els.length) return;

    function run(el) {
      var to = parseFloat(el.getAttribute("data-to")) || 0;
      var suffix = el.getAttribute("data-suffix") || "";
      if (reduce || !window.requestAnimationFrame) { el.textContent = to + suffix; return; }
      var start = null, dur = 1200;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        el.textContent = Math.round(eased * to) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) { els.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ======================================================================
     8. CONTACT FORM  (about.html) — DEMO MODE
     Native Constraint Validation, then a simulated success. Sends nothing.
     ====================================================================== */
  function initContactForm(form) {
    var status = $("[data-form-status]", form);
    var btn = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      // clear previous invalid flags
      $$(".form-input", form).forEach(function (i) { i.removeAttribute("aria-invalid"); });

      if (!form.checkValidity()) {
        $$(".form-input", form).forEach(function (i) {
          if (!i.checkValidity()) i.setAttribute("aria-invalid", "true");
        });
        var firstBad = form.querySelector('[aria-invalid="true"]');
        if (firstBad) firstBad.focus();
        if (status) { status.textContent = "Please fill in the highlighted fields."; status.style.color = "#c25b3a"; }
        return;
      }

      if (btn) { btn.disabled = true; btn.style.opacity = ".7"; }
      if (status) { status.textContent = "Sending…"; status.style.color = "var(--ink-soft)"; }

      setTimeout(function () {
        form.reset();
        if (btn) { btn.disabled = false; btn.style.opacity = "1"; }
        if (status) { status.textContent = "Thanks! We'll be in touch soon. 🐾"; status.style.color = "#1f8a4c"; }
      }, 900);
    });
  }

  /* ======================================================================
     SHARED CHROME — active nav, mobile drawer, sticky Book-Now bar
     ====================================================================== */
  function setActiveNav() {
    var page = document.body.getAttribute("data-page");
    if (!page) return;
    $$("[data-nav]").forEach(function (a) {
      var on = a.getAttribute("data-nav") === page;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page");
    });
  }

  function initMobileMenu() {
    var toggle = $("[data-menu-toggle]");
    var drawer = $("[data-menu-drawer]");
    if (!toggle || !drawer) return;
    function close() {
      drawer.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    }
    function open() {
      drawer.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("menu-open");
    }
    toggle.addEventListener("click", function () {
      if (drawer.classList.contains("is-open")) close(); else open();
    });
    $$("a", drawer).forEach(function (a) { a.addEventListener("click", close); });
    var closeBtn = $("[data-menu-close]", drawer);
    if (closeBtn) closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  function initStickyBookBar() {
    var bar = $("[data-booknow-bar]");
    if (!bar) return;
    var trigger = $("[data-booknow-after]") || $("header");
    function onScroll() {
      var past = trigger ? trigger.getBoundingClientRect().bottom < 0 : window.scrollY > 600;
      bar.classList.toggle("is-visible", past);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* set KennelBooker href on any element flagged for it */
  function wireBookingLinks() {
    $$("[data-book]").forEach(function (a) {
      a.setAttribute("href", KENNELBOOKER);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
  }

  /* footer year + dynamic footer hours line (single source of truth) */
  function initFooterBits() {
    $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ScrollTrigger refresh helper (layout changed after a widget interaction) */
  function refreshST() {
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  /* ======================================================================
     BOOTSTRAP
     ====================================================================== */
  function init() {
    renderBadge();
    setInterval(renderBadge, 60000); // keep the badge live

    $$('[data-widget="profile"]').forEach(initProfileBuilder);
    $$('[data-widget="ready"]').forEach(initReadyCheck);
    $$('[data-widget="punch"]').forEach(initPunchCard);
    $$('[data-widget="pricing"]').forEach(initPricingToggle);
    $$('[data-widget="promos"]').forEach(initWeeklyPromos);
    $$('[data-widget="contact"]').forEach(initContactForm);
    initCountUps();

    setActiveNav();
    initMobileMenu();
    initStickyBookBar();
    wireBookingLinks();
    initFooterBits();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
