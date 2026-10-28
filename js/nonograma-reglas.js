// Nonogramas: pistas, resolvedor por lógica y generador al azar (sin pantalla, para poder probarlo aparte).
// Un tablero es una lista de filas de 0 (vacía) y 1 (pintada). Las pistas dicen los grupos de pintadas seguidas.

const NonogramaReglas = (() => {
  const grupos = linea => {
    const g = [];
    let n = 0;
    for (const v of linea) { if (v === 1) n++; else if (n) { g.push(n); n = 0; } }
    if (n) g.push(n);
    return g;
  };
  const columna = (t, c) => t.map(f => f[c]);
  const pistas = t => ({ filas: t.map(grupos), cols: t[0].map((_, c) => grupos(columna(t, c))) });

  // Todas las formas de ubicar los grupos en la línea respetando lo que ya se sabe (-1 = no se sabe).
  // Devuelve qué casillas quedan seguro pintadas (1), seguro vacías (0) o null si no hay ninguna forma.
  function resolverLinea(linea, pista) {
    const n = linea.length, k = pista.length;
    // suf[j][i]: ¿se pueden ubicar los grupos j… desde la casilla i hasta el final?
    const suf = Array.from({ length: k + 1 }, () => new Array(n + 2).fill(false));
    for (let i = n; i >= 0; i--) suf[k][i] = i === n || (linea[i] !== 1 && suf[k][i + 1]);
    const entra = (j, i) => {
      const L = pista[j];
      if (i + L > n) return false;
      for (let x = i; x < i + L; x++) if (linea[x] === 0) return false;
      return i + L === n || linea[i + L] !== 1;
    };
    for (let j = k - 1; j >= 0; j--) {
      for (let i = n; i >= 0; i--) {
        suf[j][i] = (i < n && linea[i] !== 1 && suf[j][i + 1]) || (entra(j, i) && suf[j + 1][Math.min(n, i + pista[j] + 1)]);
      }
    }
    if (!suf[0][0]) return null;
    const llena = new Array(n).fill(false), vacia = new Array(n).fill(false);
    const pos = [];
    (function ubicar(j, desde) {
      if (j === k) {
        const t = new Array(n).fill(0);
        pos.forEach((p, q) => { for (let x = p; x < p + pista[q]; x++) t[x] = 1; });
        t.forEach((v, x) => { if (v) llena[x] = true; else vacia[x] = true; });
        return;
      }
      for (let p = desde; p <= n; p++) {
        if (p > desde && linea[p - 1] === 1) break;
        if (entra(j, p) && suf[j + 1][Math.min(n, p + pista[j] + 1)]) {
          pos[j] = p;
          ubicar(j + 1, Math.min(n, p + pista[j] + 1));
        }
      }
    })(0, 0);
    return linea.map((v, i) => (llena[i] && !vacia[i] ? 1 : !llena[i] && vacia[i] ? 0 : v));
  }

  // Resuelve sin adivinar, línea por línea, hasta que no cambie nada. Devuelve el tablero o null si se traba.
  function resolver(p) {
    const F = p.filas.length, C = p.cols.length;
    const t = Array.from({ length: F }, () => new Array(C).fill(-1));
    let cambio = true;
    while (cambio) {
      cambio = false;
      for (let f = 0; f < F; f++) {
        const r = resolverLinea(t[f], p.filas[f]);
        if (!r) return null;
        r.forEach((v, c) => { if (v !== t[f][c]) { t[f][c] = v; cambio = true; } });
      }
      for (let c = 0; c < C; c++) {
        const r = resolverLinea(columna(t, c), p.cols[c]);
        if (!r) return null;
        r.forEach((v, f) => { if (v !== t[f][c]) { t[f][c] = v; cambio = true; } });
      }
    }
    return t.every(f => f.every(v => v !== -1)) ? t : null;
  }

  // Tablero al azar que se puede resolver solo con lógica (por lo tanto, tiene una única solución).
  function alAzar(n, azar = Math.random) {
    const densidad = n <= 5 ? 0.6 : n <= 10 ? 0.58 : 0.56;
    for (let intento = 0; intento < 500; intento++) {
      const t = Array.from({ length: n }, () => Array.from({ length: n }, () => (azar() < densidad ? 1 : 0)));
      if (t.some(f => !f.includes(1))) continue;
      if (resolver(pistas(t))) return t;
    }
    return null;
  }

  return { pistas, grupos, resolver, resolverLinea, alAzar };
})();

if (typeof module !== 'undefined') module.exports = NonogramaReglas;
