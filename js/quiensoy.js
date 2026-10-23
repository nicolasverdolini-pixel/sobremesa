// ¿Quién soy?: el celu va en la frente y los demás dan pistas.
// Inclinar la cabeza para abajo = acierto; para arriba = paso.

const QuienSoy = (() => {
  const CATS = ['famosos', 'peliculas', 'animales', 'objetos', 'futbolistas', 'personajes'];
  let cat = 'famosos';
  let duracion = App.leer('quiensoy:tiempo', 60);
  let sensor = false;

  function inicio() {
    App.despierto(false);
    const p = App.pantalla({ titulo: '¿Quién soy?', volver: App.menu, clase: 'qs-inicio', html: `
      <p class="bajada">Elegí una categoría</p>
      <div class="cats">
        ${CATS.map(k => `
          <button class="btn cat" data-k="${k}" style="--c:${PALABRAS[k].color}">
            <span class="emo">${PALABRAS[k].emoji}</span><span>${PALABRAS[k].nombre}</span>
          </button>`).join('')}
      </div>
      <div class="opcion">
        <span>Tiempo por ronda</span>
        <div class="segmentos" id="tiempo">
          ${[30, 60, 90].map(s => `<button data-s="${s}" class="${s === duracion ? 'on' : ''}">${s} s</button>`).join('')}
        </div>
      </div>
      <div class="como">
        <b>Cómo se juega</b>
        <p>Uno se pone el celu en la frente sin mirar. Los demás le dan pistas (¡sin decir la palabra!). Si la adivina, baja la cabeza; si quiere pasar, la sube. Gana el que más acierta en su turno.</p>
      </div>` });
    p.querySelectorAll('.cat').forEach(b => { b.onclick = () => { cat = b.dataset.k; preparar(); }; });
    p.querySelectorAll('#tiempo button').forEach(b => {
      b.onclick = () => {
        duracion = +b.dataset.s;
        App.guardar('quiensoy:tiempo', duracion);
        p.querySelectorAll('#tiempo button').forEach(x => x.classList.toggle('on', x === b));
      };
    });
  }

  function preparar() {
    App.despierto(false);
    const c = PALABRAS[cat];
    const p = App.pantalla({ titulo: c.nombre, volver: inicio, clase: 'qs-prep', estilo: `--c:${c.color}`, html: `
      <div class="ilus-frente" aria-hidden="true">
        <div class="ilus-celu">?</div>
        <div class="ilus-cara">😄</div>
      </div>
      <h2>Poné el celu en la frente</h2>
      <p class="bajada">Parado, con la pantalla mirando a los demás.</p>
      <div class="gestos">
        <div class="gesto ok"><span class="flechita">⬇</span><b>Cabeza abajo</b><small>¡La sé!</small></div>
        <div class="gesto paso"><span class="flechita">⬆</span><b>Cabeza arriba</b><small>Paso</small></div>
      </div>
      <p class="nota">Si el celu no detecta el movimiento, usá los botones de abajo de la pantalla.</p>
      <button class="btn grande verde" id="empezar" data-sin>¡Empezar!</button>` });
    p.querySelector('#empezar').onclick = async () => {
      Sonido.desbloquear();
      await pedirSensor();
      jugar();
    };
  }

  // En iPhone hay que pedir permiso para leer la inclinación (y tiene que ser al tocar un botón).
  async function pedirSensor() {
    const D = window.DeviceOrientationEvent;
    if (!D) { sensor = false; return; }
    if (typeof D.requestPermission === 'function') {
      try { sensor = (await D.requestPermission()) === 'granted'; } catch (e) { sensor = false; }
    } else sensor = true;
  }

  // Ajusta el tamaño de letra para que la palabra más larga entre en el ancho.
  function tamano(texto) {
    const larga = Math.max(5, ...texto.split(' ').map(w => w.length));
    return `min(${Math.min(19, 150 / larga).toFixed(1)}vw, ${Math.round(110 * 7 / Math.max(7, larga))}px)`;
  }

  function jugar() {
    const c = PALABRAS[cat];
    let estado = 'cuenta';
    let palabra = null, bloqueado = true, fin = 0, ultimoSeg = null;
    let base = null, armado = false;
    const resultados = [];
    const timers = [];
    let intervalo = null;

    const p = App.pantalla({ clase: 'qs-juego', estilo: `--c:${c.color}`, html: `
      <div class="qs-arriba">
        <button class="btn-redondo" id="salir" aria-label="Salir">✕</button>
        <div class="reloj" id="reloj" style="--p:1"><span>${duracion}</span></div>
        <div class="contador"><b id="puntos">0</b><small>aciertos</small></div>
      </div>
      <div class="qs-palabra" id="palabra"></div>
      <div class="qs-botones">
        <button class="btn naranja" id="bpaso" data-sin>Paso</button>
        <button class="btn verde" id="bok" data-sin>¡Acierto!</button>
      </div>
      <div class="flash" id="flash"></div>` });
    const $ = id => p.querySelector('#' + id);
    const elPal = $('palabra'), elReloj = $('reloj'), elNum = elReloj.querySelector('span'), flash = $('flash');

    App.despierto(true);

    const mostrar = (txt, clase = '') => { elPal.innerHTML = `<span class="${clase}" style="font-size:${tamano(txt)}">${App.esc(txt)}</span>`; };

    function siguiente() {
      palabra = App.sacar('qs:' + cat, c.palabras);
      mostrar(palabra, 'entra');
      bloqueado = false;
    }

    function marcar(ok) {
      if (estado !== 'juego' || bloqueado) return;
      bloqueado = true;
      resultados.push({ palabra, ok });
      if (ok) { Sonido.acierto(); App.vibrar(60); } else { Sonido.paso(); App.vibrar([30, 40, 30]); }
      $('puntos').textContent = resultados.filter(r => r.ok).length;
      flash.textContent = ok ? '¡Bien!' : 'Paso';
      flash.className = 'flash ver ' + (ok ? 'ok' : 'paso');
      timers.push(setTimeout(() => {
        flash.className = 'flash';
        if (estado === 'juego') siguiente();
      }, 750));
    }

    // Lectura de la inclinación: se toma como "derecho" la posición del arranque.
    function onOri(e) {
      if (e.beta == null || estado !== 'juego') return;
      if (base === null) { base = e.beta; return; }
      let d = e.beta - base;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      if (!armado) { if (Math.abs(d) < 20) armado = true; return; }
      if (bloqueado) return;
      if (d > 45) { armado = false; marcar(true); }
      else if (d < -45) { armado = false; marcar(false); }
    }
    if (sensor) window.addEventListener('deviceorientation', onOri);

    function tic() {
      const quedan = Math.max(0, fin - Date.now());
      const s = Math.ceil(quedan / 1000);
      elReloj.style.setProperty('--p', (quedan / (duracion * 1000)).toFixed(3));
      if (s !== ultimoSeg) {
        ultimoSeg = s;
        elNum.textContent = s;
        if (s <= 10 && s > 0) { Sonido.tic(); elReloj.classList.add('apurado'); }
      }
      if (quedan <= 0) terminar();
    }

    function terminar() {
      estado = 'fin';
      clearInterval(intervalo);
      if (!bloqueado && palabra) resultados.push({ palabra, ok: false });
      bloqueado = true;
      Sonido.fin();
      App.vibrar([200, 100, 200]);
      flash.textContent = '¡Tiempo!';
      flash.className = 'flash ver fin';
      timers.push(setTimeout(() => final(resultados), 1600));
    }

    // Cuenta regresiva: da tiempo a ponerse el celu en la frente.
    let n = 3;
    function contar() {
      if (n > 0) {
        mostrar(String(n), 'cuenta');
        Sonido.cuenta();
        n--;
        timers.push(setTimeout(contar, 1000));
      } else {
        Sonido.ya();
        estado = 'juego';
        base = null;
        armado = true;
        fin = Date.now() + duracion * 1000;
        siguiente();
        intervalo = setInterval(tic, 100);
      }
    }
    mostrar('Preparate…', 'cuenta-chica');
    timers.push(setTimeout(contar, 900));

    $('bok').onclick = () => marcar(true);
    $('bpaso').onclick = () => marcar(false);
    $('salir').onclick = async () => {
      if (await App.preguntar('¿Cortar la ronda?', 'Sí, salir', 'Seguir')) preparar();
    };

    App.alSalir(() => {
      estado = 'fin';
      clearInterval(intervalo);
      timers.forEach(clearTimeout);
      window.removeEventListener('deviceorientation', onOri);
      App.despierto(false);
    });
  }

  function final(resultados) {
    const c = PALABRAS[cat];
    const ok = resultados.filter(r => r.ok).length;
    const p = App.pantalla({ titulo: c.nombre, volver: inicio, clase: 'qs-final', estilo: `--c:${c.color}`, html: `
      <div class="puntaje">
        <div class="gran-num">${ok}</div>
        <p>${ok === 1 ? 'acierto' : 'aciertos'}</p>
        <p class="frase">${frase(ok)}</p>
      </div>
      <ul class="lista-res">
        ${resultados.length ? resultados.map(r => `<li class="${r.ok ? 'ok' : 'no'}"><span>${r.ok ? '✓' : '✗'}</span>${App.esc(r.palabra)}</li>`).join('') : '<li class="vacio">No salió ninguna palabra.</li>'}
      </ul>
      <div class="acciones">
        <button class="btn grande verde" id="otra">Otra ronda</button>
        <button class="btn violeta" id="cats">Cambiar categoría</button>
      </div>` });
    if (ok > 0) { Sonido.ganar(); if (ok >= 5) App.confeti(); }
    p.querySelector('#otra').onclick = preparar;
    p.querySelector('#cats').onclick = inicio;
  }

  function frase(n) {
    if (n === 0) return 'Uh… ¡la próxima sale!';
    if (n < 4) return '¡Bien ahí!';
    if (n < 8) return '¡Muy bien! Estás on fire 🔥';
    return '¡Sos un crack! 🏆';
  }

  return { inicio };
})();
