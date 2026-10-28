// Nonogramas (pintar por números): con las pistas de filas y columnas se descubre qué casillas pintar.

const Nonograma = (() => {
  const N = NonogramaReglas;
  // Dibujos (verificados con el resolvedor: se resuelven sin adivinar). Cada letra es un color.
  const DIBUJOS = [
    ['Corazón', ['.R.R.', 'RRRRR', 'RRRRR', '.RRR.', '..R..']],
    ['Casita', ['..R..', '.RRR.', 'RRRRR', '.MMM.', '.M.M.']],
    ['Estrella', ['..A..', 'AAAAA', '.AAA.', '.A.A.', 'A...A']],
    ['Gato', ['K...K', 'KKKKK', 'K.K.K', 'KKKKK', '.KKK.']],
    ['Arbolito', ['.VVV.', 'VVVVV', 'VVVVV', '..M..', '..M..']],
    ['Mate', ['.......GG.', '......GG..', '.....GG...', '..VVGGVV..', '.MMMMMMMM.', 'MMMMMMMMMM', 'MMMMMMMMMM', 'MMMMMMMMMM', '.MMMMMMMM.', '..MMMMMM..']],
    ['Sol de Mayo', ['....AA....', '.A..AA..A.', '..AAAAAA..', '.AAAAAAAA.', 'AAAAAAAAAA', 'AAAAAAAAAA', '.AAAAAAAA.', '..AAAAAA..', '.A..AA..A.', '....AA....']],
    ['Copa', ['.AAAAAAAA.', 'AAAAAAAAAA', 'A.AAAAAA.A', 'A.AAAAAA.A', '.AAAAAAAA.', '..AAAAAA..', '....AA....', '....AA....', '..VVVVVV..', '..VVVVVV..']],
    ['Hongo', ['...RRRR...', '.RRRRRRRR.', 'RR.RRRR.RR', 'RRRRRRRRRR', 'RRRR..RRRR', '...BBBB...', '...BBBB...', '...BBBB...', '..BBBBBB..', '..........']],
    ['Empanada', ['..........', '..........', '...NNNN...', '..NNNNNN..', '.NNNNNNNN.', 'NNNNNNNNNN', 'NNNNNNNNNN', 'MNMNMNMNMN', '..........', '..........']],
    ['Choripán', ['..........', '..........', '.NNNNNNNN.', 'NRRRRRRRRN', 'RRRRRRRRRR', 'NRRRRRRRRN', '.NNNNNNNN.', '..........', '..........', '..........']],
    ['Pelota', ['..KKKKKK..', '.KK.KK.KK.', 'KK.KKKK.KK', 'K..KKKK..K', 'K...KK...K', 'KK......KK', 'K.KK..KK.K', 'KKKK..KKKK', '.KK....KK.', '..KKKKKK..']],
    ['Pingüino', ['...KKKK...', '..KKKKKK..', '..KBKKBK..', '..KKNNKK..', '.KKBBBBKK.', '.KBBBBBBK.', 'KKBBBBBBKK', '.KBBBBBBK.', '..BBBBBB..', '..NN..NN..']],
  ];
  const COLOR = { R: '#ff4d5e', M: '#8a5a2b', A: '#ffc93c', K: '#2a1640', V: '#3ccf7e', G: '#c9ced6', B: '#fff2dc', N: '#ff8a3d' };
  const ARTICULO = ['un', 'una', 'una', 'un', 'un', 'un', 'el', 'la', 'un', 'una', 'un', 'una', 'un'];
  const AZAR = { 5: 'Fácil', 10: 'Medio', 15: 'Difícil' };

  let st = App.leer('nono:partida', null);
  const guardar = () => App.guardar('nono:partida', st);
  let resueltos = App.leer('nono:resueltos', {});
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const deDibujo = i => {
    const filas = DIBUJOS[i][1];
    return { tipo: 'dibujo', id: i, n: filas.length, sol: filas.flatMap(f => [...f].map(c => (c === '.' ? 0 : 1))), colores: filas.flatMap(f => [...f]) };
  };
  const deAzar = n => ({ tipo: 'azar', id: n, n, sol: N.alAzar(n).flat(), colores: null });

  function miniDibujo(i) {
    const filas = DIBUJOS[i][1], n = filas.length;
    return `<div class="nn-mini" style="--n:${n}">${filas.flatMap(f => [...f]).map(c => `<i style="background:${c === '.' ? 'transparent' : COLOR[c]}"></i>`).join('')}</div>`;
  }

  function inicio() {
    App.despierto(false);
    const hay = st && !st.gano;
    const p = App.pantalla({ titulo: 'Nonogramas', volver: App.menu, clase: 'nn-inicio', html: `
      <div class="ilus-grande">🖍️</div>
      ${hay ? `<button class="btn grande amarillo" id="seguir">▶ Seguir ${st.tipo === 'dibujo' ? 'el dibujo' : `el ${st.n}×${st.n}`}</button>` : ''}
      <h2 class="titulito">🎨 Dibujos</h2>
      <div class="nn-dibujos">${DIBUJOS.map(([nombre, filas], i) => `
        <button class="nn-dibujo ${resueltos['d' + i] ? 'hecho' : ''}" data-d="${i}">
          ${resueltos['d' + i] ? miniDibujo(i) : '<span class="nn-incognita">?</span>'}
          <small>${resueltos['d' + i] ? nombre : filas.length + '×' + filas.length}</small>
        </button>`).join('')}</div>
      <h2 class="titulito">🎲 Al azar (siempre distintos)</h2>
      <div class="niveles tres">${Object.entries(AZAR).map(([n, t], k) => `
        <button class="btn ${['verde', 'celeste', 'naranja'][k]} nivel" data-n="${n}"><b>${n}×${n}</b><small>${t}</small></button>`).join('')}</div>
      <div class="como"><b>Cómo se juega</b>
        <p>Los números de cada fila y columna dicen cuántas casillas seguidas hay que pintar, en orden. Por ejemplo, <b>3 1</b> es un grupo de 3, al menos un espacio, y uno de 1. Pintá con ✏️ y marcá con ✕ las que seguro van vacías. Podés arrastrar el dedo para pintar varias. Todos se resuelven con lógica, sin adivinar.</p></div>` });
    const empezar = async nuevo => {
      if (hay && !(await App.preguntar('¿Empezar otro? Se pierde el que tenías.', 'Sí', 'No'))) return;
      st = { ...nuevo, celdas: new Array(nuevo.n * nuevo.n).fill(0), tiempo: 0, gano: false };
      guardar();
      jugar();
    };
    if (hay) p.querySelector('#seguir').onclick = jugar;
    p.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => empezar(deDibujo(+b.dataset.d)); });
    p.querySelectorAll('[data-n]').forEach(b => { b.onclick = () => empezar(deAzar(+b.dataset.n)); });
  }

  function jugar() {
    App.despierto(true);
    const n = st.n;
    const filas = [], cols = [];
    for (let f = 0; f < n; f++) filas.push(N.grupos(st.sol.slice(f * n, f * n + n)));
    for (let c = 0; c < n; c++) cols.push(N.grupos(Array.from({ length: n }, (_, f) => st.sol[f * n + c])));
    const maxF = Math.max(1, ...filas.map(x => x.length)), maxC = Math.max(1, ...cols.map(x => x.length));
    let herramienta = 'pintar';
    const hist = [];

    const p = App.pantalla({ titulo: st.tipo === 'dibujo' ? `Dibujo ${n}×${n}` : `Al azar ${n}×${n}`, volver: inicio, clase: 'nonograma' + (n > 10 ? ' grande' : ''), html: `
      <div class="sd-info"><span id="estado"></span><span id="reloj">⏱ ${fmt(st.tiempo)}</span></div>
      <div class="nn-tablero" id="tablero"></div>
      <div class="segmentos nn-herr" id="herr"><button data-h="pintar" class="on">✏️ Pintar</button><button data-h="marcar">✕ Marcar</button></div>
      <div class="sd-herramientas">
        <button class="herr" id="deshacer"><span>↩︎</span>Deshacer</button>
        <button class="herr" id="revisar"><span>🔍</span>Revisar</button>
        <button class="herr" id="borrar"><span>🧽</span>Borrar todo</button>
      </div>` });
    const tablero = p.querySelector('#tablero');

    // Tamaño: que entre todo a lo ancho y a lo alto.
    const estilo = getComputedStyle(p);
    const ancho = Math.min(p.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight) - 4, 520);
    const alto = window.innerHeight - 300;
    const PISTA = 0.52; // ancho de cada número de pista, en casillas
    const cs = Math.floor(Math.min(ancho / (n + maxF * PISTA), alto / (n + maxC * PISTA)));
    tablero.style.setProperty('--cs', cs + 'px');
    tablero.style.gridTemplateColumns = `${Math.ceil(maxF * cs * PISTA) + 4}px repeat(${n}, ${cs}px)`;
    tablero.style.gridTemplateRows = `${Math.ceil(maxC * cs * PISTA) + 4}px repeat(${n}, ${cs}px)`;
    tablero.innerHTML = `<div class="nn-esquina"></div>`
      + cols.map((g, c) => `<div class="nn-pc" data-pc="${c}">${(g.length ? g : [0]).map(x => `<span>${x}</span>`).join('')}</div>`).join('')
      + filas.map((g, f) => `<div class="nn-pf" data-pf="${f}">${(g.length ? g : [0]).map(x => `<span>${x}</span>`).join('')}</div>`
        + Array.from({ length: n }, (_, c) => `<div class="nn-c ${c % 5 === 4 && c < n - 1 ? 'bd' : ''} ${f % 5 === 4 && f < n - 1 ? 'bb' : ''}" data-i="${f * n + c}"></div>`).join('')).join('');
    const celdas = [...tablero.querySelectorAll('.nn-c')];

    const iguales = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    function pintar() {
      celdas.forEach((el, i) => { el.className = el.className.replace(/ ?(lleno|cruz)/g, '') + (st.celdas[i] === 1 ? ' lleno' : st.celdas[i] === 2 ? ' cruz' : ''); });
      for (let f = 0; f < n; f++) {
        const ok = iguales(N.grupos(st.celdas.slice(f * n, f * n + n).map(v => (v === 1 ? 1 : 0))), filas[f]);
        tablero.querySelector(`[data-pf="${f}"]`).classList.toggle('ok', ok);
      }
      for (let c = 0; c < n; c++) {
        const ok = iguales(N.grupos(Array.from({ length: n }, (_, f) => (st.celdas[f * n + c] === 1 ? 1 : 0))), cols[c]);
        tablero.querySelector(`[data-pc="${c}"]`).classList.toggle('ok', ok);
      }
      const faltan = st.sol.filter(Boolean).length - st.celdas.filter(v => v === 1).length;
      p.querySelector('#estado').textContent = faltan > 0 ? `Faltan pintar ${faltan}` : faltan < 0 ? `Sobran ${-faltan} pintadas` : 'Revisá: ¿está todo bien?';
      p.querySelector('#deshacer').disabled = !hist.length || st.gano;
    }

    function revisarFin() {
      if (!st.sol.every((v, i) => (v === 1) === (st.celdas[i] === 1))) return;
      st.gano = true;
      clearInterval(intervalo);
      if (st.tipo === 'dibujo') { resueltos['d' + st.id] = true; App.guardar('nono:resueltos', resueltos); }
      guardar();
      // Se revela el dibujo con sus colores, de arriba hacia abajo.
      celdas.forEach((el, i) => {
        el.classList.remove('cruz');
        if (st.sol[i]) setTimeout(() => { el.style.background = st.colores ? COLOR[st.colores[i]] : `hsl(${260 + (i % n) * 6}, 80%, 65%)`; el.classList.add('revela'); }, Math.floor(i / n) * 60);
      });
      tablero.classList.add('ganado');
      Sonido.ganar();
      App.confeti(150);
      const nombre = st.tipo === 'dibujo' ? DIBUJOS[st.id][0] : null;
      setTimeout(() => {
        const d = document.createElement('div');
        d.className = 'modal ver';
        d.innerHTML = `<div class="modal-caja ganador"><span class="emo">🎨</span><h2>${nombre ? `¡Es ${ARTICULO[st.id]} ${nombre.toLowerCase()}!` : '¡Resuelto!'}</h2>
          <p>${n}×${n} en ${fmt(st.tiempo)}</p>
          <div class="fila"><button class="btn gris" data-r="ver">Ver</button><button class="btn verde" data-r="mas">Otro</button></div></div>`;
        document.body.appendChild(d);
        d.addEventListener('click', e => {
          const b = e.target.closest('[data-r]');
          if (!b) return;
          d.remove();
          if (b.dataset.r === 'mas') inicio();
        });
      }, n * 60 + 900);
    }

    // Un gesto (tocar o arrastrar en línea recta) aplica el mismo cambio a todas las casillas que toca.
    let gesto = null;
    function aplicar(i) {
      if (gesto.hechas.has(i)) return;
      const f = Math.floor(i / n), c = i % n;
      if (gesto.eje === null && gesto.hechas.size) gesto.eje = f === gesto.f0 ? 'fila' : c === gesto.c0 ? 'col' : null;
      if (gesto.eje === 'fila' && f !== gesto.f0) return;
      if (gesto.eje === 'col' && c !== gesto.c0) return;
      if (gesto.hechas.size && gesto.eje === null) return;
      gesto.hechas.add(i);
      if (st.celdas[i] === gesto.valor) return;
      // Pintar no pisa las ✕ (y al revés) salvo que se esté borrando.
      if (gesto.valor !== 0 && st.celdas[i] !== 0) return;
      st.celdas[i] = gesto.valor;
      if (gesto.valor === 1) Sonido.toque();
    }
    tablero.addEventListener('pointerdown', e => {
      const el = e.target.closest('.nn-c');
      if (!el || st.gano) return;
      const i = +el.dataset.i, actual = st.celdas[i];
      const objetivo = herramienta === 'pintar' ? 1 : 2;
      hist.push(st.celdas.slice());
      if (hist.length > 200) hist.shift();
      gesto = { valor: actual === objetivo ? 0 : objetivo, hechas: new Set(), eje: null, f0: Math.floor(i / n), c0: i % n, id: e.pointerId };
      try { tablero.setPointerCapture(e.pointerId); } catch (err) {}
      aplicar(i);
      pintar();
    });
    tablero.addEventListener('pointermove', e => {
      if (!gesto || e.pointerId !== gesto.id) return;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.nn-c');
      if (!el) return;
      aplicar(+el.dataset.i);
      pintar();
    });
    const terminar = () => { if (!gesto) return; gesto = null; guardar(); revisarFin(); };
    tablero.addEventListener('pointerup', terminar);
    tablero.addEventListener('pointercancel', terminar);

    p.querySelectorAll('#herr button').forEach(b => {
      b.onclick = () => { herramienta = b.dataset.h; p.querySelectorAll('#herr button').forEach(x => x.classList.toggle('on', x === b)); };
    });
    p.querySelector('#deshacer').onclick = () => { const h = hist.pop(); if (!h) return; st.celdas = h; guardar(); pintar(); };
    p.querySelector('#borrar').onclick = async () => {
      if (st.gano || !(await App.preguntar('¿Borrar todo lo pintado?', 'Borrar', 'No'))) return;
      hist.push(st.celdas.slice());
      st.celdas.fill(0);
      guardar();
      pintar();
    };
    p.querySelector('#revisar').onclick = () => {
      const mal = celdas.filter((el, i) => (st.celdas[i] === 1 && !st.sol[i]) || (st.celdas[i] === 2 && st.sol[i]));
      if (!mal.length) { Sonido.acierto(); p.querySelector('#estado').textContent = '¡Todo bien hasta ahora! 👌'; return; }
      Sonido.error();
      mal.forEach(el => { el.classList.add('mal'); setTimeout(() => el.classList.remove('mal'), 1600); });
      p.querySelector('#estado').textContent = `Hay ${mal.length} ${mal.length === 1 ? 'casilla equivocada' : 'casillas equivocadas'}`;
    };

    const intervalo = setInterval(() => {
      if (document.hidden || st.gano) return;
      st.tiempo++;
      p.querySelector('#reloj').textContent = `⏱ ${fmt(st.tiempo)}`;
      if (st.tiempo % 10 === 0) guardar();
    }, 1000);
    App.alSalir(() => { clearInterval(intervalo); guardar(); App.despierto(false); });
    pintar();
    if (st.gano) { tablero.classList.add('ganado'); celdas.forEach((el, i) => { if (st.sol[i]) el.style.background = st.colores ? COLOR[st.colores[i]] : `hsl(${260 + (i % n) * 6}, 80%, 65%)`; }); }
  }

  return { inicio };
})();
