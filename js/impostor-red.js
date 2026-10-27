// El Impostor en red: cada uno ve su carta en su celu y vota desde el suyo.

JUEGOS_RED.impostor = (() => {
  const CATS = ['mezcla', 'lugares', 'comidas', 'animales', 'objetos', 'profesiones', 'deportes', 'famosos', 'peliculas'];
  const nombreCat = k => k === 'mezcla' ? 'Mezcla' : PALABRAS[k].nombre;
  const emojiCat = k => k === 'mezcla' ? '🎲' : PALABRAS[k].emoji;
  let vista = false; // si la carta está dada vuelta en este celu

  const presentes = ctx => ctx.estado.ronda.filter(id => ctx.jugadores.some(j => j.id === id));

  function empezar(ctx, op) {
    const ronda = App.mezclar(ctx.jugadores.map(j => j.id));
    const cat = op.cat === 'mezcla' ? CATS[1 + Math.floor(Math.random() * (CATS.length - 1))] : op.cat;
    const palabra = App.sacar('imp:' + cat, PALABRAS[cat].palabras);
    const impostor = ronda[Math.floor(Math.random() * ronda.length)];
    Object.assign(ctx.memoria, { op, impostor, palabra, cat });
    ronda.forEach(id => ctx.secreto(id, id === impostor
      ? { impostor: true, cat: op.pista ? nombreCat(cat) : null }
      : { impostor: false, palabra, cat: `${emojiCat(cat)} ${nombreCat(cat)}` }));
    const nombres = Object.fromEntries(ctx.jugadores.map(j => [j.id, j.nombre]));
    ctx.publicar({ juego: 'impostor', fase: 'cartas', ronda, nombres, listos: [], empieza: ronda[Math.floor(Math.random() * ronda.length)], votaron: [] });
  }

  // Lo que mandan los jugadores al anfitrión.
  function accion(ctx, de, a) {
    const e = ctx.estado;
    if (!e || e.juego !== 'impostor' || !e.ronda.includes(de)) return;
    if (a.tipo === 'listo' && e.fase === 'cartas' && !e.listos.includes(de)) {
      ctx.publicar({ ...e, listos: [...e.listos, de] });
      revisar(ctx);
    } else if (a.tipo === 'votar' && e.fase === 'debate' && ctx.esAnfitrion && de === ctx.yo) {
      ctx.memoria.votos = {};
      ctx.publicar({ ...e, fase: 'votacion', votaron: [] });
    } else if (a.tipo === 'voto' && e.fase === 'votacion' && e.ronda.includes(a.a) && a.a !== de) {
      ctx.memoria.votos = { ...(ctx.memoria.votos || {}), [de]: a.a };
      ctx.publicar({ ...e, votaron: Object.keys(ctx.memoria.votos) });
      revisar(ctx);
    } else if (a.tipo === 'cerrar' && de === ctx.yo && e.fase === 'votacion') resolver(ctx);
    else if (a.tipo === 'otra' && de === ctx.yo) empezar(ctx, ctx.memoria.op);
    else if (a.tipo === 'sala' && de === ctx.yo) ctx.aLaSala();
  }

  // Si ya están todos los que siguen conectados, se avanza.
  function revisar(ctx) {
    const e = ctx.estado, hay = presentes(ctx);
    if (e.fase === 'cartas' && hay.every(id => e.listos.includes(id))) ctx.publicar({ ...e, fase: 'debate' });
    if (e.fase === 'votacion' && hay.every(id => e.votaron.includes(id))) resolver(ctx);
  }

  function resolver(ctx) {
    const votos = ctx.memoria.votos || {};
    const cuenta = {};
    Object.values(votos).forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; });
    const max = Math.max(0, ...Object.values(cuenta));
    const top = Object.keys(cuenta).filter(id => cuenta[id] === max);
    const eliminado = top.length === 1 ? top[0] : null;
    ctx.publicar({
      ...ctx.estado, fase: 'resultado', votos, eliminado,
      impostor: ctx.memoria.impostor, palabra: ctx.memoria.palabra,
      gana: eliminado === ctx.memoria.impostor ? 'grupo' : 'impostor',
    });
  }

  function carta(ctx) {
    const pr = ctx.privado;
    if (!pr) return '<div class="red-espera"><div class="puntitos"><i></i><i></i><i></i></div><p>Repartiendo…</p></div>';
    const frente = pr.impostor
      ? `<span class="emo">🤫</span><b class="impostor">Sos el impostor</b><small>${pr.cat ? 'Categoría: ' + App.esc(pr.cat) : '¡Que no te descubran!'}</small>`
      : `<small>La palabra es</small><b class="palabra">${App.esc(pr.palabra)}</b><small>${App.esc(pr.cat)}</small>`;
    return `<div class="carta ${vista ? 'volteada' : ''}" id="carta">
      <div class="carta-in">
        <div class="cara dorso"><span class="emo">🕵️</span><b>Tocá para ver tu carta</b><small>Tapala para que nadie la vea</small></div>
        <div class="cara frente">${frente}</div>
      </div></div>`;
  }

  function vistaHTML(ctx) {
    const e = ctx.estado, N = id => App.esc(ctx.nombreDe(id));
    const host = ctx.esAnfitrion;
    if (e.fase === 'cartas') {
      const listo = e.listos.includes(ctx.yo);
      return `
        <p class="bajada">Mirá tu carta sin que nadie vea</p>
        ${carta(ctx)}
        ${listo ? `<p class="red-aviso">✓ Listo. Esperando a los demás (${e.listos.length}/${e.ronda.length})</p>`
          : `<button class="btn grande violeta" id="listo">¡Listo, ya la vi!</button>`}
        <p class="nota">${e.ronda.map(id => `${e.listos.includes(id) ? '✅' : '⏳'} ${N(id)}`).join(' · ')}</p>`;
    }
    if (e.fase === 'debate') {
      return `
        <div class="globo">🗣️</div>
        <h2 class="centro">¡A jugar!</h2>
        <p class="empieza centro">Empieza <b>${N(e.empieza)}</b><br><small>y sigue el de su izquierda</small></p>
        <ol class="pasos">
          <li><span>Cada uno dice <b>una palabra</b> relacionada con la suya.</span></li>
          <li><span>Pueden dar una o dos vueltas.</span></li>
          <li><span>Cuando estén listos, se vota desde cada celu.</span></li>
        </ol>
        ${carta(ctx)}
        ${host ? '<button class="btn grande rosa" id="votar">¡A votar!</button>' : `<p class="red-aviso">Cuando terminen de hablar, ${N(ctx.anfitrion)} abre la votación</p>`}`;
    }
    if (e.fase === 'votacion') {
      const yaVote = e.votaron.includes(ctx.yo);
      return `
        <h2 class="centro">¿Quién es el impostor?</h2>
        ${yaVote ? `<p class="red-aviso">✓ Ya votaste. Faltan ${e.ronda.length - e.votaron.length}…</p>`
          : `<p class="bajada">Tocá a quién votás (es secreto hasta el final)</p>
             <div class="votos">${e.ronda.filter(id => id !== ctx.yo).map(id => `<button class="btn voto" data-voto="${id}"><span class="avatar">${N(id).slice(0, 1).toUpperCase()}</span>${N(id)}</button>`).join('')}</div>`}
        <p class="nota">${e.ronda.map(id => `${e.votaron.includes(id) ? '✅' : '⏳'} ${N(id)}`).join(' · ')}</p>
        ${host ? '<button class="btn chico gris" id="cerrar">Cerrar votación ya</button>' : ''}`;
    }
    // resultado
    const bien = e.gana === 'grupo';
    const yoImp = e.impostor === ctx.yo;
    const gane = yoImp ? !bien : bien;
    return `
      <div class="imp-resultado ${bien ? 'bien' : 'mal'}">
        <div class="veredicto">
          <span class="emo">${bien ? '🎉' : '😈'}</span>
          <h2>${e.eliminado ? (bien ? '¡Lo agarraron!' : '¡Era inocente!') : '¡Empate!'}</h2>
          <p>${e.eliminado ? `Votaron a <b>${N(e.eliminado)}</b>. ` : 'Nadie quedó eliminado. '}El impostor era <b>${N(e.impostor)}</b>.</p>
          <p class="ultima">${gane ? '¡Ganaste! 🏆' : 'Perdiste esta 😅'}${bien ? ` · Si ${N(e.impostor)} adivina la palabra, gana igual.` : ''}</p>
        </div>
        <div class="palabra-final"><small>La palabra era</small><b>${App.esc(e.palabra)}</b></div>
        <ul class="red-votos">${Object.entries(e.votos || {}).map(([a, b]) => `<li>${N(a)} → <b>${N(b)}</b></li>`).join('')}</ul>
      </div>
      ${host ? `<div class="acciones"><button class="btn grande verde" id="otra">Otra ronda</button><button class="btn violeta" id="sala">Volver a la sala</button></div>`
        : '<p class="red-aviso">El anfitrión elige si juegan otra</p>'}`;
  }

  let ultimaFase = '';
  function enlazar(el, ctx) {
    const e = ctx.estado;
    const fase = e.fase + ':' + e.ronda.join(',') + ':' + (e.empieza || '');
    if (fase !== ultimaFase) {
      // Sonidos al cambiar de fase.
      if (e.fase === 'cartas') { vista = false; Sonido.carta(); }
      if (e.fase === 'debate' || e.fase === 'votacion') { vista = false; Sonido.revelar(); }
      if (e.fase === 'resultado') {
        Sonido.redoble();
        const gane = (e.impostor === ctx.yo) === (e.gana !== 'grupo');
        setTimeout(() => { if (gane) { Sonido.ganar(); App.confeti(120); } else Sonido.error(); }, 1600);
      }
      ultimaFase = fase;
    }
    const c = el.querySelector('#carta');
    if (c) c.onclick = () => { vista = !vista; c.classList.toggle('volteada', vista); Sonido.carta(); };
    const on = (id, f) => { const b = el.querySelector(id); if (b) b.onclick = f; };
    on('#listo', () => { vista = false; ctx.accion({ tipo: 'listo' }); });
    on('#votar', () => ctx.accion({ tipo: 'votar' }));
    on('#cerrar', async () => { if (await App.preguntar('¿Cerrar la votación con los votos que hay?', 'Cerrar', 'Esperar')) ctx.accion({ tipo: 'cerrar' }); });
    on('#otra', () => ctx.accion({ tipo: 'otra' }));
    on('#sala', () => ctx.accion({ tipo: 'sala' }));
    el.querySelectorAll('[data-voto]').forEach(b => {
      b.onclick = async () => {
        if (await App.preguntar(`¿Votás a ${ctx.nombreDe(b.dataset.voto)}?`, 'Sí, votar', 'No')) ctx.accion({ tipo: 'voto', a: b.dataset.voto });
      };
    });
  }

  return {
    id: 'impostor', nombre: 'El Impostor', emoji: '🕵️', color: 'rosa', minimo: 3,
    bajada: 'Cada uno ve su carta en su celu',
    opciones: () => {
      const cat = App.leer('impostor:cat', 'mezcla');
      return `<p class="bajada">Categoría</p>
        <div class="chips">${CATS.map(k => `<button class="chip ${k === cat ? 'on' : ''}" data-k="${k}">${emojiCat(k)} ${nombreCat(k)}</button>`).join('')}</div>
        <label class="interruptor"><input type="checkbox" id="pista" ${App.leer('impostor:pista', true) ? 'checked' : ''}><span class="perilla"></span><span>El impostor sabe la categoría</span></label>`;
    },
    leerOpciones: el => {
      const op = { cat: el.querySelector('.chip.on').dataset.k, pista: el.querySelector('#pista').checked };
      App.guardar('impostor:cat', op.cat);
      App.guardar('impostor:pista', op.pista);
      return op;
    },
    empezar, accion, vista: vistaHTML, enlazar,
    presencia: ctx => { if (ctx.esAnfitrion && ctx.estado) revisar(ctx); },
  };
})();
