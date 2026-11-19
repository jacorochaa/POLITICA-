/* Tema claro/escuro: segue o aparelho até a pessoa escolher no botão. Carregar no <head>. */
(function () {
  var root = document.documentElement;
  try { var salvo = localStorage.getItem('tema'); if (salvo) root.dataset.theme = salvo; } catch (e) { /* sem storage */ }

  function escuro() {
    return root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function pintarBarra() {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', escuro() ? '#131312' : '#f7f7f5');
  }
  document.addEventListener('DOMContentLoaded', pintarBarra);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (!b) return;
    var novo = escuro() ? 'light' : 'dark';
    root.dataset.theme = novo;
    try { localStorage.setItem('tema', novo); } catch (err) { /* sem storage */ }
    pintarBarra();
  });
})();
