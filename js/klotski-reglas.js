// Klotski: reglas y resolvedor (sin pantalla, para poder probarlo aparte).
// Caja de 4 columnas × 5 filas. Piezas: G (2×2, la que hay que sacar), V (1×2 vertical), H (2×1 horizontal), C (1×1).
// Se gana cuando la G llega abajo al medio (x = 1, y = 3): ahí está la salida.

const KlotskiReglas = (() => {
  const ANCHO = 4, ALTO = 5;
  const TAM = { G: [2, 2], V: [1, 2], H: [2, 1], C: [1, 1] };
  const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  // "G10 V00 V30 ..." -> [{ t, x, y }]
  const leer = txt => txt.trim().split(/\s+/).map(p => ({ t: p[0], x: +p[1], y: +p[2] }));
  const escribir = piezas => piezas.map(p => p.t + p.x + p.y).join(' ');

  function grilla(piezas) {
    const g = new Array(ANCHO * ALTO).fill(-1);
    piezas.forEach((p, i) => {
      const [w, h] = TAM[p.t];
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) g[(p.y + dy) * ANCHO + p.x + dx] = i;
    });
    return g;
  }

  // Clave de la posición: piezas iguales son intercambiables (así el resolvedor no repite posiciones).
  function clave(piezas) {
    const c = new Array(ANCHO * ALTO).fill('.');
    piezas.forEach(p => {
      const [w, h] = TAM[p.t];
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) c[(p.y + dy) * ANCHO + p.x + dx] = dx || dy ? p.t.toLowerCase() : p.t;
    });
    return c.join('');
  }

  function puedeMover(piezas, g, i, dx, dy) {
    const p = piezas[i], [w, h] = TAM[p.t];
    const nx = p.x + dx, ny = p.y + dy;
    if (nx < 0 || ny < 0 || nx + w > ANCHO || ny + h > ALTO) return false;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const v = g[(ny + yy) * ANCHO + nx + xx];
      if (v !== -1 && v !== i) return false;
    }
    return true;
  }

  const gano = piezas => piezas.some(p => p.t === 'G' && p.x === 1 && p.y === 3);

  // Búsqueda a lo ancho: devuelve la lista de pasos [{ i, dx, dy }] más corta, o null si no tiene solución.
  function resolver(inicial, limite = 400000) {
    if (gano(inicial)) return [];
    const vistos = new Map([[clave(inicial), null]]);
    let frente = [inicial];
    while (frente.length) {
      const sig = [];
      for (const piezas of frente) {
        const g = grilla(piezas), k0 = clave(piezas);
        for (let i = 0; i < piezas.length; i++) {
          for (const [dx, dy] of DIRS) {
            if (!puedeMover(piezas, g, i, dx, dy)) continue;
            const nuevo = piezas.map((p, j) => (j === i ? { ...p, x: p.x + dx, y: p.y + dy } : p));
            const k = clave(nuevo);
            if (vistos.has(k)) continue;
            vistos.set(k, { de: k0, i, dx, dy, piezas: nuevo });
            if (gano(nuevo)) return camino(vistos, k, piezas.length);
            sig.push(nuevo);
            if (vistos.size > limite) return null;
          }
        }
      }
      frente = sig;
    }
    return null;
  }

  // Rearma los pasos desde el final; como las piezas iguales se intercambian, se traduce cada paso a la pieza real.
  function camino(vistos, k, n) {
    const pasos = [];
    while (vistos.get(k)) { const v = vistos.get(k); pasos.unshift(v); k = v.de; }
    return pasos.map(v => ({ dx: v.dx, dy: v.dy, desde: v.piezas[v.i] && { t: v.piezas[v.i].t, x: v.piezas[v.i].x - v.dx, y: v.piezas[v.i].y - v.dy } }));
  }

  return { ANCHO, ALTO, TAM, leer, escribir, grilla, clave, puedeMover, gano, resolver };
})();

if (typeof module !== 'undefined') module.exports = KlotskiReglas;
