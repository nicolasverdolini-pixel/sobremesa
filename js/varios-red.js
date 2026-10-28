// Anotador de Truco y Sorteo de equipos en red.

// Reparte a los jugadores en `n` equipos al azar (lo usan también Tabú y Mímica en red).
function sortearEnEquipos(ids, n) {
  const grupos = Array.from({ length: n }, () => []);
  App.mezclar(ids.slice()).forEach((id, k) => grupos[k % n].push(id));
  return grupos;
}

// ---------- Truco: un tanteador compartido; cualquiera de la sala puede anotar ----------
JUEGOS_RED.truco = (() => {
  let vistos = '';

  function empezar(ctx, op) {
    ctx.memoria.op = op;
    ctx.publicar({ juego: 'truco', meta: op.meta, nombres: op.nombres, puntos: [0, 0], hist: [], ganador: null, ultimo: null });
  }

  function accion(ctx, de, a) {
    const e = ctx.estado;
    if (!e || e.juego !== 'truco') return;
    if (a.tipo === 'sumar') {
      const v = e.puntos[a.eq] + a.d;
      if (v < 0 || v > e.meta || (a.d > 0 && e.ganador !== null)) return;
      const puntos = [...e.puntos];
      puntos[a.eq] = v;
      const ganador = v === e.meta ? a.eq : (e.ganador === a.eq ? null : e.ganador);
      ctx.publicar({ ...e, puntos, hist: [...e.hist, [a.eq, a.d, de]].slice(-200), ganador, ultimo: { eq: a.eq, d: a.d, de } });
    } else if (a.tipo === 'deshacer' && e.hist.length) {
      const [eq, d] = e.hist[e.hist.length - 1];
      const puntos = [...e.puntos];
      puntos[eq] -= d;
      ctx.publicar({ ...e, puntos, hist: e.hist.slice(0, -1), ganador: puntos[e.ganador] === e.meta ? e.ganador : null, ultimo: null });
    } else if (a.tipo === 'nueva' && de === ctx.yo) empezar(ctx, ctx.memoria.op);
    else if (a.tipo === 'sala' && de === ctx.yo) ctx.aLaSala();
  }

  function vista(ctx) {
    const e = ctx.estado;
    const quien = e.ultimo ? `${App.esc(ctx.nombreDe(e.ultimo.de))} anotó ${e.ultimo.d > 0 ? '+1' : '−1'} a ${App.esc(e.nombres[e.ultimo.eq])}` : 'Cualquiera de la sala puede anotar';
    return `
      <p class="tb-titulo-red">🃏 Truco a ${e.meta}</p>
      ${e.ganador !== null ? `<div class="tb-fin"><b>🏆 ¡Ganó ${App.esc(e.nombres[e.ganador])}!</b><span>${e.puntos[0]} a ${e.puntos[1]}</span></div>` : ''}
      <div class="truco-cols truco-red">
        ${[0, 1].map(eq => `
          <div class="equipo eq${eq} ${e.ganador === eq ? 'gano' : ''}">
            <div class="nombre">${App.esc(e.nombres[eq])}</div>
            <div class="tantos"><b>${e.puntos[eq]}</b><small>${e.meta === 15 ? (e.puntos[eq] ? `faltan ${15 - e.puntos[eq]}` : '') : e.puntos[eq] < 15 ? 'malas' : e.puntos[eq] < 30 ? 'buenas' : ''}</small></div>
            <div class="palitos">${Truco.fosforos(e.puntos[eq], e.meta, e.ultimo && e.ultimo.eq === eq && e.ultimo.d > 0)}</div>
            <button class="btn grande mas ${eq ? 'naranja' : 'celeste'}" data-mas="${eq}" data-sin ${e.ganador !== null ? 'disabled' : ''}>+1</button>
            <button class="btn chico menos gris" data-menos="${eq}" data-sin ${e.puntos[eq] ? '' : 'disabled'}>−1</button>
          </div>`).join('')}
      </div>
      <p class="nota">${quien}</p>
      <div class="sd-herramientas">
        <button class="herr" id="deshacer" ${e.hist.length ? '' : 'disabled'}><span>↩︎</span>Deshacer</button>
        ${ctx.esAnfitrion ? '<button class="herr" id="nueva"><span>✨</span>Nueva</button><button class="herr" id="sala"><span>🏠</span>A la sala</button>' : ''}
      </div>`;
  }

  function enlazar(el, ctx) {
    const e = ctx.estado;
    const clave = e.hist.length + ':' + (e.ganador ?? '');
    if (clave !== vistos) {
      if (e.ultimo) { e.ultimo.d > 0 ? Sonido.fosforo() : Sonido.restar(); }
      if (e.ganador !== null && !vistos.endsWith(':' + e.ganador)) { Sonido.ganar(); App.confeti(150); }
      vistos = clave;
    }
    el.querySelectorAll('[data-mas]').forEach(b => { b.onclick = () => ctx.accion({ tipo: 'sumar', eq: +b.dataset.mas, d: 1 }); });
    el.querySelectorAll('[data-menos]').forEach(b => { b.onclick = () => ctx.accion({ tipo: 'sumar', eq: +b.dataset.menos, d: -1 }); });
    const on = (id, f) => { const b = el.querySelector(id); if (b) b.onclick = f; };
    on('#deshacer', () => ctx.accion({ tipo: 'deshacer' }));
    on('#nueva', async () => { if (await App.preguntar('¿Empezar otra partida?', 'Sí', 'No')) ctx.accion({ tipo: 'nueva' }); });
    on('#sala', () => ctx.accion({ tipo: 'sala' }));
  }

  return {
    id: 'truco', nombre: 'Anotador de Truco', emoji: '🃏', color: 'verde', minimo: 1,
    bajada: 'Tanteador compartido: todos lo ven y cualquiera anota',
    opciones: () => {
      const pref = App.leer('truco-red:pref', { meta: 30, nombres: ['Nosotros', 'Ellos'] });
      return `
        <div class="opcion"><span>A cuántos</span><div class="segmentos" id="tr-meta">${[15, 30].map(n => `<button data-v="${n}" class="${n === pref.meta ? 'on' : ''}">A ${n}</button>`).join('')}</div></div>
        <label class="red-campo"><span>Equipo 1</span><input id="tr-n0" maxlength="14" value="${App.esc(pref.nombres[0])}"></label>
        <label class="red-campo"><span>Equipo 2</span><input id="tr-n1" maxlength="14" value="${App.esc(pref.nombres[1])}"></label>`;
    },
    leerOpciones: el => {
      const op = {
        meta: +el.querySelector('#tr-meta .on').dataset.v,
        nombres: [el.querySelector('#tr-n0').value.trim() || 'Nosotros', el.querySelector('#tr-n1').value.trim() || 'Ellos'],
      };
      App.guardar('truco-red:pref', op);
      return op;
    },
    empezar, accion, vista, enlazar,
  };
})();

