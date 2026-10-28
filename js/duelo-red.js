// Duelos en red: todos juegan lo mismo a la vez, cada uno en su celu, y la sala muestra la tabla en vivo.
// Sudoku y Crucigrama: mismo tablero, gana el más rápido. Racimo y Granizada: mismas fichas, gana el que más suma.

JUEGOS_RED.duelo = (() => {
  const TIPOS = {
    sudoku: { nombre: 'Sudoku', emoji: '🔢', mide: 'tiempo', niveles: { facil: 'Fácil', medio: 'Medio', dificil: 'Difícil', experto: 'Experto' } },
    crucigrama: { nombre: 'Crucigrama', emoji: '✏️', mide: 'tiempo', niveles: { facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' } },
    racimo: { nombre: 'Racimo', emoji: '🍇', mide: 'puntos' },
    granizada: { nombre: 'Granizada', emoji: '⛈️', mide: 'puntos' },
  };
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  let visto = '';

  function datosPara(tipo, nivel) {
    if (tipo === 'sudoku') return { nivel, ...Sudoku.generar(nivel) };
    if (tipo === 'crucigrama') return { nivel, ...Crucigrama.generar(nivel) };
    return { semilla: Math.floor(Math.random() * 2 ** 31) };
  }

  function empezar(ctx, op) {
    ctx.memoria.op = op;
    const nombres = Object.fromEntries(ctx.jugadores.map(j => [j.id, j.nombre]));
    ctx.publicar({ juego: 'duelo', tipo: op.tipo, nivel: op.nivel, datos: datosPara(op.tipo, op.nivel), nombres, jugando: [], resultados: {}, vez: Date.now() });
  }

  function accion(ctx, de, a) {
    const e = ctx.estado;
    if (!e || e.juego !== 'duelo') return;
    if (a.tipo === 'empece' && a.vez === e.vez && !e.jugando.includes(de)) {
      ctx.publicar({ ...e, jugando: [...e.jugando, de], nombres: { ...e.nombres, [de]: ctx.nombreDe(de) } });
    } else if (a.tipo === 'resultado' && a.vez === e.vez && !e.resultados[de]) {
      const valor = typeof a.valor === 'number' ? a.valor : null;
      ctx.publicar({ ...e, resultados: { ...e.resultados, [de]: { valor, texto: String(a.texto || '').slice(0, 60) } } });
    } else if (a.tipo === 'otro' && de === ctx.yo) empezar(ctx, ctx.memoria.op);
    else if (a.tipo === 'sala' && de === ctx.yo) ctx.aLaSala();
  }

  // Tabla: primero los que terminaron (por tiempo o por puntos), después los que siguen jugando.
  function tabla(e) {
    const t = TIPOS[e.tipo];
    const listos = Object.entries(e.resultados).filter(([, r]) => r.valor != null)
      .sort(([, a], [, b]) => t.mide === 'tiempo' ? a.valor - b.valor : b.valor - a.valor);
    const abandonos = Object.entries(e.resultados).filter(([, r]) => r.valor == null);
    const siguen = e.jugando.filter(id => !e.resultados[id]);
    return { listos, abandonos, siguen };
  }

  function vista(ctx) {
    const e = ctx.estado, t = TIPOS[e.tipo], N = id => App.esc(ctx.nombreDe(id));
    const { listos, abandonos, siguen } = tabla(e);
    const mio = e.resultados[ctx.yo];
    const jugando = e.jugando.includes(ctx.yo);
    return `
      <p class="tb-titulo-red">${t.emoji} Duelo de ${t.nombre}${e.nivel && t.niveles ? ' · ' + t.niveles[e.nivel] : ''}</p>
      <p class="bajada">${t.mide === 'tiempo' ? 'Todos el mismo tablero: gana el que lo termina más rápido.' : 'A todos les sale lo mismo en el mismo orden: gana el que más suma.'}</p>
      ${!mio ? `<button class="btn grande verde" id="jugar" data-sin>${jugando ? '▶ Volver a mi partida' : '¡Jugar!'}</button>` : `<p class="red-aviso">Tu resultado: <b>${App.esc(mio.texto)}</b></p>`}
      <h2 class="titulito">Tabla en vivo</h2>
      <ol class="podio">
        ${listos.map(([id, r], k) => `<li class="${['amarillo', 'celeste', 'naranja'][k] || 'violeta'}"><span>${['🥇', '🥈', '🥉'][k] || k + 1 + '°'}</span><b>${N(id)}${id === ctx.yo ? ' (vos)' : ''}</b><strong>${t.mide === 'tiempo' ? fmt(r.valor) : r.valor}</strong></li>`).join('')}
        ${siguen.map(id => `<li class="gris"><span>⏳</span><b>${N(id)}</b><strong>jugando</strong></li>`).join('')}
        ${abandonos.map(([id]) => `<li class="gris"><span>🏳️</span><b>${N(id)}</b><strong>—</strong></li>`).join('')}
      </ol>
      ${!listos.length && !siguen.length ? '<p class="nota centro">Todavía nadie arrancó</p>' : ''}
      ${ctx.esAnfitrion ? '<div class="acciones"><button class="btn violeta" id="otro">Nuevo duelo (otro tablero)</button><button class="btn gris" id="sala">Volver a la sala</button></div>' : ''}`;
  }

  function enlazar(el, ctx) {
    const e = ctx.estado;
    const fin = Object.keys(e.resultados).length;
    const clave = `${e.vez}:${fin}`;
    if (clave !== visto) {
      if (visto.startsWith(e.vez + ':') && fin) Sonido.revelar();
      visto = clave;
    }
    const on = (id, f) => { const b = el.querySelector(id); if (b) b.onclick = f; };
    on('#jugar', () => {
      Sonido.desbloquear();
      const vez = e.vez;
      if (!e.jugando.includes(ctx.yo)) ctx.accion({ tipo: 'empece', vez });
      const cb = {
        alTerminar: r => ctx.accion({ tipo: 'resultado', vez, valor: r.valor, texto: r.texto }),
        volver: () => ctx.volverALaSala(),
      };
      const d = e.datos;
      ctx.jugarAfuera(() => {
        if (e.tipo === 'sudoku') Sudoku.desafio(d, cb);
        else if (e.tipo === 'crucigrama') Crucigrama.desafio(d, cb);
        else if (e.tipo === 'racimo') Racimo.desafio(d.semilla, cb);
        else Granizada.desafio(d.semilla, cb);
      });
    });
    on('#otro', async () => { if (await App.preguntar('¿Arrancar otro duelo? La tabla se reinicia.', 'Sí', 'No')) ctx.accion({ tipo: 'otro' }); });
    on('#sala', () => ctx.accion({ tipo: 'sala' }));
  }

  return {
    id: 'duelo', nombre: 'Duelo', emoji: '🏁', color: 'celeste', minimo: 1,
    bajada: 'Sudoku, Crucigrama, Racimo o Granizada: todos lo mismo, a ver quién gana',
    opciones: () => {
      const pref = App.leer('duelo-red:pref', { tipo: 'sudoku', nivel: 'medio' });
      return `<div class="chips" id="du-tipo">${Object.entries(TIPOS).map(([k, t]) => `<button class="chip ${k === pref.tipo ? 'on' : ''}" data-v="${k}">${t.emoji} ${t.nombre}</button>`).join('')}</div>
        <div class="opcion"><span>Nivel</span><div class="segmentos" id="du-nivel">${[['facil', 'Fácil'], ['medio', 'Medio'], ['dificil', 'Difícil']].map(([v, t]) => `<button data-v="${v}" class="${v === pref.nivel ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <p class="nota">El nivel es para Sudoku y Crucigrama. En el duelo no hay pistas.</p>`;
    },
    leerOpciones: el => {
      const op = { tipo: el.querySelector('#du-tipo .on').dataset.v, nivel: el.querySelector('#du-nivel .on').dataset.v };
      App.guardar('duelo-red:pref', op);
      return op;
    },
    empezar, accion, vista, enlazar,
  };
})();
