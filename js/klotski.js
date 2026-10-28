// Klotski: mové los bloques dentro de la caja hasta sacar el bloque grande por la salida de abajo.

const Klotski = (() => {
  const K = KlotskiReglas;
  // Niveles generados y verificados con el resolvedor: [piezas, mínimo de movimientos].
  const NIVELES = {"facil":[["G11 V30 V33 V03 V00 C02 C20 C14 C32 C24 C10",13],["G11 V30 V01 V03 V33 C23 C20 C14 C10 C00 C24",16],["G21 V00 V12 V02 V10 C14 C23 C34 C24 C30 C20",17],["G21 V10 V00 V13 V02 C04 C33 C30 C23 C34 C20",19],["G11 V03 V01 V33 H20 H00 C24 C32 C13 C23",20],["G11 V23 V31 V02 V00 C30 C14 C10 C33 C20 C13",23],["G21 V11 V13 V00 V02 C34 C24 C33 C23 C10 C20",24],["G01 V32 H20 H24 H13 H00 C31 C03 C04 C22",25]],"medio":[["G21 V33 V13 V03 V23 C30 C11 C00 C02 C20 C10",26],["G21 V23 V01 V10 V33 C12 C13 C30 C14 C03 C00",32],["G21 V03 H23 H20 H00 H01 C34 C02 C12 C13",35],["G11 V02 V00 V13 H24 C31 C32 C10 C23 C33 C04",39],["G20 V11 V02 V00 V23 C33 C22 C32 C34 C13 C10",42],["G21 V01 H00 H20 H04 H23 C12 C34 C13 C11",46],["G00 V12 V03 V31 H14 C34 C20 C22 C23 C30 C21",50],["G00 V20 V02 V32 H24 C31 C30 C13 C12 C23 C04",55]],"dificil":[["G01 V03 V31 V22 H14 C00 C34 C33 C13 C21 C20",56],["G00 V33 H22 H02 H20 H13 C24 C21 C31 C03",60],["G20 V13 V11 V33 H22 C03 C01 C24 C02 C23 C10",66],["G11 V30 V02 H23 H04 H00 C24 C20 C32 C34",70],["G11 V13 V03 H24 H00 H23 C20 C30 C01 C31",75],["G01 V33 V03 V31 V21 H14 C30 C00 C13 C10",80],["G11 V01 H10 H24 H03 H04 C00 C30 C31 C33",85],["G11 V01 H04 H24 H23 H03 C31 C00 C30 C32",90]],"experto":[["G01 V03 V21 H10 H23 H14 C30 C31 C00 C34",91],["G20 V23 V11 V33 H03 H04 C22 C00 C32 C02",94],["G00 V33 V30 H13 H04 H22 C03 C20 C02 C12",99],["G11 V30 V01 H04 H24 H03 C20 C32 C00 C23",109],["G20 V10 V01 V13 H24 H23 C32 C22 C00 C12",115],["V00 G10 V30 V02 H12 V32 C13 C23 C04 C34",116],["G01 V32 V30 V20 H24 H13 C03 C10 C04 C00",128],["G10 V02 V31 H13 H14 H12 C01 C30 C04 C34",156]]};
  const GRUPOS = { facil: ['Fácil', '🌱', 'verde'], medio: ['Medio', '🌿', 'celeste'], dificil: ['Difícil', '🌶️', 'naranja'], experto: ['Experto', '🔥', 'rojo'] };

  let hechos = App.leer('klotski:hechos', {}); // "grupo:i" -> mejor cantidad de movimientos

  function inicio() {
    App.despierto(false);
    const p = App.pantalla({ titulo: 'Klotski', volver: App.menu, clase: 'kl-inicio', html: `
      <div class="kl-portada">${mini(K.leer(NIVELES.experto.find(n => n[1] === 116)[0]))}</div>
      <p class="bajada">Mové los bloques con el dedo y sacá el <b>bloque grande</b> por la salida de abajo.</p>
      ${Object.entries(GRUPOS).map(([g, [nombre, emo, color]]) => `
        <h2 class="titulito">${emo} ${nombre}</h2>
        <div class="kl-niveles">${NIVELES[g].map(([, n], i) => {
          const h = hechos[g + ':' + i];
          return `<button class="btn ${color} kl-nivel ${h ? 'hecho' : ''}" data-g="${g}" data-i="${i}"><b>${i + 1}</b><small>${h ? '✓ ' + h : n + ' mín.'}</small></button>`;
        }).join('')}</div>`).join('')}
      <div class="como"><b>Cómo se juega</b><p>Arrastrá cualquier bloque hacia un lugar libre. El objetivo es llevar el bloque grande hasta la salida, abajo al medio. Cada nivel dice la cantidad mínima de movimientos: ¿podés igualarla? Si te trabás, pedí una pista.</p></div>` });
    p.querySelectorAll('.kl-nivel').forEach(b => { b.onclick = () => jugar(b.dataset.g, +b.dataset.i); });
  }

  // Dibujito estático del nivel (para la portada).
  function mini(piezas) {
    return `<div class="kl-caja chica">${piezas.map(p => bloque(p)).join('')}<div class="kl-salida"></div></div>`;
  }

  const bloque = (p, i = -1) => {
    const [w, h] = K.TAM[p.t];
    return `<div class="kl-bloque t${p.t}" data-i="${i}" style="left:${p.x * 25}%;top:${p.y * 20}%;width:${w * 25}%;height:${h * 20}%"><span></span></div>`;
  };

  function jugar(grupo, idx) {
    App.despierto(true);
    const [txt, minimo] = NIVELES[grupo][idx];
    let piezas = K.leer(txt);
    let movs = 0, termino = false;
    const hist = [];
    const p = App.pantalla({ titulo: `${GRUPOS[grupo][0]} ${idx + 1}`, volver: inicio, clase: 'klotski', html: `
      <div class="sd-info"><span id="movs"></span><span>Mínimo: ${minimo}</span></div>
      <div class="kl-marco"><div class="kl-caja" id="caja"></div><div class="kl-salida"><span>SALIDA</span></div></div>
      <div class="sd-herramientas">
        <button class="herr" id="deshacer"><span>↩︎</span>Deshacer</button>
        <button class="herr" id="reiniciar"><span>🔄</span>Reiniciar</button>
        <button class="herr" id="pista"><span>💡</span>Pista</button>
        <button class="herr" id="siguiente"><span>⏭</span>Siguiente</button>
      </div>` });
    const caja = p.querySelector('#caja');

    function pintar(marcar = -1) {
      caja.innerHTML = piezas.map((pz, i) => bloque(pz, i)).join('');
      if (marcar >= 0) caja.querySelector(`[data-i="${marcar}"]`)?.classList.add('pista');
      p.querySelector('#movs').textContent = `${movs} ${movs === 1 ? 'movimiento' : 'movimientos'}`;
      p.querySelector('#deshacer').disabled = !hist.length || termino;
    }

    // Mueve un paso la pieza i, si se puede, y anima solo ese bloque (sin redibujar todo).
    function paso(i, dx, dy) {
      const g = K.grilla(piezas);
      if (!K.puedeMover(piezas, g, i, dx, dy)) return false;
      hist.push(piezas.map(x => ({ ...x })));
      piezas[i] = { ...piezas[i], x: piezas[i].x + dx, y: piezas[i].y + dy };
      movs++;
      const el = caja.querySelector(`[data-i="${i}"]`);
      if (el) { el.style.left = piezas[i].x * 25 + '%'; el.style.top = piezas[i].y * 20 + '%'; }
      p.querySelector('#movs').textContent = `${movs} ${movs === 1 ? 'movimiento' : 'movimientos'}`;
      p.querySelector('#deshacer').disabled = false;
      Sonido.clac(false);
      if (K.gano(piezas)) ganar();
      return true;
    }

    function ganar() {
      termino = true;
      const el = caja.querySelector('.tG');
      if (el) setTimeout(() => el.classList.add('sale'), 120);
      const clave = grupo + ':' + idx;
      const antes = hechos[clave];
      if (!antes || movs < antes) { hechos[clave] = movs; App.guardar('klotski:hechos', hechos); }
      Sonido.ganar();
      App.confeti(150);
      setTimeout(() => {
        const d = document.createElement('div');
        d.className = 'modal ver';
        const perfecto = movs <= minimo;
        d.innerHTML = `<div class="modal-caja ganador"><span class="emo">${perfecto ? '🏆' : '🎉'}</span><h2>${perfecto ? '¡Perfecto!' : '¡Salió!'}</h2>
          <p>${movs} movimientos ${perfecto ? '(¡el mínimo!)' : '· el mínimo es ' + minimo}</p>
          <div class="fila"><button class="btn gris" data-r="niveles">Niveles</button><button class="btn verde" data-r="sig">Siguiente</button></div></div>`;
        document.body.appendChild(d);
        d.addEventListener('click', e => {
          const b = e.target.closest('[data-r]');
          if (!b) return;
          d.remove();
          b.dataset.r === 'sig' ? siguiente() : inicio();
        });
      }, 1100);
    }

    function siguiente() {
      const orden = Object.keys(GRUPOS);
      if (idx + 1 < NIVELES[grupo].length) jugar(grupo, idx + 1);
      else if (orden.indexOf(grupo) + 1 < orden.length) jugar(orden[orden.indexOf(grupo) + 1], 0);
      else inicio();
    }

    // Arrastrar: el bloque avanza de a una casilla siguiendo al dedo, mientras haya lugar.
    let drag = null;
    caja.addEventListener('pointerdown', e => {
      const el = e.target.closest('.kl-bloque');
      if (!el || termino) return;
      const r = caja.getBoundingClientRect();
      drag = { i: +el.dataset.i, x: e.clientX, y: e.clientY, cw: r.width / 4, ch: r.height / 5, id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      el.classList.add('agarrado');
    });
    caja.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      const horiz = Math.abs(dx) > Math.abs(dy);
      const pasoX = horiz ? Math.sign(dx) : 0, pasoY = horiz ? 0 : Math.sign(dy);
      const falta = horiz ? Math.abs(dx) / drag.cw : Math.abs(dy) / drag.ch;
      if (falta >= 0.5 && paso(drag.i, pasoX, pasoY)) {
        drag.x += pasoX * drag.cw;
        drag.y += pasoY * drag.ch;
        if (termino) drag = null;
      }
    });
    const soltar = () => { caja.querySelectorAll('.agarrado').forEach(x => x.classList.remove('agarrado')); drag = null; };
    caja.addEventListener('pointerup', soltar);
    caja.addEventListener('pointercancel', soltar);

    p.querySelector('#deshacer').onclick = () => {
      const h = hist.pop();
      if (!h || termino) return;
      piezas = h; movs = Math.max(0, movs - 1);
      Sonido.restar();
      pintar();
    };
    p.querySelector('#reiniciar').onclick = () => { if (termino) return; piezas = K.leer(txt); movs = 0; hist.length = 0; pintar(); };
    p.querySelector('#siguiente').onclick = siguiente;
    p.querySelector('#pista').onclick = () => {
      if (termino) return;
      const sol = K.resolver(piezas);
      if (!sol || !sol.length) return;
      const s = sol[0].desde;
      const i = piezas.findIndex(x => x.t === s.t && x.x === s.x && x.y === s.y);
      if (i < 0) return;
      Sonido.revelar();
      pintar(i);
      setTimeout(() => paso(i, sol[0].dx, sol[0].dy), 450);
    };
    App.alSalir(() => App.despierto(false));
    pintar();
  }

  return { inicio };
})();
