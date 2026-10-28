// Tabú y Mímica en red, por equipos.
// El que explica ve la carta en su celu. En Tabú, el equipo rival también la ve (con las prohibidas)
// y tiene un botón para cantar "¡Tabú!". Su propio equipo no ve nada: tiene que adivinar.

JUEGOS_RED.turnos = (() => {
  const MAZO_TABU = TABU.map(l => {
    const [palabra, resto] = l.split(':');
    return { palabra: palabra.trim(), prohibidas: resto.split(',').map(s => s.trim()) };
  });
  const CATS_MIMICA = ['acciones', 'peliculas', 'animales', 'profesiones', 'deportes', 'objetos', 'personajes'];
  const PUNTOS = { ok: 1, paso: 0, tabu: -1 };
  const ICONO = { ok: '✓', paso: '⏭', tabu: '✗' };
  let reloj = null, finLocal = 0, vista_ = '';

  const equipoDe = (e, id) => e.equipos.findIndex(g => g.includes(id));
  const presentes = (ctx, ids) => ids.filter(id => ctx.jugadores.some(j => j.id === id));

  function carta(e) {
    if (e.modo === 'tabu') return App.sacar('tabu', MAZO_TABU);
    const cat = e.cat === 'mezcla' ? CATS_MIMICA[Math.floor(Math.random() * CATS_MIMICA.length)] : e.cat;
    return { palabra: App.sacar('mim:' + cat, PALABRAS[cat].palabras), emoji: PALABRAS[cat].emoji, cat: PALABRAS[cat].nombre };
  }

  // El siguiente que explica en un equipo, salteando a los que no están conectados.
  function proximo(ctx, e, eq) {
    const g = e.equipos[eq];
    for (let k = 0; k < g.length; k++) {
      const id = g[(e.quien[eq] + k) % g.length];
      if (presentes(ctx, [id]).length) return { id, idx: (e.quien[eq] + k) % g.length };
    }
    return { id: g[e.quien[eq] % g.length], idx: e.quien[eq] % g.length };
  }

  // ---------- Anfitrión ----------
  function empezar(ctx, op) {
    ctx.memoria.op = op;
    const equipos = sortearEnEquipos(ctx.jugadores.map(j => j.id), op.n);
    const nombres = Object.fromEntries(ctx.jugadores.map(j => [j.id, j.nombre]));
    const e = { juego: 'turnos', modo: op.modo, cat: op.cat, dur: op.dur, vueltas: op.vueltas, equipos, nombres, puntos: equipos.map(() => 0), quien: equipos.map(() => 0), turnoNum: 0 };
    turno(ctx, e);
  }

  function turno(ctx, e) {
    const eq = e.turnoNum % e.equipos.length;
    const { id } = proximo(ctx, e, eq);
    ctx.publicar({ ...e, fase: 'turno', explica: id, carta: null, res: [] });
  }

  function accion(ctx, de, a) {
    const e = ctx.estado;
    if (!e || e.juego !== 'turnos') return;
    const host = de === ctx.yo;
    const eqTurno = e.turnoNum % e.equipos.length;
    if (a.tipo === 'empezar' && e.fase === 'turno' && (de === e.explica || host)) {
      ctx.memoria.fin = Date.now() + e.dur * 1000;
      ctx.publicar({ ...e, fase: 'jugando', carta: carta(e), res: [], restante: e.dur * 1000 });
    } else if (a.tipo === 'marca' && e.fase === 'jugando' && a.n === e.res.length) {
      const rival = equipoDe(e, de) !== eqTurno && equipoDe(e, de) >= 0;
      if (!(de === e.explica || (a.estado === 'tabu' && rival && e.modo === 'tabu'))) return;
      ctx.publicar({ ...e, res: [...e.res, { p: e.carta.palabra, estado: a.estado, de }], carta: carta(e) });
    } else if (a.tipo === 'tiempo' && host && e.fase === 'jugando') {
      ctx.memoria.fin = 0;
      ctx.publicar({ ...e, fase: 'resumen', carta: null });
    } else if (a.tipo === 'corregir' && e.fase === 'resumen' && (host || de === e.explica)) {
      const orden = e.modo === 'tabu' ? ['ok', 'paso', 'tabu'] : ['ok', 'paso'];
      const res = e.res.map((r, i) => i === a.i ? { ...r, estado: orden[(orden.indexOf(r.estado) + 1) % orden.length] } : r);
      ctx.publicar({ ...e, res });
    } else if (a.tipo === 'seguir' && host && e.fase === 'resumen') {
      const puntos = [...e.puntos];
      puntos[eqTurno] += e.res.reduce((s, r) => s + PUNTOS[r.estado], 0);
      const quien = [...e.quien];
      quien[eqTurno] = proximo(ctx, e, eqTurno).idx + 1;
      const sig = { ...e, puntos, quien, turnoNum: e.turnoNum + 1 };
      if (Math.floor(sig.turnoNum / e.equipos.length) >= e.vueltas) ctx.publicar({ ...sig, fase: 'final', res: [], carta: null });
      else turno(ctx, sig);
    } else if (a.tipo === 'otra' && host) empezar(ctx, ctx.memoria.op);
    else if (a.tipo === 'sala' && host) ctx.aLaSala();
  }

  // ---------- Pantallas ----------
  const C = Equipos.COLORES;
  function marcador(e, activo) {
    return `<div class="marcador">${e.equipos.map((g, k) => `
      <div class="marca ${C[k].clase} ${k === activo ? 'activo' : ''}"><small>${C[k].emoji} ${C[k].nombre}</small><b>${e.puntos[k]}</b></div>`).join('')}</div>`;
  }

  function tarjeta(e) {
    if (!e.carta) return '';
    if (e.modo === 'tabu') return `<div class="tarjeta"><b class="t-palabra">${App.esc(e.carta.palabra)}</b><small>No se puede decir</small>
      <ul class="prohibidas">${e.carta.prohibidas.map(x => `<li>${App.esc(x)}</li>`).join('')}</ul></div>`;
    return `<div class="tarjeta"><small>${e.carta.emoji} ${App.esc(e.carta.cat)}</small><b class="t-palabra">${App.esc(e.carta.palabra)}</b></div>`;
  }

  function vista(ctx) {
    const e = ctx.estado, N = id => App.esc(ctx.nombreDe(id));
    const eqTurno = e.turnoNum % e.equipos.length, miEq = equipoDe(e, ctx.yo);
    const soy = ctx.yo === e.explica ? 'explica' : miEq === eqTurno ? 'adivina' : 'rival';
    const titulo = e.modo === 'tabu' ? '🤐 Tabú' : '🙌 Mímica';
    const verbo = e.modo === 'tabu' ? 'explica' : 'actúa';
    const sumaTurno = (e.res || []).reduce((s, r) => s + PUNTOS[r.estado], 0);

    if (e.fase === 'turno') {
      return `<p class="tb-titulo-red">${titulo} · Vuelta ${Math.floor(e.turnoNum / e.equipos.length) + 1} de ${e.vueltas}</p>
        ${marcador(e, eqTurno)}
        ${miEq >= 0 ? `<p class="nota">Estás en ${C[miEq].emoji} ${C[miEq].nombre}: ${e.equipos[miEq].map(N).join(', ')}</p>` : ''}
        <div class="turno-de ${C[eqTurno].clase}"><small>Turno de</small><b>${C[eqTurno].emoji} ${C[eqTurno].nombre}</b><p>${verbo[0].toUpperCase() + verbo.slice(1)}: <strong>${N(e.explica)}</strong></p></div>
        ${soy === 'explica' ? `<p class="bajada">${e.modo === 'tabu' ? 'Vas a ver la palabra y las prohibidas. Tu equipo no las ve.' : 'Vas a ver la palabra: ¡actuala sin hablar!'}</p><button class="btn grande verde" id="empezar" data-sin>¡Empezar! · ${e.dur} s</button>`
          : `<p class="red-aviso">Esperando que ${N(e.explica)} arranque${ctx.esAnfitrion ? '' : ''}</p>${ctx.esAnfitrion ? `<button class="btn chico gris" id="empezar" data-sin>Arrancar por ${N(e.explica)}</button>` : ''}`}`;
    }

    if (e.fase === 'jugando') {
      const cab = `<div class="tt-cab"><span>${C[eqTurno].emoji} ${C[eqTurno].nombre}</span><span class="tt-letra tr-puntos">${sumaTurno}</span><span id="tt-reloj"></span></div>`;
      if (soy === 'explica') {
        return `${cab}<div class="p-carta tr-carta">${tarjeta(e)}</div>
          <div class="p-botones">
            ${e.modo === 'tabu' ? '<button class="btn rojo" data-marca="tabu" data-sin>¡Tabú!</button>' : ''}
            <button class="btn ${e.modo === 'tabu' ? 'gris' : 'naranja'}" data-marca="paso" data-sin>Paso</button>
            <button class="btn verde" data-marca="ok" data-sin>${e.modo === 'tabu' ? '¡Bien!' : '¡Adivinaron!'}</button>
          </div>`;
      }
      if (soy === 'rival') {
        return `${cab}<p class="bajada">${N(e.explica)} ${verbo}. ${e.modo === 'tabu' ? '¡Controlá que no diga ninguna prohibida!' : 'Mirá que no hable 😉'}</p>
          <div class="p-carta tr-carta">${tarjeta(e)}</div>
          ${e.modo === 'tabu' ? '<button class="btn grande rojo tr-tabu" data-marca="tabu" data-sin>✋ ¡TABÚ!</button>' : ''}`;
      }
      return `${cab}<div class="red-espera"><div class="globo">${e.modo === 'tabu' ? '🗣️' : '🙌'}</div>
        <h2>¡Adiviná!</h2><p>${N(e.explica)} ${verbo} para tu equipo</p>
        <p class="tr-ultimas">${(e.res || []).slice(-4).map(r => `<span class="${r.estado}">${ICONO[r.estado]} ${App.esc(r.p)}</span>`).join('')}</p></div>`;
    }

    if (e.fase === 'resumen') {
      const corrige = ctx.esAnfitrion || ctx.yo === e.explica;
      return `<div class="puntaje"><div class="gran-num" style="color:var(--amarillo)">${sumaTurno}</div><p>${Math.abs(sumaTurno) === 1 ? 'punto' : 'puntos'} para ${C[eqTurno].emoji} ${C[eqTurno].nombre}</p>
        ${corrige ? '<p class="frase">Tocá una carta para corregirla</p>' : ''}</div>
        <ul class="lista-res">${e.res.length ? e.res.map((r, i) => `<li class="${r.estado === 'ok' ? 'ok' : r.estado === 'tabu' ? 'tabu' : 'no'}" data-i="${i}"><span>${ICONO[r.estado]}</span>${App.esc(r.p)}</li>`).join('') : '<li class="vacio">No salió ninguna carta.</li>'}</ul>
        ${ctx.esAnfitrion ? '<div class="acciones"><button class="btn grande verde" id="seguir">Sumar y seguir</button></div>' : '<p class="red-aviso">El anfitrión suma y sigue</p>'}`;
    }

    const orden = e.equipos.map((g, k) => k).sort((a, b) => e.puntos[b] - e.puntos[a]);
    const empate = orden.length > 1 && e.puntos[orden[0]] === e.puntos[orden[1]];
    return `<div class="copa">🏆</div><h2 class="centro tt-ganador">${empate ? '¡Empate!' : `¡Ganaron los ${C[orden[0]].nombre}!`}</h2>
      <ol class="podio">${orden.map((k, i) => `<li class="${C[k].clase}"><span>${['🥇', '🥈', '🥉', '4°'][i]}</span><b>${C[k].emoji} ${C[k].nombre}<small class="tr-miembros">${e.equipos[k].map(N).join(', ')}</small></b><strong>${e.puntos[k]}</strong></li>`).join('')}</ol>
      ${ctx.esAnfitrion ? '<div class="acciones"><button class="btn grande verde" id="otra">Revancha (equipos nuevos)</button><button class="btn violeta" id="sala">Volver a la sala</button></div>' : ''}`;
  }

  function enlazar(el, ctx) {
    const e = ctx.estado;
    const clave = `${e.fase}:${e.turnoNum}`;
    const nueva = clave !== vista_;
    vista_ = clave;
    clearInterval(reloj);
    const ultimo = (e.res || [])[e.res ? e.res.length - 1 : 0];
    if (e.fase === 'jugando') {
      if (nueva) { finLocal = Date.now() + (e.restante || e.dur * 1000); Sonido.ya(); }
      else if (ultimo && el.dataset.visto !== String(e.res.length)) {
        ({ ok: Sonido.acierto, paso: Sonido.paso, tabu: Sonido.error })[ultimo.estado]();
        if (ultimo.estado === 'tabu') App.vibrar([60, 40, 60]);
      }
      el.dataset.visto = String(e.res.length);
      const elReloj = el.querySelector('#tt-reloj');
      const tic = () => {
        if (!el.isConnected) { clearInterval(reloj); return; }
        const s = Math.max(0, Math.ceil((finLocal - Date.now()) / 1000));
        elReloj.textContent = `⏱ ${s}`;
        elReloj.classList.toggle('apurado', s <= 10);
        if (s <= 10 && s > 0) Sonido.tic();
        if (ctx.esAnfitrion && ctx.memoria.fin && Date.now() > ctx.memoria.fin) { ctx.memoria.fin = 0; ctx.accion({ tipo: 'tiempo' }); }
      };
      tic();
      reloj = setInterval(tic, 1000);
      el.querySelectorAll('[data-marca]').forEach(b => {
        b.onclick = () => { b.disabled = true; ctx.accion({ tipo: 'marca', estado: b.dataset.marca, n: e.res.length }); };
      });
    } else if (nueva) {
      if (e.fase === 'resumen') Sonido.fin();
      if (e.fase === 'turno') Sonido.revelar();
      if (e.fase === 'final') {
        const k = e.equipos.map((g, i) => i).sort((a, b) => e.puntos[b] - e.puntos[a])[0];
        if (e.equipos[k].includes(ctx.yo)) { Sonido.ganar(); App.confeti(150); } else Sonido.revelar();
      }
    }
    el.querySelectorAll('.lista-res [data-i]').forEach(li => {
      if (ctx.esAnfitrion || ctx.yo === e.explica) li.onclick = () => ctx.accion({ tipo: 'corregir', i: +li.dataset.i });
    });
    const on = (id, f) => { const b = el.querySelector(id); if (b) b.onclick = f; };
    on('#empezar', () => { Sonido.desbloquear(); ctx.accion({ tipo: 'empezar' }); });
    on('#seguir', () => ctx.accion({ tipo: 'seguir' }));
    on('#otra', () => ctx.accion({ tipo: 'otra' }));
    on('#sala', () => ctx.accion({ tipo: 'sala' }));
  }

  return {
    id: 'turnos', nombre: 'Tabú o Mímica', emoji: '🤐', color: 'violeta', minimo: 4,
    bajada: 'Por equipos: el que explica ve la carta en su celu',
    opciones: () => {
      const pref = App.leer('turnos-red:pref', { modo: 'tabu', n: 2, dur: 60, vueltas: 3, cat: 'mezcla' });
      return `
        <div class="chips" id="tu-modo"><button class="chip ${pref.modo === 'tabu' ? 'on' : ''}" data-v="tabu">🤐 Tabú</button><button class="chip ${pref.modo === 'mimica' ? 'on' : ''}" data-v="mimica">🙌 Mímica</button></div>
        <div class="opcion"><span>Equipos</span><div class="segmentos" id="tu-n">${[2, 3, 4].map(n => `<button data-v="${n}" class="${n === pref.n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="opcion"><span>Tiempo</span><div class="segmentos" id="tu-dur">${[45, 60, 90].map(n => `<button data-v="${n}" class="${n === pref.dur ? 'on' : ''}">${n} s</button>`).join('')}</div></div>
        <div class="opcion"><span>Vueltas</span><div class="segmentos" id="tu-vue">${[2, 3, 4].map(n => `<button data-v="${n}" class="${n === pref.vueltas ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <p class="bajada">Categoría (para Mímica)</p>
        <div class="chips" id="tu-cat">${['mezcla', ...CATS_MIMICA].map(k => `<button class="chip ${k === pref.cat ? 'on' : ''}" data-v="${k}">${k === 'mezcla' ? '🎲 Mezcla' : PALABRAS[k].emoji + ' ' + PALABRAS[k].nombre}</button>`).join('')}</div>
        <p class="nota">Los equipos se sortean con los de la sala.</p>`;
    },
    leerOpciones: el => {
      const v = id => el.querySelector(`#${id} .on`).dataset.v;
      const op = { modo: v('tu-modo'), n: +v('tu-n'), dur: +v('tu-dur'), vueltas: +v('tu-vue'), cat: v('tu-cat') };
      App.guardar('turnos-red:pref', op);
      return op;
    },
    empezar, accion, vista, enlazar,
  };
})();
