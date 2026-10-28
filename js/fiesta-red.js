// ¿Quién soy? y La Bomba en red.

// ---------- ¿Quién soy?: el que adivina no ve la palabra; los demás la ven en su celu y dan pistas ----------
JUEGOS_RED.quien = (() => {
  const CATS = ['famosos', 'peliculas', 'animales', 'objetos', 'futbolistas', 'personajes'];
  let reloj = null, finLocal = 0, visto = '';

  function empezar(ctx, op) {
    ctx.memoria.op = op;
    const orden = App.mezclar(ctx.jugadores.map(j => j.id));
    const nombres = Object.fromEntries(ctx.jugadores.map(j => [j.id, j.nombre]));
    ctx.publicar({ juego: 'quien', cat: op.cat, dur: op.dur, vueltas: op.vueltas, orden, nombres, turno: 0, puntos: Object.fromEntries(orden.map(id => [id, 0])), fase: 'turno', res: [] });
  }

  const adivina = e => e.orden[e.turno % e.orden.length];
  const palabra = e => App.sacar('qs:' + e.cat, PALABRAS[e.cat].palabras);

  function accion(ctx, de, a) {
    const e = ctx.estado;
    if (!e || e.juego !== 'quien') return;
    const host = de === ctx.yo;
    if (a.tipo === 'empezar' && e.fase === 'turno' && (de === adivina(e) || host)) {
      ctx.memoria.fin = Date.now() + e.dur * 1000;
      ctx.publicar({ ...e, fase: 'jugando', palabra: palabra(e), res: [], restante: e.dur * 1000 });
    } else if (a.tipo === 'marca' && e.fase === 'jugando' && a.n === e.res.length) {
      // Aciertos los marcan los que dan pistas; pasar puede cualquiera.
      if (a.ok && de === adivina(e)) return;
      ctx.publicar({ ...e, res: [...e.res, { p: e.palabra, ok: !!a.ok }], palabra: palabra(e) });
    } else if (a.tipo === 'tiempo' && e.fase === 'jugando') {
      if (ctx.memoria.fin && Date.now() < ctx.memoria.fin - 8000) return;
      ctx.memoria.fin = 0;
      const puntos = { ...e.puntos, [adivina(e)]: (e.puntos[adivina(e)] || 0) + e.res.filter(r => r.ok).length };
      ctx.publicar({ ...e, fase: 'resumen', palabra: null, puntos });
    } else if (a.tipo === 'seguir' && host && e.fase === 'resumen') {
      const turno = e.turno + 1;
      ctx.publicar({ ...e, turno, fase: turno >= e.orden.length * e.vueltas ? 'final' : 'turno', res: [] });
    } else if (a.tipo === 'otra' && host) empezar(ctx, ctx.memoria.op);
    else if (a.tipo === 'sala' && host) ctx.aLaSala();
  }

  function vista(ctx) {
    const e = ctx.estado, N = id => App.esc(ctx.nombreDe(id));
    const quien = adivina(e), soy = ctx.yo === quien;
    const cat = PALABRAS[e.cat];
    if (e.fase === 'turno') {
      return `<p class="tb-titulo-red">🤔 ¿Quién soy? · ${cat.emoji} ${cat.nombre}</p>
        <div class="turno-de amarillo"><small>Le toca adivinar a</small><b>${N(quien)}</b><p>Turno ${e.turno + 1} de ${e.orden.length * e.vueltas}</p></div>
        ${soy ? `<p class="bajada">No vas a ver la palabra: los demás te dan pistas. Si te pinta, ponete el celu en la frente 😄</p><button class="btn grande verde" id="empezar" data-sin>¡Empezar! · ${e.dur} s</button>`
          : `<p class="red-aviso">Vos vas a ver la palabra y dar pistas (¡sin decirla!)</p>${ctx.esAnfitrion ? `<button class="btn chico gris" id="empezar" data-sin>Arrancar por ${N(quien)}</button>` : ''}`}`;
    }
    if (e.fase === 'jugando') {
      const aciertos = e.res.filter(r => r.ok).length;
      const cab = `<div class="tt-cab"><span>${N(quien)}</span><span class="tt-letra tr-puntos">${aciertos}</span><span id="tt-reloj"></span></div>`;
      if (soy) return `${cab}<div class="red-espera"><div class="ilus-grande">🤔</div><h2>¿Quién soy?</h2><p>Escuchá las pistas y decí tu respuesta en voz alta</p></div>
        <div class="p-botones"><button class="btn naranja" data-marca="paso" data-sin>Paso</button></div>`;
      return `${cab}<div class="qs-palabra-red"><small>${cat.emoji} ${cat.nombre}</small><b>${App.esc(e.palabra)}</b></div>
        <p class="bajada">Dale pistas a ${N(quien)}. Cuando la adivine, tocá ¡Acertó!</p>
        <div class="p-botones"><button class="btn naranja" data-marca="paso" data-sin>Pasó</button><button class="btn verde" data-marca="ok" data-sin>¡Acertó!</button></div>`;
    }
    if (e.fase === 'resumen') {
      const ok = e.res.filter(r => r.ok).length;
      return `<div class="puntaje"><div class="gran-num" style="color:var(--amarillo)">${ok}</div><p>${ok === 1 ? 'acierto' : 'aciertos'} de ${N(quien)}</p></div>
        <ul class="lista-res">${e.res.map(r => `<li class="${r.ok ? 'ok' : 'no'}"><span>${r.ok ? '✓' : '✗'}</span>${App.esc(r.p)}</li>`).join('') || '<li class="vacio">No salió ninguna palabra.</li>'}</ul>
        ${ctx.esAnfitrion ? '<div class="acciones"><button class="btn grande verde" id="seguir">Siguiente</button></div>' : '<p class="red-aviso">El anfitrión pasa al siguiente</p>'}`;
    }
    const orden = [...e.orden].sort((a, b) => e.puntos[b] - e.puntos[a]);
    return `<div class="copa">🏆</div><h2 class="centro tt-ganador">¡Ganó ${N(orden[0])}!</h2>
      <ol class="podio">${orden.map((id, k) => `<li class="${['amarillo', 'celeste', 'naranja'][k] || 'violeta'}"><span>${['🥇', '🥈', '🥉'][k] || k + 1 + '°'}</span><b>${N(id)}${id === ctx.yo ? ' (vos)' : ''}</b><strong>${e.puntos[id]}</strong></li>`).join('')}</ol>
      ${ctx.esAnfitrion ? '<div class="acciones"><button class="btn grande verde" id="otra">Otra partida</button><button class="btn violeta" id="sala">Volver a la sala</button></div>' : ''}`;
  }

  function enlazar(el, ctx) {
    const e = ctx.estado;
    const clave = `${e.fase}:${e.turno}`;
    const nueva = clave !== visto;
    visto = clave;
    clearInterval(reloj);
    if (e.fase === 'jugando') {
      if (nueva) { finLocal = Date.now() + (e.restante || e.dur * 1000); Sonido.ya(); }
      else if (e.res.length && el.dataset.visto !== String(e.res.length)) { e.res[e.res.length - 1].ok ? Sonido.acierto() : Sonido.paso(); App.vibrar(50); }
      el.dataset.visto = String(e.res.length);
      const elReloj = el.querySelector('#tt-reloj');
      let avisado = 0;
      const tic = () => {
        if (!el.isConnected) { clearInterval(reloj); return; }
        const s = Math.max(0, Math.ceil((finLocal - Date.now()) / 1000));
        elReloj.textContent = `⏱ ${s}`;
        elReloj.classList.toggle('apurado', s <= 10);
        if (s <= 10 && s > 0) Sonido.tic();
        if (Date.now() > finLocal + (ctx.esAnfitrion ? 0 : 2000) && Date.now() - avisado > 4000) { avisado = Date.now(); ctx.accion({ tipo: 'tiempo' }); }
      };
      tic();
      reloj = setInterval(tic, 1000);
      el.querySelectorAll('[data-marca]').forEach(b => { b.onclick = () => { b.disabled = true; ctx.accion({ tipo: 'marca', ok: b.dataset.marca === 'ok', n: e.res.length }); }; });
    } else if (nueva) {
      if (e.fase === 'resumen') Sonido.fin();
      if (e.fase === 'turno') Sonido.revelar();
      if (e.fase === 'final') {
        const top = [...e.orden].sort((a, b) => e.puntos[b] - e.puntos[a])[0];
        if (top === ctx.yo) { Sonido.ganar(); App.confeti(150); } else Sonido.revelar();
      }
    }
    const on = (id, f) => { const b = el.querySelector(id); if (b) b.onclick = f; };
    on('#empezar', () => { Sonido.desbloquear(); ctx.accion({ tipo: 'empezar' }); });
    on('#seguir', () => ctx.accion({ tipo: 'seguir' }));
    on('#otra', () => ctx.accion({ tipo: 'otra' }));
    on('#sala', () => ctx.accion({ tipo: 'sala' }));
  }

  return {
    id: 'quien', nombre: '¿Quién soy?', emoji: '🤔', color: 'amarillo', minimo: 2,
    bajada: 'Uno adivina; los demás ven la palabra en su celu',
    opciones: () => {
      const pref = App.leer('quien-red:pref', { cat: 'famosos', dur: 60, vueltas: 1 });
      return `<div class="chips" id="qr-cat">${CATS.map(k => `<button class="chip ${k === pref.cat ? 'on' : ''}" data-v="${k}">${PALABRAS[k].emoji} ${PALABRAS[k].nombre}</button>`).join('')}</div>
        <div class="opcion"><span>Tiempo</span><div class="segmentos" id="qr-dur">${[30, 60, 90].map(n => `<button data-v="${n}" class="${n === pref.dur ? 'on' : ''}">${n} s</button>`).join('')}</div></div>
        <div class="opcion"><span>Vueltas</span><div class="segmentos" id="qr-vue">${[1, 2, 3].map(n => `<button data-v="${n}" class="${n === pref.vueltas ? 'on' : ''}">${n}</button>`).join('')}</div></div>`;
    },
    leerOpciones: el => {
      const v = id => el.querySelector(`#${id} .on`).dataset.v;
      const op = { cat: v('qr-cat'), dur: +v('qr-dur'), vueltas: +v('qr-vue') };
      App.guardar('quien-red:pref', op);
      return op;
    },
    empezar, accion, vista, enlazar,
  };
})();

