// Racimo: poné fichas de colores; con 4 o más juntas explotan y contagian su color alrededor.

const Racimo = (() => {
  const R = RacimoReglas;
  const COLORES = ['amarillo', 'rosa', 'celeste', 'verde', 'violeta', 'naranja'];
  const FORMAS = ['●', '▲', '■', '◆', '★', '♥'];

  let st = App.leer('racimo:partida', null);
  const guardar = () => App.guardar('racimo:partida', st);
  const nuevaPartida = () => ({
    tab: new Array(R.N * R.N).fill(null),
    cola: [R.fichaNueva(0), R.fichaNueva(0), R.fichaNueva(0)],
    puntos: 0, desde: 0, jugadas: 0, terminado: false,
  });

  const fichaHTML = (f, extra = '') => {
    if (!f) return '';
    if (f.comodin) return `<span class="rf comodin ${extra}">★</span>`;
    if (f.p != null) return `<span class="rf piedra p${f.p} ${extra}"></span>`;
    return `<span class="rf ${COLORES[f.c]} ${extra}">${FORMAS[f.c]}</span>`;
  };

  function inicio() {
    App.despierto(false);
    const record = App.leer('racimo:record', 0);
    const hay = st && !st.terminado && st.jugadas > 0;
    const p = App.pantalla({ titulo: 'Racimo', volver: App.menu, clase: 'racimo-inicio', html: `
      <div class="racimo-logo" aria-hidden="true">
        ${[0, 1, 2, 3, 1, 0, 2].map(c => `<span class="rf ${COLORES[c]}">${FORMAS[c]}</span>`).join('')}
      </div>
      ${record ? `<p class="bajada">Tu récord: <b>${record}</b></p>` : ''}
      <div class="como">
        <b>Cómo se juega</b>
        <p>Tocá una casilla vacía para poner la ficha. Cuando juntás <b>4 o más del mismo color</b> (pegadas por los lados) explotan, y las fichas de alrededor <b>se contagian</b> de ese color: así se arman cadenas que suman mucho más.</p>
        <p>Cada tantas jugadas cae una 🪨 piedra: solo se rompe con explosiones al lado. La ★ se vuelve del color que más te conviene. Con más puntos aparecen más colores. Si se llena el tablero, perdiste.</p>
      </div>
      <div class="acciones">
        ${hay ? `<button class="btn grande amarillo" id="seguir">▶ Seguir (${st.puntos} puntos)</button>` : ''}
        <button class="btn grande ${hay ? 'violeta' : 'verde'}" id="nueva">${hay ? 'Empezar de nuevo' : '¡Jugar!'}</button>
      </div>` });
    if (hay) p.querySelector('#seguir').onclick = jugar;
    p.querySelector('#nueva').onclick = async () => {
      if (hay && !(await App.preguntar('¿Empezar de nuevo? Se pierde la partida que tenías.', 'Sí', 'No'))) return;
      st = nuevaPartida();
      guardar();
      jugar();
    };
  }

  function jugar() {
    App.despierto(true);
    let ocupado = false;
    const espera = ms => new Promise(r => setTimeout(r, ms));
    let vivo = true;

    const p = App.pantalla({ titulo: 'Racimo', volver: inicio, clase: 'racimo', html: `
      <div class="rc-marcador">
        <div><small>Puntos</small><b id="puntos">0</b></div>
        <div><small>Récord</small><b id="record">0</b></div>
        <div><small>Colores</small><b id="colores">3</b></div>
      </div>
      <div class="rc-tablero" id="tablero">
        ${st.tab.map((_, i) => `<button class="rc-celda" data-i="${i}" data-sin></button>`).join('')}
        <div class="rc-cartel" id="cartel"></div>
      </div>
      <div class="rc-abajo">
        <div class="rc-ahora"><small>Ahora</small><div id="ahora"></div></div>
        <div class="rc-despues"><small>Después</small><div id="despues"></div></div>
        <div class="rc-piedra"><small>Piedra en</small><b id="piedra"></b></div>
      </div>` });
    const celdas = [...p.querySelectorAll('.rc-celda')];
    const cartel = p.querySelector('#cartel');

    function pintar(clases = new Map()) {
      st.tab.forEach((f, i) => {
        celdas[i].innerHTML = fichaHTML(f, clases.get(i) || '');
        celdas[i].classList.toggle('vacia', !f);
      });
      p.querySelector('#puntos').textContent = st.puntos;
      p.querySelector('#record').textContent = Math.max(st.puntos, App.leer('racimo:record', 0));
      p.querySelector('#colores').textContent = R.coloresPara(st.puntos);
      p.querySelector('#ahora').innerHTML = fichaHTML(st.cola[0]);
      p.querySelector('#despues').innerHTML = fichaHTML(st.cola[1]) + fichaHTML(st.cola[2]);
      p.querySelector('#piedra').textContent = R.piedraCada(st.puntos) - st.desde;
    }

    function mostrarCartel(texto) {
      cartel.textContent = texto;
      cartel.classList.remove('ver'); void cartel.offsetWidth; cartel.classList.add('ver');
    }

    async function poner(i) {
      if (ocupado || st.terminado || st.tab[i]) return;
      ocupado = true;
      let f = st.cola.shift();
      if (f.comodin) f = { c: R.colorComodin(st.tab, i, R.coloresPara(st.puntos)) };
      st.tab[i] = { c: f.c };
      st.cola.push(R.fichaNueva(st.puntos));
      st.jugadas++;
      Sonido.poner();
      pintar(new Map([[i, 'cae']]));

      const pasos = R.resolver(st.tab, [i]);
      // Para animar, se rearma el tablero de antes de cada paso.
      for (const paso of pasos) {
        if (!vivo) return;
        await espera(220);
        paso.explota.forEach(([j, c]) => { celdas[j].innerHTML = fichaHTML({ c }, 'explota'); });
        Sonido.racimo(paso.cadena);
        App.vibrar(paso.cadena > 1 ? [30, 30, 60] : 30);
        if (paso.cadena > 1) mostrarCartel(`¡Cadena ×${paso.cadena}!`);
        await espera(300);
        st.puntos += paso.puntos;
        const clases = new Map();
        paso.contagio.forEach(([j]) => clases.set(j, 'contagia'));
        paso.golpeadas.forEach(j => clases.set(j, 'golpe'));
        const final = st.tab;
        st.tab = paso.tablero;
        pintar(clases);
        st.tab = final;
        if (paso.rotas.length) Sonido.piedra();
      }
      if (!vivo) return;
      pintar();

      st.desde++;
      if (st.desde >= R.piedraCada(st.puntos)) {
        st.desde = 0;
        const vacias = st.tab.map((x, j) => x ? -1 : j).filter(j => j >= 0);
        if (vacias.length) {
          await espera(250);
          const j = vacias[Math.floor(Math.random() * vacias.length)];
          st.tab[j] = { p: R.durezaPiedra(st.puntos) };
          Sonido.piedra();
          App.vibrar(60);
          pintar(new Map([[j, 'cae-piedra']]));
        }
      }

      const subio = R.coloresPara(st.puntos) > R.coloresPara(st.puntos - pasos.reduce((s, x) => s + x.puntos, 0));
      if (subio) { mostrarCartel('¡Nuevo color!'); Sonido.revelar(); }

      if (st.tab.every(Boolean)) return terminar();
      guardar();
      ocupado = false;
    }

    function terminar() {
      st.terminado = true;
      const record = App.leer('racimo:record', 0);
      const nuevo = st.puntos > record;
      if (nuevo) App.guardar('racimo:record', st.puntos);
      guardar();
      Sonido.fin();
      App.vibrar([200, 100, 200]);
      if (nuevo) setTimeout(() => { Sonido.ganar(); App.confeti(150); }, 600);
      setTimeout(() => {
        const d = document.createElement('div');
        d.className = 'modal ver';
        d.innerHTML = `<div class="modal-caja ganador">
          <span class="emo">${nuevo ? '🏆' : '🍇'}</span>
          <h2>${nuevo ? '¡Nuevo récord!' : '¡Se llenó!'}</h2>
          <p>${st.puntos} puntos en ${st.jugadas} jugadas</p>
          ${!nuevo && record ? `<p style="font-size:1rem;opacity:.8">Récord: ${record}</p>` : ''}
          <div class="fila"><button class="btn gris" data-r="menu">Salir</button><button class="btn verde" data-r="otra">Otra</button></div>
        </div>`;
        document.body.appendChild(d);
        d.addEventListener('click', e => {
          const b = e.target.closest('[data-r]');
          if (!b) return;
          d.remove();
          if (b.dataset.r === 'otra') { st = nuevaPartida(); guardar(); jugar(); } else inicio();
        });
      }, 900);
    }

    p.querySelector('#tablero').onclick = e => {
      const el = e.target.closest('.rc-celda');
      if (el) poner(+el.dataset.i);
    };
    App.alSalir(() => { vivo = false; guardar(); App.despierto(false); });
    pintar();
  }

  return { inicio };
})();
