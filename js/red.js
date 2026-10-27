// Conexión con el servidor de salas, para jugar con varios celus a la vez.
// Se reconecta solo si se corta (por ejemplo, si el celu bloqueó la pantalla).

const Red = (() => {
  const SERVIDOR = 'wss://sobremesa-salas.raizapp.workers.dev';
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I ni O para no confundir con 1 y 0

  const codigoNuevo = () => Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
  const codigoValido = c => /^[A-Z]{4}$/.test(c);

  // eventos: { bienvenida(id, estado), presencia({ jugadores, anfitrion }), mensaje(de, d), conexion(bool) }
  function conectar(codigo, nombre, eventos) {
    let id = App.leer('red:id:' + codigo, '');
    let ws = null, cerrado = false, intentos = 0, latido = null, reintento = null;

    function abrir() {
      clearTimeout(reintento);
      ws = new WebSocket(`${SERVIDOR}/sala/${codigo}?nombre=${encodeURIComponent(nombre)}&id=${id}`);
      ws.onopen = () => { intentos = 0; eventos.conexion(true); };
      ws.onmessage = e => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === 'bienvenida') { id = m.id; App.guardar('red:id:' + codigo, id); eventos.bienvenida(id, m.estado); }
        else if (m.t === 'presencia') eventos.presencia(m);
        else if (m.t === 'msg') eventos.mensaje(m.de, m.d);
      };
      ws.onclose = () => {
        eventos.conexion(false);
        if (!cerrado) reintento = setTimeout(abrir, Math.min(5000, 400 * 2 ** intentos++));
      };
      ws.onerror = () => { try { ws.close(); } catch (e) {} };
    }

    const enviar = o => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(o)); return true; } return false; };
    latido = setInterval(() => enviar({ t: 'ping' }), 25000);
    const alVolver = () => {
      if (!document.hidden && !cerrado && (!ws || ws.readyState > 1)) { intentos = 0; abrir(); }
    };
    document.addEventListener('visibilitychange', alVolver);
    abrir();

    return {
      get id() { return id; },
      todos: d => enviar({ t: 'todos', d }),
      para: (a, d) => enviar({ t: 'para', a, d }),
      anfitrion: d => enviar({ t: 'anfitrion', d }),
      guardar: d => enviar({ t: 'guardar', d }),
      cerrar() {
        cerrado = true;
        clearInterval(latido);
        clearTimeout(reintento);
        document.removeEventListener('visibilitychange', alVolver);
        try { ws.close(); } catch (e) {}
      },
    };
  }

  return { conectar, codigoNuevo, codigoValido };
})();