// ---------- Sorteo de equipos con los que están en la sala ----------
JUEGOS_RED.sorteo = (() => {
  let visto = '';

  function empezar(ctx, op) {
    ctx.memoria.op = op;
    const equipos = sortearEnEquipos(ctx.jugadores.map(j => j.id), op.n);
    const nombres = Object.fromEntries(ctx.jugadores.map(j => [j.id, j.nombre]));
    ctx.publicar({ juego: 'sorteo', equipos, nombres, vez: Date.now() });
  }

  function accion(ctx, de, a) {
    if (de !== ctx.yo) return;
    if (a.tipo === 'otra') empezar(ctx, ctx.memoria.op);
    else if (a.tipo === 'sala') ctx.aLaSala();
  }

  function vista(ctx) {
    const e = ctx.estado;
    const mio = e.equipos.findIndex(g => g.includes(ctx.yo));
    return `
      <p class="tb-titulo-red">🎲 Sorteo de equipos</p>
      ${mio >= 0 ? `<div class="turno-de ${Equipos.COLORES[mio].clase}"><small>Te tocó</small><b>${Equipos.COLORES[mio].emoji} ${Equipos.COLORES[mio].nombre}</b></div>` : ''}
      <div class="equipos-res">
        ${e.equipos.map((g, k) => `
          <div class="equipo-tarjeta ${Equipos.COLORES[k].clase} sale" style="animation-delay:${k * 150}ms">
            <b>${Equipos.COLORES[k].emoji} ${Equipos.COLORES[k].nombre}</b>
            <span>${g.map(id => App.esc(ctx.nombreDe(id))).join(' · ') || '—'}</span>
          </div>`).join('')}
      </div>
      ${ctx.esAnfitrion ? '<div class="acciones"><button class="btn grande amarillo" id="otra">🎲 Volver a sortear</button><button class="btn violeta" id="sala">Volver a la sala</button></div>' : '<p class="red-aviso">El anfitrión puede volver a sortear</p>'}`;
  }

  function enlazar(el, ctx) {
    if (ctx.estado.vez !== visto) { visto = ctx.estado.vez; Sonido.carta(); setTimeout(Sonido.revelar, 250); }
    const on = (id, f) => { const b = el.querySelector(id); if (b) b.onclick = f; };
    on('#otra', () => ctx.accion({ tipo: 'otra' }));
    on('#sala', () => ctx.accion({ tipo: 'sala' }));
  }

  return {
    id: 'sorteo', nombre: 'Sorteo de equipos', emoji: '🎲', color: 'rosa', minimo: 2,
    bajada: 'Arma equipos al azar con los de la sala',
    opciones: () => `<div class="opcion"><span>¿Cuántos equipos?</span><div class="segmentos" id="so-n">${[2, 3, 4].map(n => `<button data-v="${n}" class="${n === 2 ? 'on' : ''}">${n}</button>`).join('')}</div></div>`,
    leerOpciones: el => ({ n: +el.querySelector('#so-n .on').dataset.v }),
    empezar, accion, vista, enlazar,
  };
})();
