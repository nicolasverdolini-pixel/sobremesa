// Sobremesa: el menú principal y las herramientas que comparten todos los juegos.

const App = (() => {
  const raiz = document.getElementById('app');
  let limpiar = null;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const leer = (k, def = null) => {
    try { const v = localStorage.getItem('sobremesa:' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; }
  };
  const guardar = (k, v) => { try { localStorage.setItem('sobremesa:' + k, JSON.stringify(v)); } catch (e) {} };

  function mezclar(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Saca una palabra de un mazo mezclado que se guarda: no se repite hasta que salgan todas.
  function sacar(clave, lista) {
    let m = leer('mazo:' + clave);
    if (!Array.isArray(m) || !m.length || m.some(i => i >= lista.length)) m = mezclar([...lista.keys()]);
    const i = m.pop();
    guardar('mazo:' + clave, m);
    return lista[i];
  }

  const vibrar = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  // Que la pantalla no se apague mientras se juega.
  let lock = null, quiereDespierto = false;
  async function despierto(on) {
    quiereDespierto = on;
    try {
      if (on && !lock && 'wakeLock' in navigator) {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } else if (!on && lock) { await lock.release(); lock = null; }
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && quiereDespierto) despierto(true);
  });

  const iconoSonido = () => Sonido.mudo ? '🔇' : '🔊';

  // Arma una pantalla nueva. Si tiene `volver`, muestra la barra de arriba con la flecha.
  function pantalla({ html, clase = '', titulo = '', volver = null, confirmar = null, estilo = '' }) {
    if (limpiar) { const f = limpiar; limpiar = null; try { f(); } catch (e) {} }
    const barra = volver ? `
      <header class="barra">
        <button class="btn-redondo" data-volver aria-label="Volver">‹</button>
        <h1>${esc(titulo)}</h1>
        <button class="btn-redondo" data-sonido aria-label="Sonido">${iconoSonido()}</button>
      </header>` : '';
    raiz.innerHTML = `<section class="pantalla ${clase}" style="${estilo}">${barra}${html}</section>`;
    window.scrollTo(0, 0);
    const p = raiz.firstElementChild;
    const bv = p.querySelector('[data-volver]');
    if (bv) bv.onclick = async () => {
      if (confirmar && !(await preguntar(confirmar, 'Sí, salir', 'Seguir'))) return;
      volver();
    };
    const bs = p.querySelector('[data-sonido]');
    if (bs) bs.onclick = () => { Sonido.alternar(); bs.textContent = iconoSonido(); };
    return p;
  }
  const alSalir = fn => { limpiar = fn; };

  // Cartelito con dos botones; devuelve true si eligen la primera opción.
  function preguntar(texto, si = 'Sí', no = 'No') {
    return new Promise(res => {
      const d = document.createElement('div');
      d.className = 'modal';
      d.innerHTML = `<div class="modal-caja"><p>${esc(texto)}</p>
        <div class="fila"><button class="btn gris" data-r="0">${esc(no)}</button><button class="btn rosa" data-r="1">${esc(si)}</button></div></div>`;
      document.body.appendChild(d);
      requestAnimationFrame(() => d.classList.add('ver'));
      d.addEventListener('click', e => {
        const b = e.target.closest('[data-r]');
        if (!b) return;
        d.remove();
        res(b.dataset.r === '1');
      });
    });
  }

  function confeti(n = 110) {
    const c = document.createElement('div');
    c.className = 'confeti';
    const colores = ['#ffc93c', '#ff5d8f', '#3ccf7e', '#3cc4ff', '#8f6bff', '#ff8a3d', '#fff'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.style.left = Math.random() * 100 + '%';
      s.style.background = colores[i % colores.length];
      s.style.animationDelay = Math.random() * 0.8 + 's';
      s.style.animationDuration = 2.2 + Math.random() * 1.8 + 's';
      s.style.setProperty('--giro', (Math.random() * 1440 - 720) + 'deg');
      s.style.setProperty('--x', (Math.random() * 120 - 60) + 'px');
      if (i % 3 === 0) s.style.borderRadius = '50%';
      c.appendChild(s);
    }
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }

  const JUEGOS = [
    { id: 'quiensoy', nombre: '¿Quién soy?', bajada: 'Adiviná con el celu en la frente', emoji: '🤔', color: 'amarillo', ir: () => QuienSoy.inicio() },
    { id: 'impostor', nombre: 'El Impostor', bajada: 'Uno no sabe la palabra. ¿Quién es?', emoji: '🕵️', color: 'rosa', ir: () => Impostor.inicio() },
    { id: 'truco', nombre: 'Anotador de Truco', bajada: 'Nosotros y Ellos, con fósforos', emoji: '🃏', color: 'verde', ir: () => Truco.inicio() },
  ];
  const PROXIMOS = ['Tabú', 'Mímica', 'La Bomba', 'Lobo', '¿Qué preferís?', 'Yo nunca nunca', 'Tutti frutti', 'Trivia', 'Chinchón', 'Generala', 'Sorteo de equipos'];

  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function menu() {
    despierto(false);
    const p = pantalla({ clase: 'hub', html: `
      <header class="hub-cab">
        <button class="btn-redondo sonido-hub" data-sonido-hub aria-label="Sonido">${iconoSonido()}</button>
        <div class="logo" aria-hidden="true"><span>🎲</span></div>
        <h1>Sobremesa</h1>
        <p>Juegos para la juntada</p>
      </header>
      <div class="juegos">
        ${JUEGOS.map((j, i) => `
          <button class="tarjeta-juego ${j.color}" data-juego="${j.id}" style="animation-delay:${i * 70}ms">
            <span class="emo">${j.emoji}</span>
            <span class="txt"><b>${j.nombre}</b><small>${j.bajada}</small></span>
            <span class="flecha">›</span>
          </button>`).join('')}
      </div>
      <h2 class="titulito">Próximamente</h2>
      <div class="proximos">${PROXIMOS.map(n => `<span>${n}</span>`).join('')}</div>
      ${esIOS && !instalada() ? `<div class="instalar">📲 <b>Instalala en tu iPhone:</b> tocá <b>Compartir</b> <span class="ico-compartir">⬆︎</span> y después <b>Agregar a inicio</b>. Así se abre a pantalla completa.</div>` : ''}
    ` });
    p.querySelectorAll('[data-juego]').forEach(b => {
      b.onclick = () => { Sonido.desbloquear(); JUEGOS.find(j => j.id === b.dataset.juego).ir(); };
    });
    const bs = p.querySelector('[data-sonido-hub]');
    bs.onclick = () => { Sonido.alternar(); bs.textContent = iconoSonido(); };
  }

  // Un toquecito de sonido en cada botón (salvo los que tienen su propio sonido).
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && !b.hasAttribute('data-sin')) Sonido.toque();
  }, true);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  return { esc, leer, guardar, mezclar, sacar, vibrar, despierto, pantalla, alSalir, preguntar, confeti, menu };
})();
