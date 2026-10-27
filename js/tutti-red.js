// Tutti frutti en red: misma letra para todos, cada uno escribe en su celu y la app pone los puntos.

JUEGOS_RED.tutti = (() => {
  const CATEGORIAS = [
    'Nombre', 'Apellido', 'Animal', 'Color', 'Fruta o verdura', 'País o ciudad', 'Cosa', 'Comida', 'Marca',
    'Famoso/a', 'Profesión', 'Equipo de fútbol', 'Película o serie', 'Parte del cuerpo', 'Ropa', 'Deporte', 'Bebida', 'Flor o planta',
  ];
  const DEFECTO = ['Nombre', 'Animal', 'Color', 'Fruta o verdura', 'País o ciudad', 'Cosa', 'Comida', 'Marca'];
  const FACILES = 'ABCDEFGHIJLMNOPRSTUV';
  const DIFICILES = 'KÑQWXYZ';
  const ESPERA_RESPUESTAS = 6000;

  // Para comparar: sin tildes (salvo la Ñ), minúsculas y sin espacios de más.
  const normal = s => (s || '').toLowerCase().replace(/ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ').replace(/\s+/g, ' ').trim();
  const empiezaCon = (s, letra) => normal(s).startsWith(normal(letra));

  let reloj = null, finLocal = 0, faseVista = '', esperaHost = null;

  const presentes = ctx => ctx.estado.ronda.filter(id => ctx.jugadores.some(j => j.id === id));
  const borradorClave = ctx => `tutti:borrador:${ctx.estado.ronda.join('')}:${ctx.estado.numero}`;

  // ---------- Anfitrión ----------
  function empezar(ctx, op) {
    const ronda = ctx.jugadores.map(j => j.id);
    const nombres = Object.fromEntries(ctx.jugadores.map(j => [j.id, j.nombre]));
    Object.assign(ctx.memoria, { op });
    nuevaRonda(ctx, { juego: 'tutti', ronda, nombres, cats: op.cats, rondas: op.rondas, seg: op.seg, numero: 0, usadas: [], totales: Object.fromEntries(ronda.map(id => [id, 0])) });
  }

  function nuevaRonda(ctx, base) {
    const pool = [...(ctx.memoria.op.dificiles ? FACILES + DIFICILES : FACILES)].filter(l => !base.usadas.includes(l));
    const letra = pool[Math.floor(Math.random() * pool.length)] || 'A';
    ctx.memoria.resp = {};
    ctx.memoria.fin = base.seg ? Date.now() + (base.seg + 3) * 1000 : 0;
    ctx.publicar({ ...base, fase: 'escribir', numero: base.numero + 1, letra, usadas: [...base.usadas, letra], terminaron: [], basta: null, restante: base.seg ? base.seg * 1000 : 0 });
  }

  function cortar(ctx, quien) {
    const e = ctx.estado;
    if (e.fase !== 'escribir') return;
    ctx.memoria.fin = 0;
    ctx.publicar({ ...e, fase: 'juntando', basta: quien || null });
    // Si alguien no manda sus respuestas (se le cortó), se puntúa igual con las que llegaron.
    clearTimeout(esperaHost);
    esperaHost = setTimeout(() => puntuar(ctx), ESPERA_RESPUESTAS);
  }

  function puntuar(ctx) {
    clearTimeout(esperaHost);
    const e = ctx.estado;
    if (e.fase !== 'juntando') return;
    ctx.publicar({ ...e, fase: 'revision', respuestas: ctx.memoria.resp || {}, anuladas: {}, puntos: calcular(e, ctx.memoria.resp || {}, {}) });
  }

  // 20 si sos el único que puso algo válido, 10 si es única, 5 si se repite, 0 si no vale.
  function calcular(e, resp, anuladas) {
    const puntos = {};
    e.ronda.forEach(id => { puntos[id] = e.cats.map(() => 0); });
    e.cats.forEach((_, c) => {
      const validas = e.ronda.filter(id => {
        const r = (resp[id] || [])[c];
        return r && empiezaCon(r, e.letra) && normal(r).length > 1 && !anuladas[`${id}|${c}`];
      });
      validas.forEach(id => {
        const mia = normal(resp[id][c]);
        const iguales = validas.filter(o => normal(resp[o][c]) === mia).length;
        puntos[id][c] = validas.length === 1 ? 20 : iguales > 1 ? 5 : 10;
      });
    });
    return puntos;
  }

  function accion(ctx, de, a) {
    const e = ctx.estado;
    if (!e || e.juego !== 'tutti' || !e.ronda.includes(de)) return;
    const host = de === ctx.yo;
    if (a.tipo === 'tiempo' && host) cortar(ctx, null);
    else if (a.tipo === 'basta' && e.fase === 'escribir') cortar(ctx, de);
    else if (a.tipo === 'listo' && e.fase === 'escribir' && !e.terminaron.includes(de)) ctx.publicar({ ...e, terminaron: [...e.terminaron, de] });
    else if (a.tipo === 'respuestas' && e.fase === 'juntando' && a.numero === e.numero) {
      ctx.memoria.resp = { ...(ctx.memoria.resp || {}), [de]: (a.lista || []).slice(0, e.cats.length).map(x => String(x || '').slice(0, 40)) };
      if (presentes(ctx).every(id => ctx.memoria.resp[id])) puntuar(ctx);
    } else if (a.tipo === 'anular' && host && e.fase === 'revision') {
      const k = `${a.id}|${a.c}`;
      const anuladas = { ...e.anuladas };
      if (anuladas[k]) delete anuladas[k]; else anuladas[k] = true;
      ctx.publicar({ ...e, anuladas, puntos: calcular(e, e.respuestas, anuladas) });
    } else if (a.tipo === 'sumar' && host && e.fase === 'revision') {
      const totales = { ...e.totales };
      e.ronda.forEach(id => { totales[id] = (totales[id] || 0) + e.puntos[id].reduce((s, x) => s + x, 0); });
      ctx.publicar({ ...e, fase: e.numero >= e.rondas ? 'final' : 'tabla', totales });
    } else if (a.tipo === 'siguiente' && host && e.fase === 'tabla') {
      const { respuestas, anuladas, puntos, ...base } = e;
      nuevaRonda(ctx, base);
    } else if (a.tipo === 'otra' && host) empezar(ctx, ctx.memoria.op);
    else if (a.tipo === 'sala' && host) ctx.aLaSala();
  }

  // ---------- Pantallas ----------
  const N = (ctx, id) => App.esc(ctx.nombreDe(id));
  const total = (e, id) => e.puntos[id].reduce((s, x) => s + x, 0);

  function vista(ctx) {
    const e = ctx.estado, host = ctx.esAnfitrion;
    const cab = `<div class="tt-cab"><span>Ronda ${e.numero}/${e.rondas}</span><span class="tt-letra">${e.letra}</span><span id="tt-reloj"></span></div>`;
    if (e.fase === 'escribir') {
      const b = App.leer(borradorClave(ctx), []);
      return `${cab}
        <div class="tt-form" data-tutti="${e.numero}">
          ${e.cats.map((c, i) => `
            <label class="tt-campo"><span>${App.esc(c)}</span>
              <input data-c="${i}" maxlength="40" autocomplete="off" autocorrect="off" autocapitalize="sentences" enterkeyhint="next" value="${App.esc(b[i] || '')}" placeholder="${e.letra}…">
            </label>`).join('')}
        </div>
        <p class="nota" id="tt-faltan"></p>
        <button class="btn grande rojo" id="basta" data-sin>✋ ¡BASTA!</button>
        <p class="nota" id="tt-terminaron"></p>`;
    }
    if (e.fase === 'juntando') {
      return `${cab}<div class="red-espera">
        <div class="tt-basta">${e.basta ? `✋ ¡BASTA!<small>lo cantó ${N(ctx, e.basta)}</small>` : '⏰ ¡Tiempo!'}</div>
        <div class="puntitos"><i></i><i></i><i></i></div><p>Juntando respuestas…</p></div>`;
    }
    if (e.fase === 'revision') {
      return `${cab}
        ${host ? '<p class="bajada">Tocá una respuesta que no valga para anularla</p>' : '<p class="bajada">El anfitrión revisa las respuestas</p>'}
        ${e.cats.map((c, i) => `
          <div class="tt-cat">
            <b>${App.esc(c)}</b>
            ${e.ronda.map(id => {
              const r = (e.respuestas[id] || [])[i] || '';
              const anulada = e.anuladas[`${id}|${i}`];
              const pts = e.puntos[id][i];
              return `<button class="tt-resp ${anulada ? 'anulada' : ''} ${pts ? 'p' + pts : 'p0'}" data-id="${id}" data-c="${i}" ${host ? '' : 'disabled'}>
                <span class="quien">${N(ctx, id)}</span><span class="que">${r ? App.esc(r) : '—'}</span><span class="pts">${pts}</span></button>`;
            }).join('')}
          </div>`).join('')}
        <div class="tt-sub">${e.ronda.map(id => `<span>${N(ctx, id)}: <b>+${total(e, id)}</b></span>`).join('')}</div>
        ${host ? '<button class="btn grande verde" id="sumar">Sumar puntos</button>' : ''}`;
    }
    // tabla o final
    const orden = [...e.ronda].sort((a, b) => e.totales[b] - e.totales[a]);
    const final = e.fase === 'final';
    return `
      ${final ? `<div class="copa">🏆</div><h2 class="centro tt-ganador">¡Ganó ${N(ctx, orden[0])}!</h2>` : `<h2 class="centro">Tabla después de la ronda ${e.numero}</h2>`}
      <ol class="podio">
        ${orden.map((id, k) => `<li class="${['amarillo', 'celeste', 'naranja'][k] || 'violeta'}"><span>${['🥇', '🥈', '🥉'][k] || k + 1 + '°'}</span><b>${N(ctx, id)}${id === ctx.yo ? ' (vos)' : ''}</b><strong>${e.totales[id]}</strong></li>`).join('')}
      </ol>
      ${host ? (final
        ? '<div class="acciones"><button class="btn grande verde" id="otra">Otra partida</button><button class="btn violeta" id="sala">Volver a la sala</button></div>'
        : `<div class="acciones"><button class="btn grande verde" id="siguiente">Siguiente ronda (${e.numero + 1}/${e.rondas})</button></div>`)
        : '<p class="red-aviso">Esperando al anfitrión…</p>'}`;
  }

  function leerCampos(el) { return [...el.querySelectorAll('.tt-form input')].map(i => i.value.trim()); }

  // Mientras se escribe no se redibuja la pantalla (se perdería lo escrito): solo se actualizan los avisos.
  function mantener(el, ctx) {
    const e = ctx.estado;
    if (e.fase !== 'escribir' || !el.querySelector(`[data-tutti="${e.numero}"]`)) return false;
    avisos(el, ctx);
    return true;
  }

  function avisos(el, ctx) {
    const e = ctx.estado;
    const campos = leerCampos(el);
    const malas = campos.filter(x => !x || !empiezaCon(x, e.letra)).length;
    const faltan = el.querySelector('#tt-faltan');
    if (faltan) faltan.textContent = malas ? `Te faltan ${malas} (todas con ${e.letra}) para cantar ¡Basta!` : '¡Ya podés cantar ¡Basta!';
    const basta = el.querySelector('#basta');
    if (basta) basta.disabled = malas > 0;
    const ter = el.querySelector('#tt-terminaron');
    if (ter) ter.textContent = e.terminaron.length ? `Ya completaron: ${e.terminaron.map(id => ctx.nombreDe(id)).join(', ')}` : '';
    el.querySelectorAll('.tt-form input').forEach(i => i.classList.toggle('mal', !!i.value.trim() && !empiezaCon(i.value, e.letra)));
  }

  function enlazar(el, ctx) {
    const e = ctx.estado, host = ctx.esAnfitrion;
    const fase = `${e.fase}:${e.numero}`;
    const nueva = fase !== faseVista;
    faseVista = fase;
    clearInterval(reloj);

    if (e.fase === 'escribir') {
      if (nueva) {
        finLocal = e.seg ? Date.now() + (e.restante || e.seg * 1000) : 0;
        Sonido.revelar();
        App.vibrar(60);
      }
      const clave = borradorClave(ctx);
      let avise = false;
      el.querySelector('.tt-form').addEventListener('input', () => {
        App.guardar(clave, leerCampos(el));
        avisos(el, ctx);
        const completo = !el.querySelector('#basta').disabled;
        if (completo && !avise && !e.terminaron.includes(ctx.yo)) { avise = true; ctx.accion({ tipo: 'listo' }); }
      });
      el.querySelectorAll('.tt-form input').forEach((inp, k, todos) => {
        inp.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); (todos[k + 1] || inp).focus(); if (!todos[k + 1]) inp.blur(); } };
      });
      el.querySelector('#basta').onclick = () => { Sonido.boom(); ctx.accion({ tipo: 'basta' }); };
      avisos(el, ctx);
      const elReloj = el.querySelector('#tt-reloj');
      const tic = () => {
        if (!el.isConnected) { clearInterval(reloj); return; }
        if (!finLocal) { elReloj.textContent = '∞'; return; }
        const s = Math.max(0, Math.ceil((finLocal - Date.now()) / 1000));
        elReloj.textContent = `⏱ ${s}`;
        elReloj.classList.toggle('apurado', s <= 10);
        if (s <= 10 && s > 0) Sonido.tic();
        // El anfitrión es el que corta oficialmente cuando se termina el tiempo.
        if (host && ctx.memoria.fin && Date.now() > ctx.memoria.fin) { ctx.memoria.fin = 0; ctx.accion({ tipo: 'tiempo' }); }
      };
      tic();
      reloj = setInterval(tic, 1000);
      if (nueva) el.querySelector('.tt-form input').focus();
      return;
    }

    if (e.fase === 'juntando') {
      if (nueva) { Sonido.fin(); App.vibrar([150, 80, 150]); }
      // Cada celu manda lo que escribió.
      ctx.accion({ tipo: 'respuestas', numero: e.numero, lista: App.leer(borradorClave(ctx), []) });
      return;
    }

    if (e.fase === 'revision') {
      if (nueva) Sonido.carta();
      el.querySelectorAll('.tt-resp').forEach(b => { if (host) b.onclick = () => ctx.accion({ tipo: 'anular', id: b.dataset.id, c: +b.dataset.c }); });
      const s = el.querySelector('#sumar');
      if (s) s.onclick = () => ctx.accion({ tipo: 'sumar' });
      return;
    }

    if (nueva) {
      if (e.fase === 'final') {
        const orden = [...e.ronda].sort((a, b) => e.totales[b] - e.totales[a]);
        if (orden[0] === ctx.yo) { Sonido.ganar(); App.confeti(150); } else Sonido.revelar();
      } else Sonido.acierto();
    }
    const on = (id, f) => { const b = el.querySelector(id); if (b) b.onclick = f; };
    on('#siguiente', () => ctx.accion({ tipo: 'siguiente' }));
    on('#otra', () => ctx.accion({ tipo: 'otra' }));
    on('#sala', () => ctx.accion({ tipo: 'sala' }));
  }

  return {
    id: 'tutti', nombre: 'Tutti frutti', emoji: '🍓', color: 'verde', minimo: 2,
    bajada: 'Misma letra para todos, cada uno escribe en su celu',
    opciones: () => {
      const pref = App.leer('tutti:pref', { cats: DEFECTO, rondas: 5, seg: 90, dificiles: false });
      return `<p class="bajada">Categorías (elegí varias)</p>
        <div class="chips" data-multi>${CATEGORIAS.map(c => `<button class="chip ${pref.cats.includes(c) ? 'on' : ''}" data-c="${App.esc(c)}">${App.esc(c)}</button>`).join('')}</div>
        <div class="opcion"><span>Rondas</span><div class="segmentos" id="tt-rondas">${[3, 5, 8].map(n => `<button data-v="${n}" class="${n === pref.rondas ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="opcion"><span>Tiempo</span><div class="segmentos" id="tt-seg">${[[60, '60 s'], [90, '90 s'], [120, '2 min'], [0, '∞']].map(([v, t]) => `<button data-v="${v}" class="${v === pref.seg ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <label class="interruptor"><input type="checkbox" id="tt-dif" ${pref.dificiles ? 'checked' : ''}><span class="perilla"></span><span>Incluir letras difíciles (K, Ñ, Q, W, X, Y, Z)</span></label>`;
    },
    leerOpciones: el => {
      const cats = [...el.querySelectorAll('.chip.on')].map(c => c.dataset.c);
      if (cats.length < 3) { Sonido.error(); App.preguntar('Elegí al menos 3 categorías.', 'Ok', 'Dale'); return null; }
      const op = { cats, rondas: +el.querySelector('#tt-rondas .on').dataset.v, seg: +el.querySelector('#tt-seg .on').dataset.v, dificiles: el.querySelector('#tt-dif').checked };
      App.guardar('tutti:pref', op);
      return op;
    },
    empezar, accion, vista, enlazar, mantener,
    presencia: ctx => {
      const e = ctx.estado;
      if (!ctx.esAnfitrion || !e) return;
      if (e.fase === 'juntando' && presentes(ctx).every(id => (ctx.memoria.resp || {})[id])) puntuar(ctx);
    },
  };
})();
