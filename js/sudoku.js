// Sudoku: cada partida se genera en el momento, con solución única.

const Sudoku = (() => {
  const NIVELES = {
    facil: { nombre: 'Fácil', emoji: '🌱', pistas: 40, clase: 'verde' },
    medio: { nombre: 'Medio', emoji: '🌿', pistas: 33, clase: 'celeste' },
    dificil: { nombre: 'Difícil', emoji: '🌶️', pistas: 28, clase: 'naranja' },
    experto: { nombre: 'Experto', emoji: '🔥', pistas: 24, clase: 'rojo' },
  };
  const TODOS = 0x3fe; // bits 1 a 9
  const caja = i => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
  const bits = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };

  // Backtracking que elige siempre la casilla con menos opciones.
  // Con `azar` llena el tablero; si no, cuenta soluciones hasta `limite`.
  function resolver(g, { limite = 1, azar = false } = {}) {
    const f = new Array(9).fill(0), c = new Array(9).fill(0), b = new Array(9).fill(0);
    for (let i = 0; i < 81; i++) {
      const v = g[i];
      if (!v) continue;
      const m = 1 << v, r = Math.floor(i / 9), k = i % 9, x = caja(i);
      if ((f[r] | c[k] | b[x]) & m) return 0;
      f[r] |= m; c[k] |= m; b[x] |= m;
    }
    let n = 0;
    (function rec() {
      let mejor = -1, mejorM = 0, cuenta = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const m = ~(f[Math.floor(i / 9)] | c[i % 9] | b[caja(i)]) & TODOS;
        const q = bits(m);
        if (q < cuenta) { cuenta = q; mejor = i; mejorM = m; if (q <= 1) break; }
      }
      if (mejor === -1) { n++; return; }
      if (!cuenta) return;
      const digitos = [];
      for (let d = 1; d <= 9; d++) if (mejorM & (1 << d)) digitos.push(d);
      if (azar) App.mezclar(digitos);
      const r = Math.floor(mejor / 9), k = mejor % 9, x = caja(mejor);
      for (const d of digitos) {
        const m = 1 << d;
        g[mejor] = d; f[r] |= m; c[k] |= m; b[x] |= m;
        rec();
        if (n >= limite) return;
        g[mejor] = 0; f[r] &= ~m; c[k] &= ~m; b[x] &= ~m;
      }
    })();
    return n;
  }

  function generar(nivel) {
    const sol = new Array(81).fill(0);
    resolver(sol, { azar: true });
    const puzzle = sol.slice();
    let quedan = 81;
    for (const i of App.mezclar([...Array(81).keys()])) {
      if (quedan <= NIVELES[nivel].pistas) break;
      const v = puzzle[i];
      puzzle[i] = 0;
      if (resolver(puzzle.slice(), { limite: 2 }) !== 1) puzzle[i] = v;
      else quedan--;
    }
    return { puzzle, sol };
  }

  let st = App.leer('sudoku:partida', null);
  const guardar = () => App.guardar('sudoku:partida', st);
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function inicio() {
    App.despierto(false);
    const records = App.leer('sudoku:records', {});
    const hayPartida = st && !st.completo;
    const p = App.pantalla({ titulo: 'Sudoku', volver: App.menu, clase: 'sudoku-inicio', html: `
      <div class="ilus-grande">🔢</div>
      ${hayPartida ? `<button class="btn grande amarillo" id="seguir">▶ Seguir partida <small>(${NIVELES[st.nivel].nombre} · ${fmt(st.tiempo)})</small></button>` : ''}
      <p class="bajada">${hayPartida ? 'O empezá una nueva' : 'Elegí la dificultad'}</p>
      <div class="niveles">
        ${Object.entries(NIVELES).map(([k, n]) => `
          <button class="btn ${n.clase} nivel" data-k="${k}">
            <span class="emo">${n.emoji}</span><b>${n.nombre}</b>
            <small>${records[k] ? `Récord ${fmt(records[k])}` : '&nbsp;'}</small>
          </button>`).join('')}
      </div>
      <div class="como">
        <b>Cómo se juega</b>
        <p>Completá el tablero para que cada fila, cada columna y cada cuadrado de 3×3 tenga los números del 1 al 9 sin repetir. Con <b>Notas</b> anotás los números posibles en chiquito.</p>
      </div>` });
    if (hayPartida) p.querySelector('#seguir').onclick = jugar;
    p.querySelectorAll('.nivel').forEach(b => {
      b.onclick = async () => {
        if (hayPartida && !(await App.preguntar('¿Empezar una nueva? Se pierde la partida que tenías.', 'Sí, nueva', 'No'))) return;
        nueva(b.dataset.k);
      };
    });
  }

  function nueva(nivel) {
    App.pantalla({ clase: 'cargando', html: '<div class="ilus-grande">🎲</div><p class="bajada">Armando el tablero…</p>' });
    setTimeout(() => {
      const { puzzle, sol } = generar(nivel);
      st = { nivel, puzzle, sol, valores: puzzle.slice(), notas: new Array(81).fill(0), errores: 0, tiempo: 0, completo: false, pistas: 0 };
      guardar();
      jugar();
    }, 50);
  }

  function jugar() {
    App.despierto(true);
    let sel = st.valores.findIndex(v => !v);
    let notas = false;
    const hist = [];

    const p = App.pantalla({ titulo: 'Sudoku', volver: inicio, clase: 'sudoku', html: `
      <div class="sd-info">
        <span>${NIVELES[st.nivel].emoji} ${NIVELES[st.nivel].nombre}</span>
        <span id="errores"></span>
        <span id="reloj">⏱ ${fmt(st.tiempo)}</span>
      </div>
      <div class="sd-tablero" id="tablero">
        ${st.valores.map((_, i) => `<button class="sd-celda" data-i="${i}" data-sin></button>`).join('')}
      </div>
      <div class="sd-herramientas">
        <button class="herr" id="deshacer"><span>↩︎</span>Deshacer</button>
        <button class="herr" id="borrar"><span>⌫</span>Borrar</button>
        <button class="herr" id="notas"><span>✏️</span>Notas <i id="notas-est">NO</i></button>
        <button class="herr" id="pista"><span>💡</span>Pista</button>
      </div>
      <div class="sd-numeros" id="numeros">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="sd-num" data-n="${n}" data-sin>${n}<small></small></button>`).join('')}
      </div>` });
    const celdas = [...p.querySelectorAll('.sd-celda')];

    function pintar() {
      const v = sel >= 0 ? st.valores[sel] : 0;
      const r = Math.floor(sel / 9), c = sel % 9, x = caja(sel);
      celdas.forEach((el, i) => {
        const val = st.valores[i];
        const fija = st.puzzle[i] !== 0;
        el.className = 'sd-celda';
        if (fija) el.classList.add('fija');
        else if (val && val !== st.sol[i]) el.classList.add('mal');
        else if (val) el.classList.add('puesta');
        if (sel >= 0) {
          if (i === sel) el.classList.add('sel');
          else if (Math.floor(i / 9) === r || i % 9 === c || caja(i) === x) el.classList.add('vecina');
          if (v && val === v && i !== sel) el.classList.add('igual');
        }
        if (val) el.textContent = val;
        else if (st.notas[i]) {
          el.innerHTML = `<span class="sd-notas">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<i>${st.notas[i] & (1 << d) ? d : ''}</i>`).join('')}</span>`;
        } else el.textContent = '';
      });
      p.querySelectorAll('.sd-num').forEach(b => {
        const n = +b.dataset.n;
        const usados = st.valores.filter((x, i) => x === n && x === st.sol[i]).length;
        b.querySelector('small').textContent = 9 - usados || '';
        b.classList.toggle('agotado', usados >= 9);
      });
      p.querySelector('#errores').textContent = `❌ ${st.errores}`;
      p.querySelector('#notas-est').textContent = notas ? 'SÍ' : 'NO';
      p.querySelector('#notas').classList.toggle('on', notas);
      p.querySelector('#deshacer').disabled = !hist.length;
    }

    // Al poner un número correcto se borra esa nota en las vecinas.
    function limpiarNotas(i, n) {
      const r = Math.floor(i / 9), c = i % 9, x = caja(i);
      for (let j = 0; j < 81; j++) {
        if (Math.floor(j / 9) === r || j % 9 === c || caja(j) === x) st.notas[j] &= ~(1 << n);
      }
    }

    function poner(n) {
      if (sel < 0 || st.puzzle[sel] || st.completo) return;
      if (st.valores[sel] === st.sol[sel] && st.valores[sel]) return;
      hist.push({ i: sel, v: st.valores[sel], notas: st.notas.slice() });
      if (notas) {
        st.valores[sel] = 0;
        st.notas[sel] ^= 1 << n;
        Sonido.toque();
      } else {
        st.valores[sel] = n;
        st.notas[sel] = 0;
        if (n === st.sol[sel]) {
          limpiarNotas(sel, n);
          Sonido.acierto();
        } else {
          st.errores++;
          Sonido.error();
          App.vibrar([40, 40, 40]);
        }
      }
      guardar();
      pintar();
      revisarFin();
    }

    function revisarFin() {
      if (!st.valores.every((v, i) => v === st.sol[i])) return;
      st.completo = true;
      guardar();
      clearInterval(intervalo);
      const records = App.leer('sudoku:records', {});
      const record = !st.pistas && (!records[st.nivel] || st.tiempo < records[st.nivel]);
      if (record) { records[st.nivel] = st.tiempo; App.guardar('sudoku:records', records); }
      Sonido.ganar();
      App.confeti(150);
      setTimeout(() => ganaste(record), 900);
    }

    function ganaste(record) {
      const d = document.createElement('div');
      d.className = 'modal ver';
      d.innerHTML = `<div class="modal-caja ganador">
        <span class="emo">🏆</span>
        <h2>¡Lo resolviste!</h2>
        <p>${NIVELES[st.nivel].nombre} en ${fmt(st.tiempo)}${record ? '<br>¡Nuevo récord! 🎉' : ''}</p>
        <p style="font-size:1rem;opacity:.8">Errores: ${st.errores} · Pistas: ${st.pistas}</p>
        <div class="fila"><button class="btn gris" data-r="menu">Menú</button><button class="btn verde" data-r="otra">Otro igual</button></div>
      </div>`;
      document.body.appendChild(d);
      d.addEventListener('click', e => {
        const b = e.target.closest('[data-r]');
        if (!b) return;
        d.remove();
        b.dataset.r === 'otra' ? nueva(st.nivel) : inicio();
      });
    }

    p.querySelector('#tablero').onclick = e => {
      const el = e.target.closest('.sd-celda');
      if (!el) return;
      sel = +el.dataset.i;
      Sonido.toque();
      pintar();
    };
    p.querySelectorAll('.sd-num').forEach(b => { b.onclick = () => poner(+b.dataset.n); });
    p.querySelector('#notas').onclick = () => { notas = !notas; pintar(); };
    p.querySelector('#borrar').onclick = () => {
      if (sel < 0 || st.puzzle[sel] || (st.valores[sel] && st.valores[sel] === st.sol[sel])) return;
      hist.push({ i: sel, v: st.valores[sel], notas: st.notas.slice() });
      st.valores[sel] = 0;
      st.notas[sel] = 0;
      guardar();
      pintar();
    };
    p.querySelector('#deshacer').onclick = () => {
      const u = hist.pop();
      if (!u) return;
      st.valores[u.i] = u.v;
      st.notas = u.notas;
      sel = u.i;
      guardar();
      pintar();
    };
    p.querySelector('#pista').onclick = () => {
      if (st.completo) return;
      let i = sel >= 0 && st.valores[sel] !== st.sol[sel] ? sel : -1;
      if (i < 0) i = st.valores.findIndex((v, j) => v !== st.sol[j]);
      if (i < 0) return;
      hist.push({ i, v: st.valores[i], notas: st.notas.slice() });
      st.valores[i] = st.sol[i];
      st.notas[i] = 0;
      limpiarNotas(i, st.sol[i]);
      st.pistas++;
      sel = i;
      Sonido.revelar();
      guardar();
      pintar();
      revisarFin();
    };

    // También se puede jugar con teclado en la compu.
    const tecla = e => {
      if (/^[1-9]$/.test(e.key)) poner(+e.key);
      else if (e.key === 'Backspace' || e.key === 'Delete') p.querySelector('#borrar').click();
      else if (e.key.startsWith('Arrow') && sel >= 0) {
        const d = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
        sel = (sel + d + 81) % 81;
        pintar();
      }
    };
    document.addEventListener('keydown', tecla);

    const intervalo = setInterval(() => {
      if (document.hidden || st.completo) return;
      st.tiempo++;
      p.querySelector('#reloj').textContent = `⏱ ${fmt(st.tiempo)}`;
      if (st.tiempo % 5 === 0) guardar();
    }, 1000);

    App.alSalir(() => {
      clearInterval(intervalo);
      document.removeEventListener('keydown', tecla);
      guardar();
      App.despierto(false);
    });
    pintar();
  }

  return { inicio, generar };
})();
