// Shared site chrome for all 5 course pages: top nav bar, dark/light toggle,
// left-sidebar hide/unhide. Theme is applied earlier by an inline snippet in
// <head> (to avoid a flash of the wrong theme); this file just builds the UI.
(function () {
  if (window.__ccarChromeLoaded) return;
  window.__ccarChromeLoaded = true;

  var PAGES = [
    { href: '/', label: 'Overview' },
    { href: '/01-day1-part1', label: 'Day 1 · Part 1' },
    { href: '/02-day1-part2', label: 'Day 1 · Part 2' },
    { href: '/03-day2-part1', label: 'Day 2 · Part 1' },
    { href: '/04-day2-part2', label: 'Day 2 · Part 2' },
  ];

  function currentPath() {
    var p = location.pathname.replace(/\.html$/, '');
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p === '' ? '/' : p;
  }

  var bar = document.createElement('div');
  bar.className = 'ccar-topbar';

  var hasSidebar = !!document.querySelector('nav.rail');
  var burger = null;
  if (hasSidebar) {
    burger = document.createElement('button');
    burger.className = 'ccar-burger';
    burger.setAttribute('aria-label', 'Toggle sidebar');
    burger.textContent = '☰';
    bar.appendChild(burger);
  }

  var brand = document.createElement('div');
  brand.className = 'ccar-brand';
  brand.textContent = 'CCAR-P × Databricks';
  bar.appendChild(brand);

  var nav = document.createElement('nav');
  var here = currentPath();
  PAGES.forEach(function (p) {
    var a = document.createElement('a');
    a.href = p.href;
    a.textContent = p.label;
    if (p.href === here) a.classList.add('ccar-current');
    nav.appendChild(a);
  });
  bar.appendChild(nav);

  var themeBtn = document.createElement('button');
  themeBtn.className = 'ccar-theme-toggle';
  themeBtn.setAttribute('aria-label', 'Toggle light/dark theme');
  bar.appendChild(themeBtn);

  document.body.insertBefore(bar, document.body.firstChild);

  function syncThemeIcon() {
    var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    themeBtn.textContent = isDark ? '☀️' : '🌙';
  }
  syncThemeIcon();

  themeBtn.addEventListener('click', function () {
    var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    var next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ccar-theme', next); } catch (e) {}
    syncThemeIcon();
  });

  if (burger) {
    var navHidden = false;
    try { navHidden = localStorage.getItem('ccar-nav-hidden') === '1'; } catch (e) {}
    document.body.classList.toggle('ccar-nav-hidden', navHidden);

    burger.addEventListener('click', function () {
      navHidden = !document.body.classList.contains('ccar-nav-hidden');
      document.body.classList.toggle('ccar-nav-hidden', navHidden);
      try { localStorage.setItem('ccar-nav-hidden', navHidden ? '1' : '0'); } catch (e) {}
    });
  }
})();
