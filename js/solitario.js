// Solitario (Klondike): ordená las cartas en las 4 pilas, del As al Rey, por palo.

const Solitario = (() => {
  const PALOS = ['♠', '♥', '♦', '♣'];
  const NUM = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const rojo = c => c.s === 1 || c.s === 2;

  let st = App.leer('solitario:partida', null);
  const guardar = () => App.guardar('solitario:partida', st);
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function nueva(sacar) {
    const mazo = App.mezclar(Array.from({ length: 52 }, (_, i) => ({ s: i % 4, r: Math.floor(i / 4) + 1, up: false })));
    const tab = Array.from({ length: 7 }, (_, c) => mazo.splice(0, c + 1));
    tab.forEach(col => { col[col.length - 1].up = true; });
    return { stock: mazo, waste: [], found: [[], [], [], []], tab, movs: 0, tiempo: 0, sacar, hist: [], gano: false };
  }

  // ---------- Reglas ----------
  const tope = p => p[p.length - 1];
  const vaAFundacion = (c, f) => (!f.length ? c.r === 1 : tope(f).s === c.s && tope(f).r === c.r - 1);
  const vaAColumna = (c, col) => (!col.length ? c.r === 13 : tope(col).up && rojo(tope(col)) !== rojo(c) && tope(col).r === c.r + 1);

  function foto() {
    const { hist, ...resto } = st;
    return JSON.stringify(resto);
  }
  function anotar() {
    st.hist.push(foto());
    if (st.hist.length > 150) st.hist.shift();
  }
  function destapar() { st.tab.forEach(col => { if (col.length && !tope(col).up) tope(col).up = true; }); }

  // Origen: { de: 'waste' } | { de: 'tab', col, i } | { de: 'found', f }. Destino: { a: 'found', f } | { a: 'tab', col }.
  function cartasDe(o) {
    if (o.de === 'waste') return st.waste.length ? [tope(st.waste)] : [];
    if (o.de === 'found') return st.found[o.f].length ? [tope(st.found[o.f])] : [];
    return st.tab[o.col].slice(o.i);
  }

  function puede(o, d) {
    const cs = cartasDe(o);
    if (!cs.length || !cs[0].up) return false;
    if (d.a === 'found') return cs.length === 1 && vaAFundacion(cs[0], st.found[d.f]);
    if (o.de === 'tab' && o.col === d.col) return false;
    return vaAColumna(cs[0], st.tab[d.col]);
  }

  function mover(o, d) {
    if (!puede(o, d)) return false;
    anotar();
    let cs;
    if (o.de === 'waste') cs = [st.waste.pop()];
    else if (o.de === 'found') cs = [st.found[o.f].pop()];
    else cs = st.tab[o.col].splice(o.i);
    if (d.a === 'found') st.found[d.f].push(...cs);
    else st.tab[d.col].push(...cs);
    destapar();
    st.movs++;
    return true;
  }

  // Con un toque: primero a las pilas de arriba, si no, a la mejor columna.
  function mejorDestino(o) {
    const cs = cartasDe(o);
    if (!cs.length) return null;
    if (cs.length === 1 && o.de !== 'found') {
      for (let f = 0; f < 4; f++) if (puede(o, { a: 'found', f })) return { a: 'found', f };
    }
    const cols = [...Array(7).keys()].sort((a, b) => (st.tab[b].length > 0) - (st.tab[a].length > 0));
    for (const col of cols) if (puede(o, { a: 'tab', col })) {
      // Un Rey que ya está solo en su columna no se mueve a otra vacía.
      if (o.de === 'tab' && o.i === 0 && !st.tab[col].length) continue;
      return { a: 'tab', col };
    }
    return null;
  }

  function robar() {
    anotar();
    if (!st.stock.length) {
      st.stock = st.waste.reverse().map(c => ({ ...c, up: false }));
      st.waste = [];
    } else {
      for (let k = 0; k < st.sacar && st.stock.length; k++) { const c = st.stock.pop(); c.up = true; st.waste.push(c); }
    }
    st.movs++;
  }

  const todoALaVista = () => !st.stock.length && !st.waste.length && st.tab.every(col => col.every(c => c.up));
  const gano = () => st.found.every(f => f.length === 13);

  // ---------- Pantallas ----------
  function inicio() {
    App.despierto(false);
    const hay = st && !st.gano && st.movs > 0;
    const pref = App.leer('solitario:sacar', 1);
    const ganadas = App.leer('solitario:ganadas', 0);
    const p = App.pantalla({ titulo: 'Solitario', volver: App.menu, clase: 'sol-inicio', html: `
      <div class="sol-portada">${[[0, 13], [1, 1], [2, 12], [3, 11]].map(([s, r], k) => `<span class="carta ${s === 1 || s === 2 ? 'roja' : ''}" style="--g:${(k - 1.5) * 9}deg">${carta({ s, r, up: true })}</span>`).join('')}</div>
      ${ganadas ? `<p class="bajada">Ganaste ${ganadas} ${ganadas === 1 ? 'vez' : 'veces'} 🏆</p>` : ''}
      ${hay ? `<button class="btn grande amarillo" id="seguir">▶ Seguir partida <small>(${st.movs} movimientos)</small></button>` : ''}
      <div class="opcion"><span>Sacar del mazo</span><div class="segmentos" id="sacar">
        <button data-v="1" class="${pref === 1 ? 'on' : ''}">De a 1</button><button data-v="3" class="${pref === 3 ? 'on' : ''}">De a 3 (difícil)</button></div></div>
      <div class="como"><b>Cómo se juega</b>
        <p>Armá las 4 pilas de arriba con cada palo en orden, del As al Rey. En las columnas, las cartas se ponen de mayor a menor alternando rojo y negro, y en un lugar vacío solo va un Rey. Arrastrá las cartas con el dedo o tocalas y van solas al mejor lugar. Tocá el mazo para sacar cartas.</p></div>
      <div class="acciones"><button class="btn grande verde" id="nueva">${hay ? 'Partida nueva' : '¡Repartir!'}</button></div>` });
    p.querySelectorAll('#sacar button').forEach(b => {
      b.onclick = () => { App.guardar('solitario:sacar', +b.dataset.v); p.querySelectorAll('#sacar button').forEach(x => x.classList.toggle('on', x === b)); };
    });
    if (hay) p.querySelector('#seguir').onclick = jugar;
    p.querySelector('#nueva').onclick = async () => {
      if (hay && !(await App.preguntar('¿Repartir de nuevo? Se pierde la partida que tenías.', 'Sí', 'No'))) return;
      st = nueva(App.leer('solitario:sacar', 1));
      guardar();
      Sonido.carta();
      jugar();
    };
  }

  const carta = c => c.up
    ? `<span class="c-num">${NUM[c.r]}</span><span class="c-palo">${PALOS[c.s]}</span><span class="c-grande">${c.r > 10 ? NUM[c.r] : PALOS[c.s]}</span>`
    : '';

  function jugar() {
    App.despierto(true);
    const p = App.pantalla({ titulo: 'Solitario', volver: inicio, clase: 'solitario', html: `
      <div class="sol-info"><span id="movs"></span><span id="reloj"></span></div>
      <div class="sol-arriba">
        <div class="sol-pila mazo" data-zona="stock"></div>
        <div class="sol-pila descarte" data-zona="waste"></div>
        <div></div>
        ${[0, 1, 2, 3].map(f => `<div class="sol-pila fund" data-zona="found" data-f="${f}"></div>`).join('')}
      </div>
      <div class="sol-mesa" id="mesa">${[...Array(7).keys()].map(c => `<div class="sol-col" data-zona="tab" data-col="${c}"></div>`).join('')}</div>
      <div class="sd-herramientas sol-herr">
        <button class="herr" id="deshacer"><span>↩︎</span>Deshacer</button>
        <button class="herr" id="auto" disabled><span>⚡</span>Terminar solo</button>
        <button class="herr" id="nueva"><span>🔄</span>Repartir</button>
      </div>` });
    const mesa = p.querySelector('#mesa');

    function cartaEl(c, attrs = '', estilo = '') {
      return `<div class="carta ${c.up ? (rojo(c) ? 'roja' : '') : 'dorso'}" ${attrs} style="${estilo}">${carta(c)}</div>`;
    }

    function pintar() {
      const W = p.querySelector('.sol-col').clientWidth;
      const H = W * 1.4;
      p.style.setProperty('--cw', W + 'px');
      p.querySelector('[data-zona="stock"]').innerHTML = st.stock.length ? cartaEl({ up: false }) : '<span class="vacio">↻</span>';
      const vis = st.waste.slice(st.sacar === 3 ? -3 : -1);
      p.querySelector('[data-zona="waste"]').innerHTML = vis.map((c, k) => cartaEl(c, k === vis.length - 1 ? 'data-o="waste"' : '', `left:${k * W * 0.22}px`)).join('');
      st.found.forEach((f, i) => {
        p.querySelector(`[data-zona="found"][data-f="${i}"]`).innerHTML = f.length ? cartaEl(tope(f), `data-o="found" data-f="${i}"`) : '<span class="vacio">A</span>';
      });
      // Columnas: las tapadas más juntas; si la columna es muy larga, se aprietan.
      const alto = mesa.clientHeight || 400;
      st.tab.forEach((col, ci) => {
        const tapadas = col.filter(c => !c.up).length, vistas = col.length - tapadas;
        let dUp = H * 0.28, dDown = H * 0.12;
        const total = H + tapadas * dDown + Math.max(0, vistas - 1) * dUp;
        if (total > alto) { const k = (alto - H) / (total - H); dUp *= k; dDown *= k; }
        let y = 0;
        p.querySelector(`[data-col="${ci}"]`).innerHTML = col.map((c, i) => {
          const html = cartaEl(c, c.up ? `data-o="tab" data-col="${ci}" data-i="${i}"` : '', `top:${y}px`);
          y += c.up ? dUp : dDown;
          return html;
        }).join('') || '<span class="vacio">K</span>';
      });
      p.querySelector('#movs').textContent = `${st.movs} movimientos`;
      p.querySelector('#reloj').textContent = `⏱ ${fmt(st.tiempo)}`;
      p.querySelector('#deshacer').disabled = !st.hist.length;
      p.querySelector('#auto').disabled = !(todoALaVista() && !gano());
    }

    function despuesDeMover() {
      guardar();
      pintar();
      if (gano() && !st.gano) ganar();
    }

    function ganar() {
      st.gano = true;
      guardar();
      clearInterval(intervalo);
      App.guardar('solitario:ganadas', App.leer('solitario:ganadas', 0) + 1);
      Sonido.ganar();
      App.confeti(180);
      setTimeout(() => {
        const d = document.createElement('div');
        d.className = 'modal ver';
        d.innerHTML = `<div class="modal-caja ganador"><span class="emo">🏆</span><h2>¡Ganaste!</h2><p>${st.movs} movimientos · ${fmt(st.tiempo)}</p>
          <div class="fila"><button class="btn gris" data-r="menu">Salir</button><button class="btn verde" data-r="otra">Otra</button></div></div>`;
        document.body.appendChild(d);
        d.addEventListener('click', e => {
          const b = e.target.closest('[data-r]');
          if (!b) return;
          d.remove();
          if (b.dataset.r === 'otra') { st = nueva(st.sacar); guardar(); jugar(); } else inicio();
        });
      }, 900);
    }

    const origenDe = el => el.dataset.o === 'waste' ? { de: 'waste' }
      : el.dataset.o === 'found' ? { de: 'found', f: +el.dataset.f }
      : { de: 'tab', col: +el.dataset.col, i: +el.dataset.i };

    function destinoEn(x, y) {
      const z = document.elementFromPoint(x, y)?.closest('[data-zona]');
      if (!z) return null;
      if (z.dataset.zona === 'found') return { a: 'found', f: +z.dataset.f };
      if (z.dataset.zona === 'tab') return { a: 'tab', col: +z.dataset.col };
      return null;
    }

    function intentar(o, d) {
      if (d && mover(o, d)) { Sonido.clac(d.a === 'found'); App.vibrar(15); despuesDeMover(); return true; }
      return false;
    }

    // Arrastrar con el dedo; si casi no se movió, cuenta como toque.
    let arrastre = null;
    p.addEventListener('pointerdown', e => {
      const el = e.target.closest('.carta[data-o]');
      if (!el) return;
      const o = origenDe(el);
      const grupo = o.de === 'tab' ? [...p.querySelectorAll(`.sol-col[data-col="${o.col}"] .carta`)].slice(o.i) : [el];
      arrastre = { o, grupo, x0: e.clientX, y0: e.clientY, movio: false, id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });
    p.addEventListener('pointermove', e => {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      const dx = e.clientX - arrastre.x0, dy = e.clientY - arrastre.y0;
      if (!arrastre.movio && Math.hypot(dx, dy) < 8) return;
      arrastre.movio = true;
      arrastre.grupo.forEach(g => { g.style.transform = `translate(${dx}px, ${dy}px)`; g.classList.add('arrastrada'); });
    });
    const soltar = e => {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      const a = arrastre;
      arrastre = null;
      if (!a.movio) {
        if (!intentar(a.o, mejorDestino(a.o))) { a.grupo[0].classList.add('no'); setTimeout(() => a.grupo[0].classList.remove('no'), 300); }
        return;
      }
      a.grupo.forEach(g => { g.style.visibility = 'hidden'; });
      const d = destinoEn(e.clientX, e.clientY);
      a.grupo.forEach(g => { g.style.visibility = ''; });
      if (!intentar(a.o, d)) pintar();
    };
    p.addEventListener('pointerup', soltar);
    p.addEventListener('pointercancel', soltar);

    p.querySelector('[data-zona="stock"]').onclick = () => { robar(); Sonido.carta(); despuesDeMover(); };
    p.querySelector('#deshacer').onclick = () => {
      const h = st.hist.pop();
      if (!h) return;
      st = { ...JSON.parse(h), hist: st.hist };
      Sonido.restar();
      despuesDeMover();
    };
    p.querySelector('#nueva').onclick = async () => {
      if (await App.preguntar('¿Repartir de nuevo?', 'Sí', 'No')) { st = nueva(st.sacar); guardar(); Sonido.carta(); jugar(); }
    };
    // Terminar solo: va subiendo las cartas de a una, con un ritmito.
    p.querySelector('#auto').onclick = async () => {
      while (!gano()) {
        let hecho = false;
        for (let col = 0; col < 7 && !hecho; col++) {
          if (!st.tab[col].length) continue;
          const o = { de: 'tab', col, i: st.tab[col].length - 1 };
          for (let f = 0; f < 4 && !hecho; f++) if (mover(o, { a: 'found', f })) hecho = true;
        }
        if (!hecho) break;
        Sonido.clac(true);
        pintar();
        await new Promise(r => setTimeout(r, 90));
      }
      despuesDeMover();
    };

    const intervalo = setInterval(() => {
      if (document.hidden || st.gano || !st.movs) return;
      st.tiempo++;
      p.querySelector('#reloj').textContent = `⏱ ${fmt(st.tiempo)}`;
      if (st.tiempo % 10 === 0) guardar();
    }, 1000);
    const alCambiarTamano = () => pintar();
    window.addEventListener('resize', alCambiarTamano);
    App.alSalir(() => { clearInterval(intervalo); window.removeEventListener('resize', alCambiarTamano); guardar(); App.despierto(false); });
    pintar();
    requestAnimationFrame(pintar);
  }

  return { inicio };
})();
