// El Impostor: todos ven la misma palabra menos uno. Hay que descubrirlo.

const Impostor = (() => {
  const CATS = ['mezcla', 'lugares', 'comidas', 'animales', 'objetos', 'profesiones', 'deportes', 'famosos', 'peliculas'];
  const MIN = 3, MAX = 12;
  let jugadores = App.leer('impostor:jugadores', ['', '', '', '']);
  let cat = App.leer('impostor:cat', 'mezcla');
  let pista = App.leer('impostor:pista', true);
  let ronda = null;

  const nombre = i => (jugadores[i] || '').trim() || `Jugador ${i + 1}`;
  const nombreCat = k => k === 'mezcla' ? 'Mezcla' : PALABRAS[k].nombre;
  const emojiCat = k => k === 'mezcla' ? '🎲' : PALABRAS[k].emoji;

  function inicio() {
    App.despierto(false);
    const p = App.pantalla({ titulo: 'El Impostor', volver: App.menu, clase: 'imp-config', html: `
      <p class="bajada">¿Quiénes juegan? <small>(de ${MIN} a ${MAX})</small></p>
      <div class="jugadores" id="lista"></div>
      <button class="btn chico celeste" id="agregar">＋ Agregar jugador</button>
      <p class="bajada">Categoría</p>
      <div class="chips" id="cats">
        ${CATS.map(k => `<button class="chip ${k === cat ? 'on' : ''}" data-k="${k}">${emojiCat(k)} ${nombreCat(k)}</button>`).join('')}
      </div>
      <label class="interruptor">
        <input type="checkbox" id="pista" ${pista ? 'checked' : ''}>
        <span class="perilla"></span>
        <span>El impostor sabe la categoría</span>
      </label>
      <div class="como">
        <b>Cómo se juega</b>
        <p>Cada uno mira su carta a escondidas. Todos tienen la misma palabra, menos el impostor. Por turnos, cada uno dice <b>una sola palabra</b> relacionada, sin regalarla. Después discuten y votan quién es el impostor. Si lo agarran, todavía puede ganar adivinando la palabra.</p>
      </div>
      <button class="btn grande rosa" id="repartir">Repartir cartas</button>` });

    const lista = p.querySelector('#lista');
    function pintar() {
      lista.innerHTML = jugadores.map((j, i) => `
        <div class="jugador">
          <span class="num">${i + 1}</span>
          <input type="text" maxlength="16" placeholder="Jugador ${i + 1}" value="${App.esc(j)}" data-i="${i}" autocomplete="off" autocapitalize="words" enterkeyhint="next">
          <button class="quitar" data-q="${i}" aria-label="Quitar" ${jugadores.length <= MIN ? 'disabled' : ''}>✕</button>
        </div>`).join('');
      p.querySelector('#agregar').disabled = jugadores.length >= MAX;
    }
    pintar();
    lista.addEventListener('input', e => {
      if (e.target.dataset.i == null) return;
      jugadores[+e.target.dataset.i] = e.target.value;
      App.guardar('impostor:jugadores', jugadores);
    });
    lista.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const sig = lista.querySelector(`[data-i="${+e.target.dataset.i + 1}"]`);
      sig ? sig.focus() : e.target.blur();
    });
    lista.addEventListener('click', e => {
      const b = e.target.closest('[data-q]');
      if (!b || jugadores.length <= MIN) return;
      jugadores.splice(+b.dataset.q, 1);
      App.guardar('impostor:jugadores', jugadores);
      pintar();
    });
    p.querySelector('#agregar').onclick = () => {
      if (jugadores.length >= MAX) return;
      jugadores.push('');
      App.guardar('impostor:jugadores', jugadores);
      pintar();
      lista.querySelector(`[data-i="${jugadores.length - 1}"]`).focus();
    };
    p.querySelectorAll('#cats .chip').forEach(b => {
      b.onclick = () => {
        cat = b.dataset.k;
        App.guardar('impostor:cat', cat);
        p.querySelectorAll('#cats .chip').forEach(x => x.classList.toggle('on', x === b));
      };
    });
    p.querySelector('#pista').onchange = e => { pista = e.target.checked; App.guardar('impostor:pista', pista); };
    p.querySelector('#repartir').onclick = repartir;
  }

  function repartir() {
    const real = cat === 'mezcla' ? CATS[1 + Math.floor(Math.random() * (CATS.length - 1))] : cat;
    const n = jugadores.length;
    ronda = {
      cat: real,
      palabra: App.sacar('imp:' + real, PALABRAS[real].palabras),
      impostor: Math.floor(Math.random() * n),
      empieza: Math.floor(Math.random() * n),
      turno: 0,
    };
    pasar();
  }

  function pasar() {
    const n = jugadores.length;
    const i = ronda.turno;
    const esImp = i === ronda.impostor;
    const frente = esImp
      ? `<span class="emo">🤫</span><b class="impostor">Sos el impostor</b>
         ${pista ? `<small>Categoría: ${nombreCat(ronda.cat)}</small>` : '<small>¡Que no te descubran!</small>'}`
      : `<small>La palabra es</small><b class="palabra">${App.esc(ronda.palabra)}</b><small>${emojiCat(ronda.cat)} ${nombreCat(ronda.cat)}</small>`;
    const p = App.pantalla({ titulo: 'El Impostor', volver: inicio, confirmar: '¿Cortar la ronda?', clase: 'imp-pasar', html: `
      <p class="paso-de">Carta ${i + 1} de ${n}</p>
      <h2 class="pasale">Pasale el celu a<br><b>${App.esc(nombre(i))}</b></h2>
      <div class="carta" id="carta">
        <div class="carta-in">
          <div class="cara dorso"><span class="emo">🕵️</span><b>Tocá para ver tu carta</b><small>Que nadie más mire</small></div>
          <div class="cara frente">${frente}</div>
        </div>
      </div>
      <button class="btn grande violeta escondido" id="listo">Ya la vi, tapar</button>` });
    const carta = p.querySelector('#carta');
    const listo = p.querySelector('#listo');
    let vista = false;
    carta.onclick = () => {
      if (vista) return;
      vista = true;
      Sonido.carta();
      App.vibrar(30);
      carta.classList.add('volteada');
      setTimeout(() => listo.classList.remove('escondido'), 400);
    };
    listo.onclick = () => {
      listo.disabled = true;
      carta.classList.remove('volteada');
      Sonido.carta();
      setTimeout(() => {
        ronda.turno++;
        ronda.turno < n ? pasar() : jugar();
      }, 450);
    };
  }

  function jugar() {
    const p = App.pantalla({ titulo: 'El Impostor', volver: inicio, confirmar: '¿Cortar la ronda?', clase: 'imp-jugar', html: `
      <div class="globo">🗣️</div>
      <h2>¡A jugar!</h2>
      <p class="empieza">Empieza <b>${App.esc(nombre(ronda.empieza))}</b><br><small>y sigue el de su izquierda</small></p>
      <ol class="pasos">
        <li><span>Cada uno dice <b>una palabra</b> relacionada con la suya.</span></li>
        <li><span>Pueden dar una o dos vueltas.</span></li>
        <li><span>Discutan: ¿quién está chamuyando?</span></li>
      </ol>
      <button class="btn grande rosa" id="votar">¡A votar!</button>` });
    App.despierto(true);
    p.querySelector('#votar').onclick = votar;
  }

  function votar() {
    const p = App.pantalla({ titulo: 'Votación', volver: jugar, clase: 'imp-votar', html: `
      <h2>¿A quién votaron?</h2>
      <p class="bajada">Cuenten hasta tres y señalen todos a la vez. Tocá al más votado.</p>
      <div class="votos">
        ${jugadores.map((_, i) => `<button class="btn voto" data-i="${i}"><span class="avatar">${App.esc(nombre(i).slice(0, 1).toUpperCase())}</span>${App.esc(nombre(i))}</button>`).join('')}
      </div>` });
    p.querySelectorAll('.voto').forEach(b => {
      b.onclick = async () => {
        const i = +b.dataset.i;
        if (await App.preguntar(`¿Votaron a ${nombre(i)}?`, 'Sí, revelar', 'No')) revelar(i);
      };
    });
  }

  function revelar(votado) {
    const p = App.pantalla({ clase: 'imp-revelar', html: `
      <div class="suspenso" id="suspenso">
        <p>${App.esc(nombre(votado))} era…</p>
        <div class="puntitos"><i></i><i></i><i></i></div>
      </div>` });
    Sonido.redoble();
    const t = setTimeout(() => resultado(votado), 1800);
    App.alSalir(() => clearTimeout(t));
  }

  function resultado(votado) {
    const acerto = votado === ronda.impostor;
    const p = App.pantalla({ titulo: 'El Impostor', volver: inicio, clase: 'imp-resultado ' + (acerto ? 'bien' : 'mal'), html: `
      <div class="veredicto">
        <span class="emo">${acerto ? '🎉' : '😈'}</span>
        <h2>${acerto ? '¡Lo agarraron!' : '¡Era inocente!'}</h2>
        <p>${acerto
          ? `<b>${App.esc(nombre(votado))}</b> era el impostor.`
          : `<b>${App.esc(nombre(votado))}</b> no era. El impostor era <b>${App.esc(nombre(ronda.impostor))}</b>. ¡Gana el impostor!`}</p>
        ${acerto ? `<p class="ultima">Última chance: si ${App.esc(nombre(ronda.impostor))} adivina la palabra, gana igual.</p>` : ''}
      </div>
      <button class="btn blanco" id="ver">Mostrar la palabra</button>
      <div class="palabra-final escondido" id="pal"><small>La palabra era</small><b>${App.esc(ronda.palabra)}</b></div>
      <div class="acciones">
        <button class="btn grande verde" id="otra">Otra ronda</button>
        <button class="btn violeta" id="config">Cambiar jugadores</button>
      </div>` });
    if (acerto) { Sonido.ganar(); App.confeti(); } else Sonido.error();
    p.querySelector('#ver').onclick = e => {
      e.currentTarget.classList.add('escondido');
      p.querySelector('#pal').classList.remove('escondido');
      Sonido.revelar();
    };
    p.querySelector('#otra').onclick = repartir;
    p.querySelector('#config').onclick = inicio;
  }

  return { inicio };
})();