// ---------- La Bomba: la bomba viaja de celu en celu; explota en manos de alguien ----------
JUEGOS_RED.bomba = (() => {
  const MECHAS = { corta: [10, 25], normal: [20, 45], larga: [35, 70] };
  let tic = null, visto = '', avisoReloj = 0, inicioRonda = 0;

  function ronda(ctx, base) {
    const [a, b] = MECHAS[base.mecha];
    const dura = (a + Math.random() * (b - a)) * 1000;
    ctx.memoria.fin = Date.now() + dura;
    const vivos = base.orden.filter(id => ctx.jugadores.some(j => j.id === id));
    ctx.publicar({ ...base, fase: 'jugando', consigna: App.sacar('bomba', BOMBA), tiene: vivos[Math.floor(Math.random() * vivos.length)] || base.orden[0], pases: 0, ronda: (base.ronda || 0) + 1, maximo: b * 1000 });
  }

  function empezar(ctx, op) {
    ctx.memoria.op = op;
    const orden = ctx.jugadores.map(j => j.id);
    const nombres = Object.fromEntries(ctx.jugadores.map(j => [j.id, j.nombre]));
    ronda(ctx, { juego: 'bomba', mecha: op.mecha, orden, nombres, perdidas: Object.fromEntries(orden.map(id => [id, 0])), ronda: 0 });
  }

  // Le pasa la bomba al siguiente conectado de la ronda.
  function siguiente(ctx, e) {
    const k = e.orden.indexOf(e.tiene);
    for (let d = 1; d <= e.orden.length; d++) {
      const id = e.orden[(k + d) % e.orden.length];
      if (ctx.jugadores.some(j => j.id === id)) return id;
    }
    return e.tiene;
  }

  function explotar(ctx) {
    const e = ctx.estado;
    if (e.fase !== 'jugando') return;
    ctx.memoria.fin = 0;
    ctx.publicar({ ...e, fase: 'boom', perdio: e.tiene, perdidas: { ...e.perdidas, [e.tiene]: (e.perdidas[e.tiene] || 0) + 1 } });
  }

  function accion(ctx, de, a) {
    const e = ctx.estado;
    if (!e || e.juego !== 'bomba') return;
    const host = de === ctx.yo;
    if (a.tipo === 'pasar' && e.fase === 'jugando' && de === e.tiene && a.n === e.pases) {
      if (ctx.memoria.fin && Date.now() > ctx.memoria.fin) return explotar(ctx);
      ctx.publicar({ ...e, tiene: siguiente(ctx, e), pases: e.pases + 1 });
    } else if (a.tipo === 'consigna' && e.fase === 'jugando' && (de === e.tiene || host)) {
      ctx.publicar({ ...e, consigna: App.sacar('bomba', BOMBA) });
    } else if (a.tipo === 'reloj' && e.fase === 'jugando') {
      // Explota cuando se cumple la mecha. Si el anfitrión cambió y no sabe cuándo era, explota igual.
      if (!ctx.memoria.fin || Date.now() > ctx.memoria.fin) explotar(ctx);
    } else if (a.tipo === 'otra' && host) ronda(ctx, e);
    else if (a.tipo === 'sala' && host) ctx.aLaSala();
  }

  function vista(ctx) {
    const e = ctx.estado, N = id => App.esc(ctx.nombreDe(id));
    if (e.fase === 'jugando') {
      const la = e.tiene === ctx.yo;
      return `<div class="bomba-red ${la ? 'la-tengo' : ''}">
        <small>Consigna</small><b class="consigna">${App.esc(e.consigna)}</b>
        <div class="bomba-emo latiendo" id="bomba">💣</div>
        ${la ? '<h2>¡La tenés vos!</h2><p>Decí algo de la consigna y pasala</p><button class="btn grande rojo" id="pasar" data-sin>¡Pasar! 💣➡️</button><button class="btn chico gris" id="consigna">Cambiar consigna</button>'
          : `<h2>La tiene ${N(e.tiene)}</h2><p>Preparate: después te puede llegar a vos</p>`}
        <p class="nota">${e.orden.map(id => `${id === e.tiene ? '💣' : '·'} ${N(id)}`).join('  ')}</p>
      </div>`;
    }
    const orden = [...e.orden].sort((a, b) => e.perdidas[a] - e.perdidas[b]);
    return `<div class="bomba-boom-red">
        <div class="boom">💥</div><h2>¡BUM!</h2><p>Explotó en manos de <b>${N(e.perdio)}</b>${e.perdio === ctx.yo ? ' (¡vos!)' : ''}</p>
      </div>
      <h2 class="titulito">Bombas que les explotaron</h2>
      <ol class="podio">${orden.map(id => `<li class="${e.perdidas[id] ? 'naranja' : 'verde'}"><span>${e.perdidas[id] ? '💥' : '😎'}</span><b>${N(id)}</b><strong>${e.perdidas[id]}</strong></li>`).join('')}</ol>
      ${ctx.esAnfitrion ? '<div class="acciones"><button class="btn grande rojo" id="otra" data-sin>🔥 Otra ronda</button><button class="btn violeta" id="sala">Volver a la sala</button></div>' : '<p class="red-aviso">El anfitrión enciende la próxima</p>'}`;
  }

  function enlazar(el, ctx) {
    const e = ctx.estado;
    const clave = `${e.fase}:${e.ronda}`;
    clearInterval(tic);
    if (e.fase === 'jugando') {
      if (clave !== visto) { Sonido.fosforo(); inicioRonda = Date.now(); }
      if (e.tiene === ctx.yo && el.dataset.tenia !== String(e.pases)) { App.vibrar([60, 40, 60]); Sonido.toque(); }
      el.dataset.tenia = String(e.pases);
      const b = el.querySelector('#bomba');
      let k = 0;
      // Tic-tac en todos los celus; el anfitrión además controla cuándo explota.
      tic = setInterval(() => {
        if (!el.isConnected) { clearInterval(tic); return; }
        Sonido.tictac(Math.min(1, k++ / 120));
        b.classList.remove('tic'); void b.offsetWidth; b.classList.add('tic');
        const toca = ctx.esAnfitrion ? (ctx.memoria.fin && Date.now() > ctx.memoria.fin) : Date.now() - inicioRonda > (e.maximo || 70000) + 5000;
        if (toca && Date.now() - avisoReloj > 1500) { avisoReloj = Date.now(); ctx.accion({ tipo: 'reloj' }); }
      }, 450);
    } else if (clave !== visto) {
      Sonido.boom();
      App.vibrar(e.perdio === ctx.yo ? [400, 100, 400] : 150);
    }
    visto = clave;
    const on = (id, f) => { const x = el.querySelector(id); if (x) x.onclick = f; };
    on('#pasar', () => { el.querySelector('#pasar').disabled = true; Sonido.carta(); ctx.accion({ tipo: 'pasar', n: e.pases }); });
    on('#consigna', () => ctx.accion({ tipo: 'consigna' }));
    on('#otra', () => { Sonido.desbloquear(); ctx.accion({ tipo: 'otra' }); });
    on('#sala', () => ctx.accion({ tipo: 'sala' }));
  }

  return {
    id: 'bomba', nombre: 'La Bomba', emoji: '💣', color: 'rojo', minimo: 2,
    bajada: 'La bomba viaja de celu en celu hasta que explota',
    opciones: () => {
      const m = App.leer('bomba:mecha', 'normal');
      return `<div class="opcion"><span>Mecha</span><div class="segmentos" id="bo-m">${[['corta', 'Corta'], ['normal', 'Normal'], ['larga', 'Larga']].map(([v, t]) => `<button data-v="${v}" class="${v === m ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <p class="nota">Cuando te llega la bomba, decí algo de la consigna y tocá "Pasar". Nadie sabe cuándo explota.</p>`;
    },
    leerOpciones: el => ({ mecha: el.querySelector('#bo-m .on').dataset.v }),
    empezar, accion, vista, enlazar,
  };
})();
