// Salas para jugar con varios celus: crear o unirse con un código, sala de espera y juegos en red.
//
// El celu del anfitrión lleva el juego: decide, guarda lo secreto y publica el estado.
// Cada juego en red es un objeto:
//   { id, nombre, emoji, minimo, opciones?(ctx) -> html, leerOpciones?(el),
//     empezar(ctx, op), accion(ctx, de, a), presencia?(ctx), vista(ctx) -> html, enlazar(el, ctx) }

const JUEGOS_RED = {};

const Sala = (() => {
  let conn = null, cod = '', yo = '', jugadores = [], anfitrion = '', estado = null, privado = null, conectado = false;
  let memoria = {}; // lo que solo sabe el anfitrión (ej.: quién es el impostor)
  let pantalla = null;

  const esAnfitrion = () => yo && yo === anfitrion;
  const nombreDe = id => (jugadores.find(j => j.id === id) || (estado && estado.nombres && { nombre: estado.nombres[id] }) || { nombre: '¿?' }).nombre;
  const guardarMemoria = () => App.guardar('red:memoria:' + cod, memoria);

  const ctx = {
    get yo() { return yo; },
    get jugadores() { return jugadores; },
    get estado() { return estado; },
    get privado() { return privado; },
    get memoria() { return memoria; },
    get esAnfitrion() { return esAnfitrion(); },
    get anfitrion() { return anfitrion; },
    nombreDe,
    // Solo el anfitrión: publica el estado para todos (y lo deja guardado en el servidor para los que vuelven).
    publicar(nuevo) {
      estado = nuevo;
      conn.guardar(nuevo);
      conn.todos({ tipo: 'estado', estado: nuevo });
      guardarMemoria();
    },
    secreto(id, datos) { memoria.privados = memoria.privados || {}; memoria.privados[id] = datos; conn.para(id, { tipo: 'privado', datos }); },
    accion(a) { conn.anfitrion({ tipo: 'accion', a }); },
    redibujar: () => dibujar(),
  };

  // ---------- Entrar ----------
  function inicio(codigoInicial = '') {
    salir(false);
    const ultima = App.leer('red:ultima', null);
    const volverA = ultima && ultima.codigo && Date.now() - ultima.cuando < 3 * 3600_000 && !codigoInicial ? ultima.codigo : '';
    const p = App.pantalla({ titulo: 'Jugar en red', volver: App.menu, clase: 'red-inicio', html: `
      <div class="ilus-grande">📱📡📱</div>
      ${volverA ? `<button class="btn grande amarillo" id="volver-sala">↩︎ Volver a la sala ${volverA}</button>` : ''}
      <p class="bajada">Cada uno juega desde su celu. Uno crea la sala y los demás entran con el código.</p>
      <label class="red-campo"><span>Tu nombre</span>
        <input id="nombre" maxlength="16" autocomplete="off" autocapitalize="words" placeholder="¿Cómo te llamás?" value="${App.esc(App.leer('red:nombre', ''))}">
      </label>
      <button class="btn grande verde" id="crear">✨ Crear sala</button>
      <div class="red-o">o</div>
      <div class="red-unirse">
        <input id="codigo" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="CÓDIGO" value="${App.esc(codigoInicial)}">
        <button class="btn grande violeta" id="unirse">Entrar</button>
      </div>
      <div class="como"><b>¿Cómo funciona?</b><p>Hace falta internet en todos los celus. El que crea la sala es el <b>anfitrión</b> 👑: elige el juego y lo arranca. Podés compartir el link por WhatsApp para que entren directo.</p></div>` });
    const inNombre = p.querySelector('#nombre'), inCodigo = p.querySelector('#codigo');
    inCodigo.addEventListener('input', () => { inCodigo.value = inCodigo.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    const nombreOk = () => {
      const n = inNombre.value.trim();
      if (!n) { inNombre.focus(); inNombre.classList.add('falta'); Sonido.error(); return null; }
      App.guardar('red:nombre', n);
      return n;
    };
    p.querySelector('#crear').onclick = () => { const n = nombreOk(); if (n) entrar(Red.codigoNuevo(), n, true); };
    p.querySelector('#unirse').onclick = () => {
      const n = nombreOk();
      if (!n) return;
      if (!Red.codigoValido(inCodigo.value)) { inCodigo.focus(); inCodigo.classList.add('falta'); Sonido.error(); return; }
      entrar(inCodigo.value, n, false);
    };
    if (volverA) p.querySelector('#volver-sala').onclick = () => { const n = nombreOk(); if (n) entrar(volverA, n, false); };
    if (codigoInicial && !inNombre.value) inNombre.focus();
  }

  function entrar(codigo, nombre, nueva) {
    cod = codigo;
    yo = App.leer('red:id:' + codigo, '');
    jugadores = []; anfitrion = ''; estado = null; privado = null; conectado = false;
    memoria = nueva ? {} : App.leer('red:memoria:' + codigo, {});
    if (nueva) App.guardar('red:memoria:' + codigo, {});
    App.guardar('red:ultima', { codigo, cuando: Date.now() });
    App.despierto(true);
    pantalla = App.pantalla({ titulo: 'Sala ' + codigo, volver: () => salir(true), confirmar: '¿Salir de la sala?', clase: 'red-sala', html: `
      <div class="red-estado" id="red-estado">Conectando…</div>
      <div id="sala-cuerpo"></div>` });
    App.alSalir(() => salir(false));
    conn = Red.conectar(codigo, nombre, {
      bienvenida(id, est) { yo = id; estado = est; dibujar(); },
      presencia(m) {
        const antes = new Set(jugadores.map(j => j.id));
        jugadores = m.jugadores;
        anfitrion = m.anfitrion;
        jugadores.filter(j => !antes.has(j.id) && antes.size).forEach(() => Sonido.toque());
        // El anfitrión le vuelve a mandar lo secreto a quien se reconecta.
        if (esAnfitrion() && estado && estado.juego && JUEGOS_RED[estado.juego]) {
          const pr = memoria.privados || {};
          jugadores.forEach(j => { if (pr[j.id]) conn.para(j.id, { tipo: 'privado', datos: pr[j.id] }); });
          JUEGOS_RED[estado.juego].presencia?.(ctx);
        }
        dibujar();
      },
      mensaje(de, d) {
        if (!d) return;
        if (d.tipo === 'estado' && de === anfitrion) { estado = d.estado; if (!estado || !estado.juego) privado = null; dibujar(); }
        else if (d.tipo === 'privado' && de === anfitrion) { privado = d.datos; dibujar(); }
        else if (d.tipo === 'accion' && esAnfitrion() && estado && JUEGOS_RED[estado.juego]) {
          JUEGOS_RED[estado.juego].accion(ctx, de, d.a);
          guardarMemoria();
          dibujar();
        }
      },
      conexion(si) { conectado = si; pintarEstado(); },
    });
  }

  function salir(alMenu) {
    if (conn) { conn.cerrar(); conn = null; }
    if (alMenu) App.menu();
  }

  function pintarEstado() {
    const el = pantalla && pantalla.querySelector('#red-estado');
    if (!el) return;
    el.className = 'red-estado ' + (conectado ? 'ok' : 'mal');
    el.textContent = conectado ? `🟢 Conectados: ${jugadores.length}` : '🟠 Reconectando…';
  }

  // ---------- Dibujar según el estado ----------
  function dibujar() {
    if (!pantalla || !pantalla.isConnected) return;
    pintarEstado();
    const cuerpo = pantalla.querySelector('#sala-cuerpo');
    const juego = estado && estado.juego && JUEGOS_RED[estado.juego];
    if (juego) {
      cuerpo.innerHTML = juego.vista(ctx);
      juego.enlazar(cuerpo, ctx);
      return;
    }
    lobby(cuerpo);
  }

  function lobby(cuerpo) {
    const link = `${location.origin}${location.pathname}?sala=${cod}`;
    cuerpo.innerHTML = `
      <div class="red-codigo">
        <small>Código de la sala</small>
        <div class="letras">${[...cod].map(l => `<span>${l}</span>`).join('')}</div>
        <button class="btn chico celeste" id="compartir">📤 Invitar por WhatsApp</button>
      </div>
      <h2 class="titulito">En la sala</h2>
      <div class="red-jugadores">
        ${jugadores.map(j => `<span class="${j.id === yo ? 'yo' : ''}">${j.id === anfitrion ? '👑 ' : ''}${App.esc(j.nombre)}</span>`).join('') || '<span>…</span>'}
      </div>
      ${esAnfitrion() ? `
        <h2 class="titulito">Elegí un juego</h2>
        <div class="red-juegos">
          ${Object.values(JUEGOS_RED).map(g => `
            <button class="tarjeta-juego ${g.color}" data-juego="${g.id}">
              <span class="emo">${g.emoji}</span>
              <span class="txt"><b>${g.nombre}</b><small>${jugadores.length < g.minimo ? `Hacen falta ${g.minimo} o más` : g.bajada}</small></span>
            </button>`).join('')}
        </div>
        <p class="nota">Próximamente en red: Tutti frutti, Lobo, Trivia y tablero a distancia.</p>`
      : `<div class="red-espera"><div class="puntitos"><i></i><i></i><i></i></div><p>Esperando que ${App.esc(nombreDe(anfitrion))} elija un juego…</p></div>`}`;
    cuerpo.querySelector('#compartir').onclick = async () => {
      const texto = `¡Sumate a mi sala de Sobremesa! Código: ${cod}`;
      try {
        if (navigator.share) await navigator.share({ title: 'Sobremesa', text: texto, url: link });
        else { await navigator.clipboard.writeText(`${texto} ${link}`); App.preguntar('Copiamos el link. Pegalo en WhatsApp 😉', 'Dale', 'Ok'); }
      } catch (e) {}
    };
    cuerpo.querySelectorAll('[data-juego]').forEach(b => {
      b.onclick = () => {
        const g = JUEGOS_RED[b.dataset.juego];
        if (jugadores.length < g.minimo) { Sonido.error(); return; }
        opcionesDe(g);
      };
    });
  }

  function opcionesDe(g) {
    if (!g.opciones) { g.empezar(ctx, {}); return; }
    const d = document.createElement('div');
    d.className = 'modal ver';
    d.innerHTML = `<div class="modal-caja red-opciones"><h2>${g.emoji} ${g.nombre}</h2>${g.opciones(ctx)}
      <div class="fila"><button class="btn gris" data-r="no">Volver</button><button class="btn verde" data-r="si">¡Empezar!</button></div></div>`;
    document.body.appendChild(d);
    d.querySelectorAll('.chips').forEach(ch => ch.querySelectorAll('.chip').forEach(c => {
      c.onclick = () => ch.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c));
    }));
    d.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      const op = b.dataset.r === 'si' ? g.leerOpciones(d) : null;
      d.remove();
      if (op) { memoria = {}; g.empezar(ctx, op); guardarMemoria(); }
    });
  }

  // El anfitrión vuelve a todos a la sala de espera.
  function aLaSala() { memoria = {}; ctx.publicar(null); privado = null; dibujar(); }
  ctx.aLaSala = aLaSala;

  return { inicio, ctx };
})();
