// Pantalla común para juegos de tablero de 8×8 (Ajedrez y Damas): contra la compu o de a dos en el mismo celu.
//
// cfg = { id, titulo, emoji, como, nombres: { w, b },
//         inicial(), legales(s, op), mover(s, mv), fin(s, claves, op), clave(s),
//         compu(s, nivel, op), pieza(p, i), jaque(s) -> casilla o -1, textoFin(f),
//         elegir(movs, s) -> Promise<mv> (cuando varias jugadas van a la misma casilla),
//         esCaptura(mv), caidas(s) -> { w: html, b: html },
//         opciones?: { html(op), leer(pantalla) -> op, defecto } }

function JuegoDeTablero(cfg) {
  let st = App.leer(cfg.id + ':partida', null);
  const guardar = () => App.guardar(cfg.id + ':partida', st);
  const NIVELES = { facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' };
  const otro = t => (t === 'w' ? 'b' : 'w');

  function inicio() {
    App.despierto(false);
    const pref = App.leer(cfg.id + ':pref', { nivel: 'medio', color: 'w', op: cfg.opciones ? cfg.opciones.defecto : null });
    const hay = st && !st.terminado && st.hist.length > 1;
    const seg = (id, vals, actual) => `<div class="segmentos" id="${id}">${Object.entries(vals).map(([k, v]) => `<button data-v="${k}" class="${k === actual ? 'on' : ''}">${v}</button>`).join('')}</div>`;
    const p = App.pantalla({ titulo: cfg.titulo, volver: App.menu, clase: 'tb-inicio', html: `
      <div class="ilus-grande">${cfg.emoji}</div>
      ${hay ? `<button class="btn grande amarillo" id="seguir">▶ Seguir partida <small>(${st.modo === 'compu' ? 'contra la compu' : 'de a dos'})</small></button>` : ''}
      <div class="tb-modo">
        <b>🤖 Contra la compu</b>
        <div class="opcion"><span>Nivel</span>${seg('nivel', NIVELES, pref.nivel)}</div>
        <div class="opcion"><span>Jugás con</span>${seg('color', { w: cfg.nombres.w, b: cfg.nombres.b, azar: '🎲' }, pref.color)}</div>
        <button class="btn verde" id="compu">Jugar contra la compu</button>
      </div>
      <div class="tb-modo">
        <b>👥 Dos jugadores</b>
        <p>En el mismo celu: cada uno mueve en su turno.</p>
        <button class="btn violeta" id="dos">Jugar de a dos</button>
      </div>
      ${cfg.opciones ? `<div class="tb-modo"><b>⚙️ Reglas</b>${cfg.opciones.html(pref.op)}</div>` : ''}
      <div class="como"><b>Cómo se juega</b><p>${cfg.como}</p></div>` });

    p.querySelectorAll('.segmentos').forEach(g => g.querySelectorAll('button').forEach(b => {
      b.onclick = () => g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    }));
    const leer = () => {
      const nivel = p.querySelector('#nivel .on').dataset.v;
      const color = p.querySelector('#color .on').dataset.v;
      const op = cfg.opciones ? cfg.opciones.leer(p) : null;
      App.guardar(cfg.id + ':pref', { nivel, color, op });
      return { nivel, color, op };
    };
    const empezar = async (modo) => {
      if (hay && !(await App.preguntar('¿Empezar otra? Se pierde la partida que tenías.', 'Sí', 'No'))) return;
      const { nivel, color, op } = leer();
      const humano = color === 'azar' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
      st = { modo, nivel, humano: modo === 'compu' ? humano : 'w', op, hist: [cfg.inicial()], ultima: null, volteado: modo === 'compu' && humano === 'b', terminado: null };
      guardar();
      jugar();
    };
    p.querySelector('#compu').onclick = () => empezar('compu');
    p.querySelector('#dos').onclick = () => empezar('dos');
    if (hay) p.querySelector('#seguir').onclick = jugar;
  }

  function jugar() {
    App.despierto(true);
    let sel = -1, pensando = false, ficha = 0, vivo = true;
    const actual = () => st.hist[st.hist.length - 1];
    const esCompu = t => st.modo === 'compu' && t !== st.humano;
    const nombre = t => st.modo === 'compu' ? (t === st.humano ? 'Vos' : `Compu (${NIVELES[st.nivel]})`) : cfg.nombres[t];

    const p = App.pantalla({ titulo: cfg.titulo, volver: inicio, clase: 'tb-juego ' + cfg.id, html: `
      <div class="tb-jugador" id="arriba"></div>
      <div class="tb-tablero" id="tablero">
        ${Array.from({ length: 64 }, (_, k) => `<button class="tb-casilla" data-v="${k}" data-sin></button>`).join('')}
      </div>
      <div class="tb-jugador" id="abajo"></div>
      <div class="sd-herramientas">
        <button class="herr" id="deshacer"><span>↩︎</span>Deshacer</button>
        <button class="herr" id="voltear"><span>🔄</span>Dar vuelta</button>
        <button class="herr" id="rendir"><span>🏳️</span>Rendirse</button>
        <button class="herr" id="nueva"><span>✨</span>Nueva</button>
      </div>` });
    const casillas = [...p.querySelectorAll('.tb-casilla')];
    // Casilla visual -> casilla del tablero (según si está dado vuelta).
    const real = v => (st.volteado ? 63 - v : v);

    function pintar(llega = -1) {
      const s = actual();
      const movs = st.terminado || pensando || esCompu(s.turno) ? [] : cfg.legales(s, st.op);
      const desde = new Set(movs.map(m => m.de));
      const destinos = new Map();
      movs.filter(m => m.de === sel).forEach(m => destinos.set(m.a, cfg.esCaptura(m)));
      const obligadas = movs.some(m => cfg.esCaptura(m)) && cfg.marcarObligadas ? desde : new Set();
      const jaque = cfg.jaque(s);
      casillas.forEach((el, v) => {
        const i = real(v);
        const oscura = ((i >> 3) + (i & 7)) % 2 === 1;
        el.className = 'tb-casilla ' + (oscura ? 'oscura' : 'clara')
          + (st.ultima && (st.ultima.de === i || st.ultima.a === i) ? ' ultima' : '')
          + (i === sel ? ' sel' : '')
          + (destinos.has(i) ? (destinos.get(i) ? ' come' : ' destino') : '')
          + (i === jaque ? ' jaque' : '')
          + (obligadas.has(i) && sel < 0 ? ' debe' : '');
        el.innerHTML = s.b[i] ? cfg.pieza(s.b[i], i === llega ? 'llega' : '') : '';
      });
      const caidas = cfg.caidas(s);
      const abajo = st.volteado ? 'b' : 'w';
      for (const [id, t] of [['abajo', abajo], ['arriba', otro(abajo)]]) {
        const el = p.querySelector('#' + id);
        el.className = 'tb-jugador' + (s.turno === t && !st.terminado ? ' turno' : '');
        el.innerHTML = `<span class="tb-color ${t}"></span><b>${nombre(t)}</b>
          ${s.turno === t && pensando ? '<span class="pensando"><i></i><i></i><i></i></span>' : ''}
          <span class="tb-caidas">${caidas[otro(t)]}</span>`;
      }
      p.querySelector('#deshacer').disabled = st.hist.length < 2 || pensando;
      p.querySelector('#rendir').disabled = !!st.terminado;
    }

    function aplicar(mv) {
      const s = actual();
      const nuevo = cfg.mover(s, mv);
      st.hist.push(nuevo);
      st.ultima = { de: mv.de, a: mv.a };
      sel = -1;
      if (cfg.esCaptura(mv)) Sonido.clac(true); else Sonido.clac(false);
      App.vibrar(cfg.esCaptura(mv) ? 40 : 15);
      const claves = st.hist.slice(0, -1).map(cfg.clave);
      const f = cfg.fin(nuevo, claves, st.op);
      if (f) st.terminado = f;
      else if (cfg.jaque(nuevo) >= 0) setTimeout(() => { Sonido.tic(); setTimeout(Sonido.tic, 120); }, 120);
      guardar();
      pintar(mv.a);
      if (f) return terminar(f);
      if (esCompu(nuevo.turno)) turnoCompu();
    }

    function turnoCompu() {
      pensando = true;
      const mio = ++ficha;
      pintar();
      // Se espera un poquito para que se vea "pensando" y la jugada no aparezca de golpe.
      setTimeout(() => {
        if (!vivo || mio !== ficha) return;
        const mv = cfg.compu(actual(), st.nivel, st.op);
        pensando = false;
        if (mv) aplicar(mv);
        else pintar();
      }, 450);
    }

    function terminar(f) {
      const texto = cfg.textoFin(f);
      let titulo, emo;
      if (!f.ganador) { titulo = 'Tablas'; emo = '🤝'; Sonido.revelar(); }
      else if (st.modo === 'compu') {
        const gane = f.ganador === st.humano;
        titulo = gane ? '¡Ganaste!' : 'Ganó la compu';
        emo = gane ? '🏆' : '🤖';
        if (gane) { Sonido.ganar(); App.confeti(150); } else Sonido.error();
      } else { titulo = `¡Ganan las ${cfg.nombres[f.ganador]}!`; emo = '🏆'; Sonido.ganar(); App.confeti(150); }
      setTimeout(() => {
        if (!vivo) return;
        const d = document.createElement('div');
        d.className = 'modal ver';
        d.innerHTML = `<div class="modal-caja ganador">
          <span class="emo">${emo}</span><h2>${titulo}</h2><p>${texto}</p>
          <div class="fila"><button class="btn gris" data-r="ver">Ver tablero</button><button class="btn verde" data-r="otra">Otra</button></div>
        </div>`;
        document.body.appendChild(d);
        d.addEventListener('click', e => {
          const b = e.target.closest('[data-r]');
          if (!b) return;
          d.remove();
          if (b.dataset.r === 'otra') inicio();
        });
      }, 700);
    }

    p.querySelector('#tablero').onclick = async e => {
      const el = e.target.closest('.tb-casilla');
      if (!el || pensando || st.terminado) return;
      const s = actual();
      if (esCompu(s.turno)) return;
      const i = real(+el.dataset.v);
      const movs = cfg.legales(s, st.op);
      const hacia = movs.filter(m => m.de === sel && m.a === i);
      if (hacia.length) {
        const mv = hacia.length > 1 ? await cfg.elegir(hacia, s) : hacia[0];
        if (mv) aplicar(mv);
        return;
      }
      if (movs.some(m => m.de === i)) { sel = i; Sonido.toque(); }
      else sel = -1;
      pintar();
    };

    p.querySelector('#deshacer').onclick = () => {
      if (st.hist.length < 2) return;
      ficha++;
      pensando = false;
      st.hist.pop();
      if (st.modo === 'compu') while (st.hist.length > 1 && actual().turno !== st.humano) st.hist.pop();
      st.terminado = null;
      st.ultima = null;
      sel = -1;
      guardar();
      pintar();
    };
    p.querySelector('#voltear').onclick = () => { st.volteado = !st.volteado; guardar(); pintar(); };
    p.querySelector('#rendir').onclick = async () => {
      if (st.terminado || !(await App.preguntar('¿Te rendís?', 'Sí', 'No'))) return;
      ficha++;
      pensando = false;
      const pierde = st.modo === 'compu' ? st.humano : actual().turno;
      st.terminado = { tipo: 'rendicion', ganador: otro(pierde) };
      guardar();
      pintar();
      terminar(st.terminado);
    };
    p.querySelector('#nueva').onclick = inicio;

    App.alSalir(() => { vivo = false; guardar(); App.despierto(false); });
    pintar();
    if (!st.terminado && esCompu(actual().turno)) turnoCompu();
  }

  return { inicio };
}
