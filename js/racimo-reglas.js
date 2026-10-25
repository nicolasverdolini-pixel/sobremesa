// Racimo: las reglas puras (sin pantalla), para poder probarlas aparte.
// Celda: null (vacía), { c } (ficha de color) o { p } (piedra con p golpes que aguanta).

const RacimoReglas = (() => {
  const N = 7;
  const MINIMO = 4;           // fichas juntas para que explote un racimo
  const COLORES_POR_PUNTOS = [[0, 3], [250, 4], [900, 5], [2500, 6]];

  // La dificultad sube con los puntos: más colores y piedras más seguidas y más duras.
  const piedraCada = puntos => Math.max(3, 8 - Math.floor(puntos / 500));
  const durezaPiedra = puntos => puntos >= 1500 ? 3 : 2;

  const vecinos = i => {
    const r = Math.floor(i / N), c = i % N, v = [];
    if (r > 0) v.push(i - N);
    if (r < N - 1) v.push(i + N);
    if (c > 0) v.push(i - 1);
    if (c < N - 1) v.push(i + 1);
    return v;
  };

  function grupo(tab, i) {
    const color = tab[i].c, visto = new Set([i]), pila = [i];
    while (pila.length) {
      for (const v of vecinos(pila.pop())) {
        if (!visto.has(v) && tab[v] && tab[v].c === color) { visto.add(v); pila.push(v); }
      }
    }
    return [...visto];
  }

  const coloresPara = puntos => COLORES_POR_PUNTOS.filter(([p]) => puntos >= p).pop()[1];

  function fichaNueva(puntos, azar = Math.random) {
    if (azar() < 0.06) return { comodin: true };
    return { c: Math.floor(azar() * coloresPara(puntos)) };
  }

  // El comodín toma el color que arme el racimo más grande con sus vecinos.
  function colorComodin(tab, i, colores) {
    let mejor = 0, tam = -1;
    for (let c = 0; c < colores; c++) {
      tab[i] = { c };
      const t = grupo(tab, i).length;
      if (t > tam) { tam = t; mejor = c; }
    }
    tab[i] = null;
    return mejor;
  }

  // Resuelve explosiones en cadena desde las celdas `semillas`. Muta `tab` y devuelve los pasos para animarlos.
  function resolver(tab, semillas) {
    const pasos = [];
    let pendientes = semillas, cadena = 0;
    while (true) {
      const explota = new Map(); // celda -> color
      for (const s of pendientes) {
        if (!tab[s] || tab[s].c == null || explota.has(s)) continue;
        const g = grupo(tab, s);
        if (g.length >= MINIMO) g.forEach(i => explota.set(i, tab[i].c));
      }
      if (!explota.size) break;
      cadena++;
      const puntos = explota.size * 10 * cadena;
      explota.forEach((_, i) => { tab[i] = null; });
      const contagio = new Map(), rotas = [], golpeadas = [];
      explota.forEach((color, i) => {
        for (const v of vecinos(i)) {
          const x = tab[v];
          if (!x || explota.has(v)) continue;
          if (x.p != null) {
            if (golpeadas.includes(v)) continue;
            golpeadas.push(v);
            x.p--;
            if (x.p <= 0) { tab[v] = null; rotas.push(v); }
          } else if (!contagio.has(v) && x.c !== color) contagio.set(v, color);
        }
      });
      contagio.forEach((color, v) => { tab[v] = { c: color }; });
      pasos.push({ explota: [...explota.entries()], contagio: [...contagio.entries()], rotas, golpeadas: golpeadas.filter(g => !rotas.includes(g)), cadena, puntos, tablero: tab.map(x => x && { ...x }) });
      pendientes = [...contagio.keys()];
    }
    return pasos;
  }

  return { N, MINIMO, piedraCada, durezaPiedra, vecinos, grupo, coloresPara, fichaNueva, colorComodin, resolver };
})();

if (typeof module !== 'undefined') module.exports = RacimoReglas;
