// Servidor de salas de Sobremesa (Cloudflare Worker + Durable Objects).
// Cada sala (código de 4 letras) es un objeto que reparte mensajes entre los celus conectados.
// El servidor no sabe de juegos: el celu del anfitrión lleva el juego y el servidor solo reenvía.
//
// Mensajes que manda un celu:
//   { t: 'todos', d }        -> a todos los de la sala
//   { t: 'para', a: id, d }  -> a un jugador en particular (ej.: su carta secreta)
//   { t: 'anfitrion', d }    -> al anfitrión (ej.: un voto)
//   { t: 'guardar', d }      -> (solo anfitrión) estado público, que reciben los que entran o vuelven
// Mensajes que recibe un celu:
//   { t: 'bienvenida', id, estado }, { t: 'presencia', jugadores, anfitrion }, { t: 'msg', de, d }

import { DurableObject } from 'cloudflare:workers';

const CORS = { 'Access-Control-Allow-Origin': '*' };
const MAX_JUGADORES = 16;
const ESPERA_ANFITRION = 15_000;     // si el anfitrión se va, se espera esto antes de pasarle el mando a otro
const BORRAR_SALA_VACIA = 3 * 3600_000;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/') return new Response('Sobremesa: servidor de salas funcionando 🎲', { headers: CORS });
    const m = url.pathname.match(/^\/sala\/([A-Z]{4})$/);
    if (!m) return new Response('No encontrado', { status: 404, headers: CORS });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Se espera WebSocket', { status: 426, headers: CORS });
    return env.SALAS.get(env.SALAS.idFromName(m[1])).fetch(req);
  },
};

export class Sala extends DurableObject {
  conectados() {
    return this.ctx.getWebSockets().map(ws => ({ ws, ...(ws.deserializeAttachment() || {}) })).filter(j => j.id && !j.cerrado);
  }

  async fetch(req) {
    const url = new URL(req.url);
    const nombre = (url.searchParams.get('nombre') || 'Jugador').trim().slice(0, 16) || 'Jugador';
    const id = (url.searchParams.get('id') || '').replace(/[^a-z0-9]/gi, '').slice(0, 12) || crypto.randomUUID().slice(0, 8);

    // Si el mismo jugador vuelve (por ejemplo, se le cortó), se cierra la conexión vieja.
    for (const j of this.conectados()) {
      if (j.id === id) {
        j.ws.serializeAttachment({ ...j, ws: undefined, cerrado: true });
        try { j.ws.close(4000, 'Reemplazado'); } catch (e) {}
      }
    }
    if (this.conectados().length >= MAX_JUGADORES) return new Response('Sala llena', { status: 403 });

    const [cliente, servidor] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(servidor);
    servidor.serializeAttachment({ id, nombre, entro: Date.now() });

    let anfitrion = await this.ctx.storage.get('anfitrion');
    const presentes = this.conectados();
    if (!anfitrion || !presentes.some(j => j.id === anfitrion)) {
      // Sin anfitrión conectado: si la sala estaba vacía, el que entra pasa a ser el anfitrión.
      if (presentes.length === 1 || !anfitrion) { anfitrion = id; await this.ctx.storage.put('anfitrion', id); }
    }
    const estado = (await this.ctx.storage.get('estado')) || null;
    servidor.send(JSON.stringify({ t: 'bienvenida', id, estado }));
    await this.presencia();
    return new Response(null, { status: 101, webSocket: cliente });
  }

  async presencia() {
    const anfitrion = await this.ctx.storage.get('anfitrion');
    const jugadores = this.conectados().sort((a, b) => a.entro - b.entro).map(j => ({ id: j.id, nombre: j.nombre }));
    this.difundir({ t: 'presencia', jugadores, anfitrion });
  }

  difundir(m, filtro = () => true) {
    const txt = JSON.stringify(m);
    for (const j of this.conectados()) if (filtro(j)) { try { j.ws.send(txt); } catch (e) {} }
  }

  async webSocketMessage(ws, texto) {
    const yo = ws.deserializeAttachment();
    if (!yo || typeof texto !== 'string' || texto.length > 20_000) return;
    let m;
    try { m = JSON.parse(texto); } catch (e) { return; }
    if (m.t === 'ping') return ws.send('{"t":"pong"}');
    const anfitrion = await this.ctx.storage.get('anfitrion');
    const salida = { t: 'msg', de: yo.id, d: m.d };
    if (m.t === 'todos') this.difundir(salida);
    else if (m.t === 'para') this.difundir(salida, j => j.id === m.a);
    else if (m.t === 'anfitrion') this.difundir(salida, j => j.id === anfitrion);
    else if (m.t === 'guardar' && yo.id === anfitrion) await this.ctx.storage.put('estado', m.d ?? null);
  }

  async webSocketClose(ws) {
    const yo = ws.deserializeAttachment();
    if (yo) ws.serializeAttachment({ ...yo, cerrado: true });
    await this.presencia();
    const anfitrion = await this.ctx.storage.get('anfitrion');
    if (!this.conectados().length) await this.ctx.storage.setAlarm(Date.now() + BORRAR_SALA_VACIA);
    else if (yo && yo.id === anfitrion) await this.ctx.storage.setAlarm(Date.now() + ESPERA_ANFITRION);
  }

  async webSocketError(ws) { await this.webSocketClose(ws); }

  async alarm() {
    const presentes = this.conectados().sort((a, b) => a.entro - b.entro);
    if (!presentes.length) { await this.ctx.storage.deleteAll(); return; }
    const anfitrion = await this.ctx.storage.get('anfitrion');
    if (!presentes.some(j => j.id === anfitrion)) {
      await this.ctx.storage.put('anfitrion', presentes[0].id);
      await this.presencia();
    }
  }
}
