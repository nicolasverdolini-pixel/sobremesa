// Tabú y Mímica: juegos por equipos que usan el motor de Partida.

// Opciones comunes: tiempo por turno y cantidad de vueltas.
function opcionesDeTurno(clave, p) {
  const op = App.leer(clave + ':op', { duracion: 60, vueltas: 3 });
  const seg = (id, vals, campo, sufijo) => `
    <div class="opcion">
      <span>${id === 'dur' ? 'Tiempo por turno' : 'Vueltas'}</span>
      <div class="segmentos" id="${id}">
        ${vals.map(v => `<button data-v="${v}" class="${v === op[campo] ? 'on' : ''}">${v}${sufijo}</button>`).join('')}
      </div>
    </div>`;
  const html = seg('dur', [45, 60, 90], 'duracion', ' s') + seg('vue', [2, 3, 4, 5], 'vueltas', '');
  const enlazar = pant => {
    [['dur', 'duracion'], ['vue', 'vueltas']].forEach(([id, campo]) => {
      pant.querySelectorAll(`#${id} button`).forEach(b => {
        b.onclick = () => {
          op[campo] = +b.dataset.v;
          App.guardar(clave + ':op', op);
          pant.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle('on', x === b));
        };
      });
    });
  };
  return { op, html, enlazar };
}

const Tabu = (() => {
  const mazo = TABU.map(l => {
    const [palabra, resto] = l.split(':');
    return { palabra: palabra.trim(), prohibidas: resto.split(',').map(s => s.trim()) };
  });

  function inicio() {
    App.despierto(false);
    const o = opcionesDeTurno('tabu');
    const p = App.pantalla({ titulo: 'Tabú', volver: App.menu, clase: 'tabu-inicio', html: `
      <div class="ilus-grande">🤐</div>
      ${o.html}
      <div class="como">
        <b>Cómo se juega</b>
        <p>Un jugador tiene que hacer adivinar la palabra a su equipo <b>sin decir las palabras prohibidas</b>, ni gestos, ni "suena como". El otro equipo mira la pantalla y grita <b>¡Tabú!</b> si se le escapa una. Correcta suma 1, Tabú resta 1, pasar no suma.</p>
      </div>
      <div class="acciones"><button class="btn grande naranja" id="equipos">Armar equipos</button></div>` });
    o.enlazar(p);
    p.querySelector('#equipos').onclick = () => Equipos.elegir({
      titulo: 'Tabú', volver: inicio,
      alListo: eqs => Partida.empezar({
        titulo: 'Tabú', clase: 'juego-tabu', verbo: 'Explica', volver: inicio,
        duracion: o.op.duracion, vueltas: o.op.vueltas,
        ayuda: 'El otro equipo mira las palabras prohibidas.',
        sacar: () => App.sacar('tabu', mazo),
        nombre: c => c.palabra,
        carta: c => `
          <b class="t-palabra">${App.esc(c.palabra)}</b>
          <small>No se puede decir</small>
          <ul class="prohibidas">${c.prohibidas.map(x => `<li>${App.esc(x)}</li>`).join('')}</ul>`,
        botones: [
          { id: 'tabu', texto: '¡Tabú!', clase: 'rojo', puntos: -1, sonido: 'error' },
          { id: 'paso', texto: 'Paso', clase: 'gris', puntos: 0, sonido: 'paso' },
          { id: 'ok', texto: '¡Bien!', clase: 'verde', puntos: 1, sonido: 'acierto' },
        ],
      }, eqs),
    });
  }

  return { inicio };
})();

const Mimica = (() => {
  const CATS = ['mezcla', 'acciones', 'peliculas', 'animales', 'profesiones', 'deportes', 'objetos', 'personajes'];
  let cat = App.leer('mimica:cat', 'mezcla');
  const nombreCat = k => k === 'mezcla' ? 'Mezcla' : PALABRAS[k].nombre;
  const emojiCat = k => k === 'mezcla' ? '🎲' : PALABRAS[k].emoji;

  function sacar() {
    const k = cat === 'mezcla' ? CATS[1 + Math.floor(Math.random() * (CATS.length - 1))] : cat;
    return { palabra: App.sacar('mim:' + k, PALABRAS[k].palabras), cat: k };
  }

  function inicio() {
    App.despierto(false);
    const o = opcionesDeTurno('mimica');
    const p = App.pantalla({ titulo: 'Mímica', volver: App.menu, clase: 'mimica-inicio', html: `
      <div class="ilus-grande">🤫🙌</div>
      <p class="bajada">Categoría</p>
      <div class="chips" id="cats">
        ${CATS.map(k => `<button class="chip ${k === cat ? 'on' : ''}" data-k="${k}">${emojiCat(k)} ${nombreCat(k)}</button>`).join('')}
      </div>
      ${o.html}
      <div class="como">
        <b>Cómo se juega</b>
        <p>Un jugador mira la palabra y la actúa <b>sin hablar ni hacer ruidos</b>. Su equipo tiene que adivinarla antes de que se acabe el tiempo. Cada acierto suma 1.</p>
      </div>
      <div class="acciones"><button class="btn grande violeta" id="equipos">Armar equipos</button></div>` });
    o.enlazar(p);
    p.querySelectorAll('#cats .chip').forEach(b => {
      b.onclick = () => {
        cat = b.dataset.k;
        App.guardar('mimica:cat', cat);
        p.querySelectorAll('#cats .chip').forEach(x => x.classList.toggle('on', x === b));
      };
    });
    p.querySelector('#equipos').onclick = () => Equipos.elegir({
      titulo: 'Mímica', volver: inicio,
      alListo: eqs => Partida.empezar({
        titulo: 'Mímica', clase: 'juego-mimica', verbo: 'Actúa', volver: inicio,
        duracion: o.op.duracion, vueltas: o.op.vueltas,
        ayuda: 'Solo el que actúa mira la pantalla. ¡Sin hablar!',
        sacar,
        nombre: c => c.palabra,
        carta: c => `
          <small>${emojiCat(c.cat)} ${nombreCat(c.cat)}</small>
          <b class="t-palabra">${App.esc(c.palabra)}</b>`,
        botones: [
          { id: 'paso', texto: 'Paso', clase: 'naranja', puntos: 0, sonido: 'paso' },
          { id: 'ok', texto: '¡Adivinaron!', clase: 'verde', puntos: 1, sonido: 'acierto' },
        ],
      }, eqs),
    });
  }

  return { inicio };
})();
