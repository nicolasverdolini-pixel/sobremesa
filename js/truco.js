// Anotador de Truco: Nosotros / Ellos, a 15 o a 30, con palitos de fósforo.

const Truco = (() => {
  const nuevo = (meta = 30) => ({ meta, puntos: [0, 0], nombres: ['Nosotros', 'Ellos'], hist: [], ganador: null });
  let st = App.leer('truco', null) || nuevo();
  const guardar = () => App.guardar('truco', st);

  // Un fósforo: palito de madera con la cabeza roja.
  function fosforo(x1, y1, x2, y2, clase) {
    return `<g class="fosforo ${clase}">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="palo"/>
      <circle cx="${x2}" cy="${y2}" r="4.6" class="cabeza"/>
    </g>`;
  }

  // Grupo de cinco: los cuatro lados de un cuadrado y la diagonal.
  function grupo(n, y, ultimo) {
    const L = 14, R = 66, T = y + 6, B = y + 58;
    const palos = [
      [L, B, L, T], [L, T, R, T], [R, T, R, B], [R, B, L, B], [L + 4, B - 4, R - 4, T + 4],
    ];
    return palos.slice(0, n).map((pp, i) => fosforo(...pp, i === ultimo ? 'nuevo' : '')).join('');
  }

  function fosforos(p, meta, recienSumado) {
    const grupos = meta / 5;
    const H = 70;
    const sep = meta === 30 ? 26 : 0;
    const alto = grupos * H + sep;
    let svg = '';
    for (let g = 0; g < grupos; g++) {
      const y = g * H + (meta === 30 && g >= 3 ? sep : 0);
      svg += `<rect x="6" y="${y + 2}" width="68" height="64" rx="10" class="hueco"/>`;
      const n = Math.max(0, Math.min(5, p - g * 5));
      const ultimo = recienSumado && p > g * 5 && p <= g * 5 + 5 ? (p - 1) % 5 : -1;
      svg += grupo(n, y, ultimo);
    }
    if (meta === 30) {
      const y = 3 * H + sep / 2;
      svg += `<line x1="4" y1="${y}" x2="76" y2="${y}" class="divisoria"/>`;
    }
    return `<svg viewBox="0 0 80 ${alto}" preserveAspectRatio="xMidYMin meet">${svg}</svg>`;
  }

  function estado(p) {
    if (st.meta === 15) return p === 0 ? '' : `faltan ${15 - p}`;
    return p < 15 ? 'malas' : p < 30 ? 'buenas' : '';
  }

  function inicio() {
    App.despierto(true);
    const p = App.pantalla({ titulo: `Truco a ${st.meta}`, volver: App.menu, clase: 'truco', html: `
      <div class="truco-cols">
        ${[0, 1].map(e => `
          <div class="equipo eq${e}" data-e="${e}">
            <input class="nombre" value="${App.esc(st.nombres[e])}" maxlength="12" data-n="${e}" aria-label="Nombre del equipo">
            <div class="tantos"><b data-t></b><small data-s></small></div>
            <div class="palitos" data-f></div>
            <button class="btn grande mas ${e ? 'naranja' : 'celeste'}" data-mas="${e}" data-sin>+1</button>
            <button class="btn chico menos gris" data-menos="${e}" data-sin>−1</button>
          </div>`).join('')}
      </div>
      <div class="truco-pie">
        <button class="btn chico blanco" id="deshacer">↩︎ Deshacer</button>
        <button class="btn chico rosa" id="nueva">Nueva partida</button>
      </div>` });

    function pintar(sumado = -1) {
      [0, 1].forEach(e => {
        const col = p.querySelector(`.eq${e}`);
        col.querySelector('[data-t]').textContent = st.puntos[e];
        col.querySelector('[data-s]').textContent = estado(st.puntos[e]);
        col.querySelector('[data-f]').innerHTML = fosforos(st.puntos[e], st.meta, sumado === e);
        col.querySelector('[data-mas]').disabled = st.ganador !== null;
        col.querySelector('[data-menos]').disabled = st.puntos[e] === 0;
        col.classList.toggle('gano', st.ganador === e);
      });
      p.querySelector('#deshacer').disabled = !st.hist.length;
    }

    function cambiar(e, d) {
      const v = st.puntos[e] + d;
      if (v < 0 || v > st.meta || (d > 0 && st.ganador !== null)) return;
      st.puntos[e] = v;
      st.hist.push([e, d]);
      if (st.hist.length > 300) st.hist.shift();
      if (d > 0) { Sonido.fosforo(); App.vibrar(25); } else Sonido.restar();
      const tantos = p.querySelector(`.eq${e} .tantos`);
      tantos.classList.remove('pop'); void tantos.offsetWidth; tantos.classList.add('pop');
      if (v === st.meta) st.ganador = e;
      else if (st.ganador === e) st.ganador = null;
      guardar();
      pintar(d > 0 ? e : -1);
      if (st.ganador === e && d > 0) festejar(e);
    }

    function festejar(e) {
      Sonido.ganar();
      App.confeti(150);
      App.vibrar([100, 60, 100, 60, 300]);
      const d = document.createElement('div');
      d.className = 'modal ver';
      d.innerHTML = `<div class="modal-caja ganador">
        <span class="emo">🏆</span>
        <h2>¡Ganó ${App.esc(st.nombres[e])}!</h2>
        <p>${st.puntos[0]} a ${st.puntos[1]}</p>
        <div class="fila"><button class="btn gris" data-r="ver">Ver tanteador</button><button class="btn verde" data-r="nueva">Otra partida</button></div>
      </div>`;
      document.body.appendChild(d);
      d.addEventListener('click', ev => {
        const b = ev.target.closest('[data-r]');
        if (!b) return;
        d.remove();
        if (b.dataset.r === 'nueva') nuevaPartida();
      });
    }

    async function nuevaPartida() {
      const d = document.createElement('div');
      d.className = 'modal ver';
      d.innerHTML = `<div class="modal-caja">
        <h2>Nueva partida</h2>
        <p>¿A cuántos juegan?</p>
        <div class="fila"><button class="btn celeste" data-m="15">A 15</button><button class="btn naranja" data-m="30">A 30</button></div>
        <button class="btn chico gris" data-m="0">Cancelar</button>
      </div>`;
      document.body.appendChild(d);
      d.addEventListener('click', ev => {
        const b = ev.target.closest('[data-m]');
        if (!b) return;
        d.remove();
        const m = +b.dataset.m;
        if (!m) return;
        const nombres = st.nombres;
        st = nuevo(m);
        st.nombres = nombres;
        guardar();
        inicio();
      });
    }

    p.querySelectorAll('[data-mas]').forEach(b => { b.onclick = () => cambiar(+b.dataset.mas, 1); });
    p.querySelectorAll('[data-menos]').forEach(b => { b.onclick = () => cambiar(+b.dataset.menos, -1); });
    p.querySelectorAll('[data-n]').forEach(inp => {
      inp.oninput = () => { st.nombres[+inp.dataset.n] = inp.value.trim() || (+inp.dataset.n ? 'Ellos' : 'Nosotros'); guardar(); };
      inp.onkeydown = ev => { if (ev.key === 'Enter') inp.blur(); };
    });
    p.querySelector('#deshacer').onclick = () => {
      const u = st.hist.pop();
      if (!u) return;
      st.puntos[u[0]] -= u[1];
      if (st.ganador !== null && st.puntos[st.ganador] < st.meta) st.ganador = null;
      Sonido.restar();
      guardar();
      pintar();
    };
    p.querySelector('#nueva').onclick = nuevaPartida;
    pintar();
    App.alSalir(() => App.despierto(false));
  }

  return { inicio };
})();
