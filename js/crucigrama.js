// Crucigrama: cada partida arma una grilla nueva cruzando palabras del banco.

const Crucigrama = (() => {
  const NIVELES = {
    facil: { nombre: 'Fácil', emoji: '🌱', palabras: 8, ayuda: 0.25, clase: 'verde' },
    medio: { nombre: 'Medio', emoji: '🌿', palabras: 11, ayuda: 0.1, clase: 'celeste' },
    dificil: { nombre: 'Difícil', emoji: '🌶️', palabras: 15, ayuda: 0, clase: 'naranja' },
  };
  const ANCHO = 11, ALTO = 13;

  // Mayúsculas sin tildes ni espacios (la Ñ se queda).
  const normal = s => s.toUpperCase().replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'Ñ').replace(/[^A-ZÑ]/g, '');

  const BANCO = (() => {
    const visto = new Set();
    return CRUCI.map(l => {
      const i = l.indexOf(':');
      return { palabra: normal(l.slice(0, i)), pista: l.slice(i + 1).trim() };
    }).filter(e => e.palabra.length >= 3 && e.palabra.length <= 10 && !visto.has(e.palabra) && visto.add(e.palabra));
  })();

  // Un intento de armado: ubica palabras cruzándolas con las que ya están.
  function intentar(objetivo) {
    const letras = new Map(), dirs = new Map();
    const k = (r, c) => r + ',' + c;
    const palabras = [];
    let minR = 0, maxR = 0, minC = 0, maxC = 0;

    function cruces(w, r, c, dir) {
      const dr = dir ? 1 : 0, dc = dir ? 0 : 1;
      if (letras.get(k(r - dr, c - dc)) || letras.get(k(r + dr * w.length, c + dc * w.length))) return -1;
      const r2 = r + dr * (w.length - 1), c2 = c + dc * (w.length - 1);
      if (Math.max(maxR, r2) - Math.min(minR, r) + 1 > ALTO || Math.max(maxC, c2) - Math.min(minC, c) + 1 > ANCHO) return -1;
      let n = 0;
      for (let i = 0; i < w.length; i++) {
        const rr = r + dr * i, cc = c + dc * i, x = letras.get(k(rr, cc));
        if (x) {
          if (x !== w[i] || (dirs.get(k(rr, cc)) & (1 << dir))) return -1;
          n++;
        } else if (letras.get(k(rr + dc, cc + dr)) || letras.get(k(rr - dc, cc - dr))) return -1;
      }
      return n;
    }

    function poner(e, r, c, dir) {
      const dr = dir ? 1 : 0, dc = dir ? 0 : 1;
      for (let i = 0; i < e.palabra.length; i++) {
        const kk = k(r + dr * i, c + dc * i);
        letras.set(kk, e.palabra[i]);
        dirs.set(kk, (dirs.get(kk) || 0) | (1 << dir));
      }
      minR = Math.min(minR, r); minC = Math.min(minC, c);
      maxR = Math.max(maxR, r + dr * (e.palabra.length - 1)); maxC = Math.max(maxC, c + dc * (e.palabra.length - 1));
      palabras.push({ ...e, r, c, dir });
    }

    const lista = App.mezclar(BANCO.slice());
    const primera = lista.findIndex(e => e.palabra.length >= 5 && e.palabra.length <= 8);
    poner(lista.splice(primera, 1)[0], 0, 0, 0);

    for (let vuelta = 0; vuelta < 2 && palabras.length < objetivo; vuelta++) {
      for (let j = 0; j < lista.length && palabras.length < objetivo; j++) {
        const e = lista[j];
        if (!e) continue;
        let mejor = null;
        for (const [kk, x] of letras) {
          const [r0, c0] = kk.split(',').map(Number);
          const dir = dirs.get(kk) & 1 ? 1 : 0; // perpendicular a la que ya está
          if (dirs.get(kk) === 3) continue;
          for (let i = 0; i < e.palabra.length; i++) {
            if (e.palabra[i] !== x) continue;
            const r = dir ? r0 - i : r0, c = dir ? c0 : c0 - i;
            const n = cruces(e.palabra, r, c, dir);
            if (n < 1) continue;
            const puntaje = n * 10 + Math.random() * 5;
            if (!mejor || puntaje > mejor.puntaje) mejor = { r, c, dir, puntaje };
          }
        }
        if (mejor) { poner(e, mejor.r, mejor.c, mejor.dir); lista[j] = null; }
      }
    }
    return { palabras, minR, minC, alto: maxR - minR + 1, ancho: maxC - minC + 1 };
  }

  function generar(nivel) {
    const objetivo = NIVELES[nivel].palabras;
    let mejor = null;
    for (let t = 0; t < 40; t++) {
      const x = intentar(objetivo);
      const puntaje = x.palabras.length * 100 - x.ancho * x.alto * 0.3;
      if (!mejor || puntaje > mejor.puntaje) mejor = { ...x, puntaje };
      if (x.palabras.length >= objetivo && t > 8) break;
    }
    const { palabras, minR, minC, alto, ancho } = mejor;
    const sol = new Array(alto * ancho).fill(null);
    palabras.forEach(p => {
      p.r -= minR; p.c -= minC;
      for (let i = 0; i < p.palabra.length; i++) sol[(p.r + (p.dir ? i : 0)) * ancho + p.c + (p.dir ? 0 : i)] = p.palabra[i];
    });
    // Numeración por orden de lectura; dos palabras que arrancan en la misma casilla comparten número.
    const inicios = [...new Set(palabras.map(p => p.r * ancho + p.c))].sort((a, b) => a - b);
    palabras.forEach(p => { p.num = inicios.indexOf(p.r * ancho + p.c) + 1; });
    palabras.sort((a, b) => a.dir - b.dir || a.num - b.num);
    return { ancho, alto, sol, palabras: palabras.map(({ palabra, pista, r, c, dir, num }) => ({ palabra, pista, r, c, dir, num })) };
  }

  let st = App.leer('cruci:partida', null);
  const guardar = () => App.guardar('cruci:partida', st);
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function inicio() {
    App.despierto(false);
    const hayPartida = st && !st.completo;
    const p = App.pantalla({ titulo: 'Crucigrama', volver: App.menu, clase: 'cruci-inicio', html: `
      <div class="ilus-grande">✏️</div>
      ${hayPartida ? `<button class="btn grande amarillo" id="seguir">▶ Seguir crucigrama <small>(${NIVELES[st.nivel].nombre})</small></button>` : ''}
      <p class="bajada">${hayPartida ? 'O empezá uno nuevo' : 'Elegí la dificultad'}</p>
      <div class="niveles tres">
        ${Object.entries(NIVELES).map(([k, n]) => `
          <button class="btn ${n.clase} nivel" data-k="${k}">
            <span class="emo">${n.emoji}</span><b>${n.nombre}</b><small>${n.palabras} palabras</small>
          </button>`).join('')}
      </div>
      <div class="como">
        <b>Cómo se juega</b>
        <p>Tocá una casilla para ver su pista y escribí con el teclado de abajo. Tocá dos veces la misma casilla para cambiar entre horizontal y vertical. Cada crucigrama se arma al azar: nunca sale el mismo.</p>
      </div>` });
    if (hayPartida) p.querySelector('#seguir').onclick = jugar;
    p.querySelectorAll('.nivel').forEach(b => {
      b.onclick = async () => {
        if (hayPartida && !(await App.preguntar('¿Empezar uno nuevo? Se pierde el que tenías.', 'Sí, nuevo', 'No'))) return;
        nueva(b.dataset.k);
      };
    });
  }

  function nueva(nivel) {
    const d = generar(nivel);
    const entrada = d.sol.map(() => '');
    const fijas = d.sol.map(() => false);
    // Ayuda: algunas letras ya vienen puestas.
    const llenas = d.sol.map((x, i) => x ? i : -1).filter(i => i >= 0);
    App.mezclar(llenas).slice(0, Math.round(llenas.length * NIVELES[nivel].ayuda)).forEach(i => { entrada[i] = d.sol[i]; fijas[i] = true; });
    st = { nivel, ...d, entrada, fijas, revisadas: [], pistas: 0, tiempo: 0, completo: false };
    guardar();
    jugar();
  }

  function jugar() {
    App.despierto(true);
    const { ancho, alto, sol, palabras } = st;
    let pal = palabras[0];
    let sel = pal.r * ancho + pal.c;
    let malas = new Set();

    const celdasDe = w => Array.from({ length: w.palabra.length }, (_, i) => (w.r + (w.dir ? i : 0)) * ancho + w.c + (w.dir ? 0 : i));
    const palabraEn = (i, dir) => palabras.find(w => w.dir === dir && celdasDe(w).includes(i));
    const numeros = {};
    palabras.forEach(w => { numeros[w.r * ancho + w.c] = w.num; });

    const p = App.pantalla({ titulo: 'Crucigrama', volver: inicio, clase: 'cruci', html: `
      <div class="cr-tablero" id="tablero" style="--cols:${ancho};--rows:${alto}">
        ${sol.map((x, i) => x
          ? `<button class="cr-celda" data-i="${i}" data-sin>${numeros[i] ? `<small>${numeros[i]}</small>` : ''}<span></span></button>`
          : '<div class="cr-vacia"></div>').join('')}
      </div>
      <div class="cr-pista">
        <button class="cr-flecha" id="ant" data-sin aria-label="Pista anterior">‹</button>
        <div id="pista"></div>
        <button class="cr-flecha" id="sig" data-sin aria-label="Pista siguiente">›</button>
      </div>
      <div class="cr-herramientas">
        <button class="herr" id="lista"><span>📋</span>Pistas</button>
        <button class="herr" id="revisar"><span>🔍</span>Revisar</button>
        <button class="herr" id="letra"><span>💡</span>Letra</button>
        <button class="herr" id="palabra"><span>🪄</span>Palabra</button>
      </div>
      <div class="teclado" id="teclado">
        ${['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM⌫'].map(f => `<div class="fila-t">${[...f].map(l => `<button data-l="${l}" data-sin class="${l === '⌫' ? 'borrar' : ''}">${l}</button>`).join('')}</div>`).join('')}
      </div>` });
    const celdas = {};
    p.querySelectorAll('.cr-celda').forEach(el => { celdas[+el.dataset.i] = el; });

    const correcta = w => celdasDe(w).every(i => st.entrada[i] === sol[i]);

    function pintar() {
      const actuales = new Set(celdasDe(pal));
      const bien = new Set();
      palabras.forEach(w => { if (correcta(w)) celdasDe(w).forEach(i => bien.add(i)); });
      for (const i in celdas) {
        const el = celdas[i], n = +i;
        el.querySelector('span').textContent = st.entrada[n];
        el.className = 'cr-celda'
          + (actuales.has(n) ? ' palabra' : '')
          + (n === sel ? ' sel' : '')
          + (bien.has(n) ? ' bien' : '')
          + (malas.has(n) && st.entrada[n] && st.entrada[n] !== sol[n] ? ' mala' : '')
          + (st.fijas[n] ? ' fija' : '');
      }
      p.querySelector('#pista').innerHTML = `<b>${pal.num} ${pal.dir ? '↓' : '→'}</b> ${App.esc(pal.pista)} <small>(${pal.palabra.length})</small>`;
    }

    function elegir(i, dir) {
      const w = palabraEn(i, dir) || palabraEn(i, 1 - dir);
      if (!w) return;
      pal = w;
      sel = i;
      pintar();
    }

    function irA(w) {
      pal = w;
      const cs = celdasDe(w);
      sel = cs.find(i => !st.entrada[i]) ?? cs[0];
      pintar();
    }

    function avanzar(paso) {
      const cs = celdasDe(pal);
      let j = cs.indexOf(sel) + paso;
      while (j >= 0 && j < cs.length && st.fijas[cs[j]]) j += paso;
      if (j >= 0 && j < cs.length) sel = cs[j];
    }

    function escribir(l) {
      if (st.completo) return;
      if (l === '⌫') {
        if (st.entrada[sel] && !st.fijas[sel]) st.entrada[sel] = '';
        else { avanzar(-1); if (!st.fijas[sel]) st.entrada[sel] = ''; }
        Sonido.restar();
      } else {
        if (!st.fijas[sel]) st.entrada[sel] = l;
        malas.delete(sel);
        const ya = correcta(pal);
        if (ya) Sonido.acierto(); else Sonido.toque();
        // Si terminó la palabra, pasa a la siguiente que falte.
        if (ya) {
          const sig = palabras.slice(palabras.indexOf(pal) + 1).concat(palabras).find(w => !correcta(w));
          if (sig) { guardar(); revisarFin(); return irA(sig); }
        } else avanzar(1);
      }
      guardar();
      pintar();
      revisarFin();
    }

    function revisarFin() {
      if (!palabras.every(correcta) || st.completo) return;
      st.completo = true;
      guardar();
      clearInterval(intervalo);
      pintar();
      Sonido.ganar();
      App.confeti(150);
      setTimeout(() => {
        const d = document.createElement('div');
        d.className = 'modal ver';
        d.innerHTML = `<div class="modal-caja ganador">
          <span class="emo">🏆</span>
          <h2>¡Completo!</h2>
          <p>${NIVELES[st.nivel].nombre} en ${fmt(st.tiempo)}</p>
          <p style="font-size:1rem;opacity:.8">Ayudas usadas: ${st.pistas}</p>
          <div class="fila"><button class="btn gris" data-r="menu">Menú</button><button class="btn verde" data-r="otro">Otro</button></div>
        </div>`;
        document.body.appendChild(d);
        d.addEventListener('click', e => {
          const b = e.target.closest('[data-r]');
          if (!b) return;
          d.remove();
          b.dataset.r === 'otro' ? nueva(st.nivel) : inicio();
        });
      }, 900);
    }

    p.querySelector('#tablero').onclick = e => {
      const el = e.target.closest('.cr-celda');
      if (!el) return;
      const i = +el.dataset.i;
      Sonido.toque();
      if (i === sel) elegir(i, 1 - pal.dir);
      else elegir(i, pal.dir);
    };
    p.querySelector('#teclado').onclick = e => {
      const b = e.target.closest('[data-l]');
      if (b) escribir(b.dataset.l);
    };
    p.querySelector('#ant').onclick = () => { Sonido.toque(); irA(palabras[(palabras.indexOf(pal) - 1 + palabras.length) % palabras.length]); };
    p.querySelector('#sig').onclick = () => { Sonido.toque(); irA(palabras[(palabras.indexOf(pal) + 1) % palabras.length]); };
    p.querySelector('#revisar').onclick = () => {
      malas = new Set(Object.keys(celdas).map(Number).filter(i => st.entrada[i] && st.entrada[i] !== sol[i]));
      malas.size ? Sonido.error() : Sonido.acierto();
      pintar();
    };
    p.querySelector('#letra').onclick = () => {
      if (st.completo) return;
      const i = st.entrada[sel] !== sol[sel] ? sel : celdasDe(pal).find(j => st.entrada[j] !== sol[j]);
      if (i == null) return;
      st.entrada[i] = sol[i];
      st.fijas[i] = true;
      st.pistas++;
      Sonido.revelar();
      guardar();
      pintar();
      revisarFin();
    };
    p.querySelector('#palabra').onclick = () => {
      if (st.completo || correcta(pal)) return;
      celdasDe(pal).forEach(i => { st.entrada[i] = sol[i]; st.fijas[i] = true; });
      st.pistas++;
      Sonido.revelar();
      guardar();
      pintar();
      revisarFin();
    };
    p.querySelector('#lista').onclick = () => {
      const d = document.createElement('div');
      d.className = 'modal ver';
      const grupo = dir => palabras.filter(w => w.dir === dir).map(w => `
        <button class="cr-item ${correcta(w) ? 'hecha' : ''}" data-w="${palabras.indexOf(w)}"><b>${w.num}</b><span>${App.esc(w.pista)}</span></button>`).join('');
      d.innerHTML = `<div class="modal-caja cr-lista">
        <h2>Horizontales →</h2>${grupo(0)}
        <h2>Verticales ↓</h2>${grupo(1)}
        <button class="btn gris" data-cerrar>Cerrar</button>
      </div>`;
      document.body.appendChild(d);
      d.addEventListener('click', e => {
        const w = e.target.closest('[data-w]');
        if (w) { d.remove(); irA(palabras[+w.dataset.w]); }
        else if (e.target.closest('[data-cerrar]') || e.target === d) d.remove();
      });
    };

    const tecla = e => {
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === 'Backspace') escribir('⌫');
      else if (/^[a-zñ]$/i.test(e.key)) escribir(e.key.toUpperCase());
    };
    document.addEventListener('keydown', tecla);

    const intervalo = setInterval(() => {
      if (document.hidden || st.completo) return;
      st.tiempo++;
      if (st.tiempo % 5 === 0) guardar();
    }, 1000);

    App.alSalir(() => {
      clearInterval(intervalo);
      document.removeEventListener('keydown', tecla);
      guardar();
      App.despierto(false);
    });
    irA(palabras.find(w => !correcta(w)) || palabras[0]);
  }

  return { inicio, generar };
})();
