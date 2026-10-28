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
    let ws = null, cerrado = false, intentos = 0, latido = null, reintento = null, ultimo = Date.now(), reemplazado = false;

    // Siempre hay una sola conexión viva: los avisos de una conexión vieja se ignoran.
    // (Si no, dos conexiones con la misma identidad se pisan entre sí en el servidor.)
    function abrir() {
      clearTimeout(reintento);
      if (ws) { const viejo = ws; ws = null; viejo.onclose = viejo.onmessage = viejo.onerror = null; try { viejo.close(); } catch (e) {} }
      const este = new WebSocket(`${SERVIDOR}/sala/${codigo}?nombre=${encodeURIComponent(nombre)}&id=${id}`);
      ws = este;
      ultimo = Date.now();
      este.onopen = () => { if (ws === este) { intentos = 0; ultimo = Date.now(); eventos.conexion(true); } };
      este.onmessage = e => {
        if (ws !== este) return;
        ultimo = Date.now();
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === 'bienvenida') { id = m.id; App.guardar('red:id:' + codigo, id); eventos.bienvenida(id, m.estado); }
        else if (m.t === 'presencia') {
          // Si el servidor no nos ve en la sala, la conexión quedó colgada: se reabre.
          if (id && !m.jugadores.some(j => j.id === id)) { reintento = setTimeout(abrir, 300); return; }
          eventos.presencia(m);
        } else if (m.t === 'msg') eventos.mensaje(m.de, m.d);
      };
      este.onclose = ev => {
        if (ws !== este) return;
        eventos.conexion(false);
        // 4000 = la misma persona entró desde otra pestaña o conexión: esta se queda quieta.
        if (ev.code === 4000) reemplazado = true;
        else if (!cerrado) reintento = setTimeout(abrir, Math.min(5000, 400 * 2 ** intentos++));
      };
      este.onerror = () => { try { este.close(); } catch (e) {} };
    }

    const enviar = o => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(o)); return true; } return false; };
    // Latido: el servidor contesta cada ping. Si hace rato que no llega nada, la conexión murió
    // sin avisar (pasa al bloquear el celu o si se corta el wifi) y se reabre.
    const MUERTA = 25000;
    latido = setInterval(() => {
      if (cerrado || reemplazado) return;
      if (Date.now() - ultimo > MUERTA) { eventos.conexion(false); intentos = 0; abrir(); return; }
      enviar({ t: 'ping' });
    }, 8000);
    const alVolver = () => {
      if (document.hidden || cerrado) return;
      if (reemplazado) { reemplazado = false; intentos = 0; abrir(); return; }
      if (!ws || ws.readyState > 1 || Date.now() - ultimo > 12000) { intentos = 0; abrir(); }
      else enviar({ t: 'ping' });
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
