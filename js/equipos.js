// Sorteo de equipos: se usa solo desde el menú y también antes de Tabú y Mímica.

const Equipos = (() => {
  const COLORES = [
    { nombre: 'Rojos', clase: 'rojo', emoji: '🔥' },
    { nombre: 'Azules', clase: 'celeste', emoji: '🌊' },
    { nombre: 'Verdes', clase: 'verde', emoji: '🌵' },
    { nombre: 'Amarillos', clase: 'amarillo', emoji: '⚡' },
  ];
  let cantidad = App.leer('equipos:cantidad', 2);
  let jugadores = App.leer('equipos:jugadores', null)
    || App.leer('impostor:jugadores', []).filter(j => j.trim());
  let sorteo = App.leer('equipos:sorteo', null);

  const nombres = () => jugadores.map(j => j.trim()).filter(Boolean);

  function sortear() {
    const lista = App.mezclar(nombres());
    const grupos = COLORES.slice(0, cantidad).map(() => []);
    lista.forEach((n, i) => grupos[i % cantidad].push(n));
    sorteo = App.mezclar(grupos);
    App.guardar('equipos:sorteo', sorteo);
  }

  // El sorteo vale si tiene la cantidad de equipos y exactamente los jugadores cargados.
  function sorteoVigente() {
    if (!sorteo || sorteo.length !== cantidad) return false;
    const a = sorteo.flat().sort().join('|'), b = nombres().sort().join('|');
    return a === b;
  }

  function armar() {
    if (nombres().length && !sorteoVigente()) sortear();
    return COLORES.slice(0, cantidad).map((c, i) => ({
      ...c,
      miembros: nombres().length ? sorteo[i] : [],
    }));
  }

  // `alListo` recibe los equipos armados. Sin `alListo`, es el sorteo suelto del menú.
  function elegir({ titulo = 'Sorteo de equipos', volver = App.menu, boton = '', alListo = null } = {}) {
    App.despierto(false);
    const p = App.pantalla({ titulo, volver, clase: 'equipos', html: `
      <div class="opcion">
        <span>¿Cuántos equipos?</span>
        <div class="segmentos" id="cant">
          ${[2, 3, 4].map(n => `<button data-n="${n}" class="${n === cantidad ? 'on' : ''}">${n}</button>`).join('')}
        </div>
      </div>
      <p class="bajada">Jugadores ${alListo ? '<small>(opcional: si no cargás nombres, se juega por equipo)</small>' : ''}</p>
      <div class="jugadores" id="lista"></div>
      <button class="btn chico celeste" id="agregar">＋ Agregar jugador</button>
      <button class="btn amarillo" id="sortear">🎲 Sortear equipos</button>
      <div class="equipos-res" id="res"></div>
      ${alListo ? `<button class="btn grande verde" id="listo">${boton || '¡A jugar!'}</button>` : ''}` });

    const res = p.querySelector('#res');
    const bSortear = p.querySelector('#sortear');

    function pintar(animar = false) {
      bSortear.disabled = nombres().length < cantidad;
      const equipos = sorteoVigente() ? armar() : null;
      res.innerHTML = equipos ? equipos.map((e, i) => `
        <div class="equipo-tarjeta ${e.clase} ${animar ? 'sale' : ''}" style="animation-delay:${i * 120}ms">
          <b>${e.emoji} ${e.nombre}</b>
          <span>${e.miembros.map(App.esc).join(' · ') || '—'}</span>
        </div>`).join('') : '';
    }

    App.listaJugadores(p.querySelector('#lista'), p.querySelector('#agregar'), jugadores, {
      max: 24,
      alCambiar: () => { App.guardar('equipos:jugadores', jugadores); pintar(); },
    });
    p.querySelectorAll('#cant button').forEach(b => {
      b.onclick = () => {
        cantidad = +b.dataset.n;
        App.guardar('equipos:cantidad', cantidad);
        p.querySelectorAll('#cant button').forEach(x => x.classList.toggle('on', x === b));
        pintar();
      };
    });
    bSortear.setAttribute('data-sin', '');
    bSortear.onclick = () => {
      Sonido.carta();
      sortear();
      Sonido.revelar();
      pintar(true);
    };
    if (alListo) p.querySelector('#listo').onclick = () => alListo(armar());
    pintar();
  }

  return { elegir, inicio: () => elegir(), COLORES };
})();
