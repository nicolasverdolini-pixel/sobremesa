// Motor de juegos por equipos con reloj (Tabú y Mímica).
// Cada juego le pasa cómo sacar y dibujar una carta y qué botones tiene.
//
// cfg = { titulo, clase, verbo, duracion, vueltas, volver,
//         sacar(): carta, carta(c): html, nombre(c): texto,
//         botones: [{ id, texto, clase, puntos, sonido }] }

const Partida = (() => {
  const ESTADOS = { ok: { txt: '✓', clase: 'ok' }, paso: { txt: '⏭', clase: 'no' }, tabu: { txt: '✗', clase: 'tabu' } };

  function empezar(cfg, equiposIniciales) {
    const equipos = equiposIniciales.map(e => ({ ...e, puntos: 0, quien: 0 }));
    const n = equipos.length;
    let turnoNum = 0;

    const vuelta = () => Math.floor(turnoNum / n) + 1;
    const actual = () => equipos[turnoNum % n];

    const salir = async () => {
      if (await App.preguntar('¿Terminar la partida?', 'Sí, salir', 'Seguir')) cfg.volver();
    };

    function marcador(destacar = -1) {
      return `<div class="marcador">${equipos.map((e, i) => `
        <div class="marca ${e.clase} ${i === destacar ? 'activo' : ''}"><small>${e.emoji} ${e.nombre}</small><b>${e.puntos}</b></div>`).join('')}</div>`;
    }

    function turno() {
      App.despierto(true);
      const eq = actual();
      const jugador = eq.miembros.length ? eq.miembros[eq.quien % eq.miembros.length] : '';
      const p = App.pantalla({ titulo: cfg.titulo, volver: cfg.volver, confirmar: '¿Terminar la partida?', clase: 'turno ' + cfg.clase, html: `
        <p class="vuelta">Vuelta ${vuelta()} de ${cfg.vueltas}</p>
        ${marcador(turnoNum % n)}
        <div class="turno-de ${eq.clase}">
          <small>Turno de</small>
          <b>${eq.emoji} ${eq.nombre}</b>
          ${jugador ? `<p>${cfg.verbo}: <strong>${App.esc(jugador)}</strong></p>` : `<p>Elijan quién ${cfg.verbo.toLowerCase()}</p>`}
        </div>
        <p class="nota">${cfg.ayuda}</p>
        <button class="btn grande verde" id="empezar" data-sin>¡Empezar! · ${cfg.duracion} s</button>` });
      p.querySelector('#empezar').onclick = () => { Sonido.desbloquear(); jugar(); };
    }

    function jugar() {
      const eq = actual();
      const res = [];
      let carta = null, fin = Date.now() + cfg.duracion * 1000, ultimoSeg = null, activo = true, espera = null;
      const p = App.pantalla({ clase: 'p-juego ' + cfg.clase, html: `
        <div class="qs-arriba">
          <button class="btn-redondo" id="salir" aria-label="Salir">✕</button>
          <div class="reloj" id="reloj" style="--p:1"><span>${cfg.duracion}</span></div>
          <div class="contador"><b id="puntos">0</b><small>puntos</small></div>
        </div>
        <div class="p-carta" id="carta"></div>
        <div class="p-botones">
          ${cfg.botones.map(b => `<button class="btn ${b.clase}" data-b="${b.id}" data-sin>${b.texto}</button>`).join('')}
        </div>` });
      const elCarta = p.querySelector('#carta'), elReloj = p.querySelector('#reloj'), elNum = elReloj.querySelector('span');

      const puntos = () => res.reduce((s, r) => s + puntosDe(r.estado), 0);
      const puntosDe = est => (cfg.botones.find(b => b.id === est) || { puntos: 0 }).puntos;

      function siguiente() {
        carta = cfg.sacar();
        elCarta.innerHTML = `<div class="tarjeta entra">${cfg.carta(carta)}</div>`;
      }

      p.querySelectorAll('[data-b]').forEach(btn => {
        btn.onclick = () => {
          if (!activo) return;
          const b = cfg.botones.find(x => x.id === btn.dataset.b);
          res.push({ carta, estado: b.id });
          Sonido[b.sonido]();
          App.vibrar(b.puntos > 0 ? 50 : [30, 40, 30]);
          p.querySelector('#puntos').textContent = puntos();
          siguiente();
        };
      });

      const intervalo = setInterval(() => {
        const quedan = Math.max(0, fin - Date.now());
        const s = Math.ceil(quedan / 1000);
        elReloj.style.setProperty('--p', (quedan / (cfg.duracion * 1000)).toFixed(3));
        if (s !== ultimoSeg) {
          ultimoSeg = s;
          elNum.textContent = s;
          if (s <= 10 && s > 0) { Sonido.tic(); elReloj.classList.add('apurado'); }
        }
        if (quedan <= 0) {
          activo = false;
          clearInterval(intervalo);
          p.querySelectorAll('[data-b]').forEach(b => { b.disabled = true; });
          Sonido.fin();
          App.vibrar([200, 100, 200]);
          elCarta.innerHTML = '<div class="tiempo-fuera">¡Tiempo!</div>';
          espera = setTimeout(() => resumen(eq, res), 1400);
        }
      }, 100);

      Sonido.ya();
      siguiente();
      p.querySelector('#salir').onclick = salir;
      App.alSalir(() => { clearInterval(intervalo); clearTimeout(espera); });
    }

    // Al final del turno se puede corregir cualquier carta tocándola.
    function resumen(eq, res) {
      const ids = cfg.botones.map(b => b.id);
      const p = App.pantalla({ titulo: cfg.titulo, volver: cfg.volver, confirmar: '¿Terminar la partida?', clase: 'resumen ' + cfg.clase, html: `
        <div class="puntaje">
          <div class="gran-num" id="total"></div>
          <p id="para"></p>
          <p class="frase">Tocá una carta para corregirla</p>
        </div>
        <ul class="lista-res" id="lista"></ul>
        <div class="acciones"><button class="btn grande verde" id="seguir">Sumar y seguir</button></div>` });
      const lista = p.querySelector('#lista');
      const total = () => res.reduce((s, r) => s + cfg.botones.find(b => b.id === r.estado).puntos, 0);
      function pintar() {
        p.querySelector('#total').textContent = total();
        p.querySelector('#para').textContent = `${Math.abs(total()) === 1 ? 'punto' : 'puntos'} para ${eq.emoji} ${eq.nombre}`;
        lista.innerHTML = res.length ? res.map((r, i) => {
          const e = ESTADOS[r.estado];
          return `<li class="${e.clase}" data-i="${i}"><span>${e.txt}</span>${App.esc(cfg.nombre(r.carta))}</li>`;
        }).join('') : '<li class="vacio">No salió ninguna carta.</li>';
      }
      pintar();
      lista.onclick = e => {
        const li = e.target.closest('[data-i]');
        if (!li) return;
        const r = res[+li.dataset.i];
        r.estado = ids[(ids.indexOf(r.estado) + 1) % ids.length];
        pintar();
      };
      if (total() > 0) Sonido.ganar();
      p.querySelector('#seguir').onclick = () => {
        eq.puntos += total();
        eq.quien++;
        turnoNum++;
        vuelta() > cfg.vueltas ? final() : turno();
      };
    }

    function final() {
      App.despierto(false);
      const orden = [...equipos].sort((a, b) => b.puntos - a.puntos);
      const empate = orden.length > 1 && orden[0].puntos === orden[1].puntos;
      const p = App.pantalla({ titulo: cfg.titulo, volver: cfg.volver, clase: 'final-equipos', html: `
        <div class="copa">🏆</div>
        <h2>${empate ? '¡Empate!' : `¡Ganaron los ${orden[0].nombre}!`}</h2>
        <ol class="podio">
          ${orden.map((e, i) => `<li class="${e.clase}"><span>${['🥇', '🥈', '🥉', '4°'][i]}</span><b>${e.emoji} ${e.nombre}</b><strong>${e.puntos}</strong></li>`).join('')}
        </ol>
        <div class="acciones">
          <button class="btn grande verde" id="revancha">Revancha</button>
          <button class="btn violeta" id="config">Cambiar opciones</button>
        </div>` });
      Sonido.ganar();
      App.confeti(150);
      p.querySelector('#revancha').onclick = () => empezar(cfg, equiposIniciales);
      p.querySelector('#config').onclick = cfg.volver;
    }

    turno();
  }

  return { empezar };
})();
