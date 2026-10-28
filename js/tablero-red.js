// Ajedrez y Damas a distancia: cada jugador mueve desde su celu; los demás de la sala miran.
// El estado público guarda solo la lista de jugadas (el número de jugada legal en cada turno),
// y cada celu rearma la posición desde el principio. Así los mensajes son cortitos.

JUEGOS_RED.tablero = (() => {
  const TIPOS = { ajedrez: () => Ajedrez.cfg, damas: () => Damas.cfg };
  const otro = t => (t === 'w' ? 'b' : 'w');
  let sel = -1, pendiente = null, cache = { clave: '', pos: null }, vistoMovs = -1, vistoFin = false;

  // Rearma la partida a partir de las jugadas.
  function posicion(e, extra = null) {
    const movs = extra == null ? e.movs : [...e.movs, extra];
    const clave = e.tipo + JSON.stringify(e.op) + movs.join(',');
    if (cache.clave === clave) return cache.pos;
    const cfg = TIPOS[e.tipo]();
    const hist = [cfg.inicial()];
    let ultima = null;
    for (const k of movs) {
      const s = hist[hist.length - 1];
      const mv = cfg.legales(s, e.op)[k];
      if (!mv) break;
      hist.push(cfg.mover(s, mv));
      ultima = { de: mv.de, a: mv.a, captura: cfg.esCaptura(mv) };
    }
    cache = { clave, pos: { hist, s: hist[hist.length - 1], ultima } };
    return cache.pos;
  }

  const colorDe = (e, id) => (e.w === id ? 'w' : e.b === id ? 'b' : null);

  // ---------- Anfitrión ----------
  function empezar(ctx, op) {
    const yoColor = op.color === 'azar' ? (Math.random() < 0.5 ? 'w' : 'b') : op.color;
    const nombres = Object.fromEntries(ctx.jugadores.map(j => [j.id, j.nombre]));
    Object.assign(ctx.memoria, { op });
    ctx.publicar({
      juego: 'tablero', tipo: op.tipo, op: op.tipo === 'damas' ? op.reglas : null, nombres,
      w: yoColor === 'w' ? ctx.yo : op.rival, b: yoColor === 'w' ? op.rival : ctx.yo,
      movs: [], fin: null, pide: null,
    });
  }

  function accion(ctx, de, a) {
    const e = ctx.estado;
    if (!e || e.juego !== 'tablero') return;
    const cfg = TIPOS[e.tipo]();
    const mio = colorDe(e, de);
    if (a.tipo === 'mover' && mio && !e.fin && a.n === e.movs.length) {
      const { s, hist } = posicion(e);
      if (s.turno !== mio) return;
      const mv = cfg.legales(s, e.op)[a.k];
      if (!mv) return;
      const movs = [...e.movs, a.k];
      const nuevo = cfg.mover(s, mv);
      const fin = cfg.fin(nuevo, hist.map(cfg.clave), e.op);
      ctx.publicar({ ...e, movs, fin, pide: null });
    } else if (a.tipo === 'pedir' && mio && !e.fin && !e.pide && e.movs.length) {
      ctx.publicar({ ...e, pide: { de, n: e.movs.length } });
    } else if (a.tipo === 'responder' && e.pide && mio && de !== e.pide.de) {
      let movs = e.movs;
      if (a.acepta && e.pide.n === e.movs.length) {
        // Se borra la última jugada de quien pidió (y la respuesta del otro, si ya la hizo).
        const quien = colorDe(e, e.pide.de);
        const { s } = posicion(e);
        movs = e.movs.slice(0, s.turno === quien ? -2 : -1);
      }
      ctx.publicar({ ...e, movs, pide: null, fin: a.acepta ? null : e.fin });
    } else if (a.tipo === 'rendir' && mio && !e.fin) {
      ctx.publicar({ ...e, fin: { tipo: 'rendicion', ganador: otro(mio) }, pide: null });
    } else if (a.tipo === 'revancha' && de === ctx.yo) {
      ctx.publicar({ ...e, w: e.b, b: e.w, movs: [], fin: null, pide: null });
    } else if (a.tipo === 'sala' && de === ctx.yo) ctx.aLaSala();
  }

  // ---------- Pantalla ----------
  function vista(ctx) {
    const e = ctx.estado, cfg = TIPOS[e.tipo]();
    const yoColor = colorDe(e, ctx.yo);
    const { s, ultima } = posicion(e, pendiente);
    const abajo = yoColor || 'w';
    const N = id => App.esc(ctx.nombreDe(id));
    const enSala = id => ctx.jugadores.some(j => j.id === id);
    const jugador = t => `
      <div class="tb-jugador ${s.turno === t && !e.fin ? 'turno' : ''}">
        <span class="tb-color ${t}"></span><b>${N(e[t])}${e[t] === ctx.yo ? ' (vos)' : ''}</b>
        ${enSala(e[t]) ? '' : '<small class="tb-fuera">desconectado</small>'}
        <span class="tb-caidas">${cfg.caidas(s)[otro(t)]}</span>
      </div>`;

    const movs = cfg.legales(s, e.op);
    const miTurno = yoColor && s.turno === yoColor && !e.fin && pendiente == null;
    const desde = new Set(miTurno ? movs.map(m => m.de) : []);
    const destinos = new Map();
    if (miTurno) movs.filter(m => m.de === sel).forEach(m => destinos.set(m.a, cfg.esCaptura(m)));
    const obligadas = miTurno && cfg.marcarObligadas && movs.some(m => cfg.esCaptura(m)) ? desde : new Set();
    const jaque = cfg.jaque(s);
    const casillas = Array.from({ length: 64 }, (_, v) => {
      const i = abajo === 'b' ? 63 - v : v;
      const oscura = ((i >> 3) + (i & 7)) % 2 === 1;
      const cl = 'tb-casilla ' + (oscura ? 'oscura' : 'clara')
        + (ultima && (ultima.de === i || ultima.a === i) ? ' ultima' : '')
        + (i === sel && miTurno ? ' sel' : '')
        + (destinos.has(i) ? (destinos.get(i) ? ' come' : ' destino') : '')
        + (i === jaque ? ' jaque' : '')
        + (obligadas.has(i) && sel < 0 ? ' debe' : '');
      return `<button class="${cl}" data-i="${i}" data-sin>${s.b[i] ? cfg.pieza(s.b[i], ultima && ultima.a === i ? 'llega' : '') : ''}</button>`;
    }).join('');

    let aviso = '';
    if (e.fin) {
      const texto = cfg.textoFin(e.fin);
      const titulo = !e.fin.ganador ? '🤝 Tablas' : e.fin.ganador === yoColor ? '🏆 ¡Ganaste!' : yoColor ? '😅 Perdiste' : `🏆 Ganó ${N(e[e.fin.ganador])}`;
      aviso = `<div class="tb-fin"><b>${titulo}</b><span>${texto}</span></div>`;
    } else if (e.pide) {
      aviso = e.pide.de === ctx.yo
        ? '<p class="red-aviso">Pediste deshacer. Esperando respuesta…</p>'
        : yoColor
          ? `<div class="tb-pide"><span>${N(e.pide.de)} pide deshacer su jugada</span><div class="fila"><button class="btn chico gris" id="no">No</button><button class="btn chico verde" id="si">Dale</button></div></div>`
          : `<p class="red-aviso">${N(e.pide.de)} pidió deshacer</p>`;
    } else if (!yoColor) aviso = '<p class="red-aviso">👀 Estás mirando la partida</p>';
    else if (pendiente != null) aviso = '<p class="red-aviso">Enviando jugada…</p>';
    else aviso = `<p class="red-aviso">${s.turno === yoColor ? '¡Te toca!' : `Le toca a ${N(e[otro(yoColor)])}`}</p>`;

    const host = ctx.esAnfitrion;
    const botones = e.fin
      ? (host ? '<div class="acciones"><button class="btn grande verde" id="revancha">Revancha (cambiando colores)</button><button class="btn violeta" id="sala">Volver a la sala</button></div>' : '')
      : yoColor ? `<div class="sd-herramientas">
          <button class="herr" id="pedir" ${!e.movs.length || e.pide ? 'disabled' : ''}><span>↩︎</span>Pedir deshacer</button>
          <button class="herr" id="rendir"><span>🏳️</span>Rendirse</button>
        </div>` : '';

    return `
      <p class="tb-titulo-red">${cfg.emoji} ${cfg.titulo}</p>
      ${jugador(otro(abajo))}
      <div class="tb-tablero tb-red" id="tablero">${casillas}</div>
      ${jugador(abajo)}
      ${aviso}
      ${botones}`;
  }

  function enlazar(el, ctx) {
    const e = ctx.estado, cfg = TIPOS[e.tipo]();
    const yoColor = colorDe(e, ctx.yo);

    // Sonidos: jugada nueva, jaque, final.
    if (e.movs.length !== vistoMovs) {
      if (vistoMovs >= 0 && e.movs.length > vistoMovs) {
        const { ultima, s } = posicion(e);
        if (pendiente == null || e.movs.length - 1 !== vistoMovs) Sonido.clac(!!(ultima && ultima.captura));
        if (cfg.jaque(s) >= 0) setTimeout(() => { Sonido.tic(); setTimeout(Sonido.tic, 120); }, 120);
        if (yoColor && s.turno === yoColor && !e.fin) App.vibrar(40);
      }
      vistoMovs = e.movs.length;
      pendiente = null;
      sel = -1;
    }
    if (!!e.fin !== vistoFin) {
      vistoFin = !!e.fin;
      if (e.fin) {
        if (!e.fin.ganador) Sonido.revelar();
        else if (e.fin.ganador === yoColor) { Sonido.ganar(); App.confeti(150); }
        else if (yoColor) Sonido.error();
        else Sonido.ganar();
      }
    }

    el.querySelector('#tablero').onclick = async ev => {
      const c = ev.target.closest('.tb-casilla');
      if (!c || !yoColor || e.fin || pendiente != null) return;
      const { s } = posicion(e);
      if (s.turno !== yoColor) return;
      const i = +c.dataset.i;
      const movs = cfg.legales(s, e.op);
      const hacia = movs.filter(m => m.de === sel && m.a === i);
      if (hacia.length) {
        const mv = hacia.length > 1 ? await cfg.elegir(hacia, s) : hacia[0];
        if (!mv) return;
        const k = movs.indexOf(mv);
        // Se muestra al toque, mientras viaja la jugada.
        pendiente = k;
        sel = -1;
        Sonido.clac(cfg.esCaptura(mv));
        ctx.accion({ tipo: 'mover', n: e.movs.length, k });
        ctx.redibujar();
        // Si por algún motivo no llega la confirmación, se vuelve atrás.
        setTimeout(() => { if (pendiente === k && ctx.estado.movs.length === e.movs.length) { pendiente = null; ctx.redibujar(); } }, 5000);
        return;
      }
      sel = movs.some(m => m.de === i) ? i : -1;
      if (sel >= 0) Sonido.toque();
      ctx.redibujar();
    };
    const on = (id, f) => { const b = el.querySelector(id); if (b) b.onclick = f; };
    on('#pedir', () => ctx.accion({ tipo: 'pedir' }));
    on('#rendir', async () => { if (await App.preguntar('¿Te rendís?', 'Sí', 'No')) ctx.accion({ tipo: 'rendir' }); });
    on('#si', () => ctx.accion({ tipo: 'responder', acepta: true }));
    on('#no', () => ctx.accion({ tipo: 'responder', acepta: false }));
    on('#revancha', () => ctx.accion({ tipo: 'revancha' }));
    on('#sala', () => ctx.accion({ tipo: 'sala' }));
  }

  return {
    id: 'tablero', nombre: 'Ajedrez o Damas', emoji: '♞', color: 'naranja', minimo: 2,
    bajada: 'Uno contra uno, cada uno en su celu',
    opciones: ctx => {
      const pref = App.leer('tablero-red:pref', { tipo: 'ajedrez', color: 'w' });
      const rivales = ctx.jugadores.filter(j => j.id !== ctx.yo);
      return `
        <div class="chips" id="tr-tipo"><button class="chip ${pref.tipo === 'ajedrez' ? 'on' : ''}" data-v="ajedrez">♞ Ajedrez</button><button class="chip ${pref.tipo === 'damas' ? 'on' : ''}" data-v="damas">⚪ Damas</button></div>
        <p class="bajada">¿Contra quién jugás?</p>
        <div class="chips" id="tr-rival">${rivales.map((j, k) => `<button class="chip ${k === 0 ? 'on' : ''}" data-v="${j.id}">${App.esc(j.nombre)}</button>`).join('')}</div>
        <div class="opcion"><span>Jugás con</span><div class="segmentos" id="tr-color">${[['w', 'Blancas'], ['b', 'Negras'], ['azar', '🎲']].map(([v, t]) => `<button data-v="${v}" class="${v === pref.color ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <details class="tr-reglas"><summary>Reglas de las damas</summary>${Damas.cfg.opciones.html(App.leer('damas:pref', {}).op)}</details>
        <p class="nota">Los demás de la sala pueden mirar la partida.</p>`;
    },
    leerOpciones: el => {
      const op = {
        tipo: el.querySelector('#tr-tipo .on').dataset.v,
        rival: el.querySelector('#tr-rival .on')?.dataset.v,
        color: el.querySelector('#tr-color .on').dataset.v,
        reglas: Damas.cfg.opciones.leer(el),
      };
      if (!op.rival) return null;
      App.guardar('tablero-red:pref', { tipo: op.tipo, color: op.color });
      return op;
    },
    empezar, accion, vista, enlazar,
  };
})();
