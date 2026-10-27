// Damas: reglas y la compu (sin pantalla, para poder probarlo aparte).
// Tablero: 64 casillas, 0 = arriba a la izquierda. Se juega en las casillas oscuras ((fila + col) impar).
// 'w' / 'W' = ficha / dama blanca (abajo, sube); 'b' / 'B' = ficha / dama negra (arriba, baja); '' = vacía.
// Reglas configurables: { atras: las fichas comen para atrás, voladora: la dama se mueve lejos, obligatorio: hay que comer }

const DamasMotor = (() => {
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const fila = i => i >> 3, col = i => i & 7;
  const sq = (r, c) => r * 8 + c;
  const dentro = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const colorDe = p => p.toLowerCase();
  const esDama = p => p === p.toUpperCase();
  const otro = t => (t === 'w' ? 'b' : 'w');
  const adelante = t => (t === 'w' ? -1 : 1);
  const ultimaFila = t => (t === 'w' ? 0 : 7);
  const REGLAS = { atras: false, voladora: true, obligatorio: true };

  function inicial() {
    const b = new Array(64).fill('');
    for (let i = 0; i < 64; i++) {
      if ((fila(i) + col(i)) % 2 === 0) continue;
      if (fila(i) < 3) b[i] = 'b';
      else if (fila(i) > 4) b[i] = 'w';
    }
    return { b, turno: 'w', sinComer: 0 };
  }

  function capturas(s, R) {
    const res = [], yo = s.turno, b = s.b.slice();
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (!p || colorDe(p) !== yo) continue;
      b[i] = ''; // la ficha que salta deja libre su casilla de salida
      const dama = esDama(p);
      (function saltar(pos, camino, comidas) {
        let siguio = false;
        const r = fila(pos), c = col(pos);
        for (const [dr, dc] of DIAG) {
          if (!dama && !R.atras && dr !== adelante(yo)) continue;
          if (dama && R.voladora) {
            let rr = r + dr, cc = c + dc;
            while (dentro(rr, cc) && !b[sq(rr, cc)]) { rr += dr; cc += dc; }
            if (!dentro(rr, cc)) continue;
            const x = sq(rr, cc);
            if (colorDe(b[x]) === yo || comidas.includes(x)) continue;
            rr += dr; cc += dc;
            while (dentro(rr, cc) && !b[sq(rr, cc)]) {
              siguio = true;
              saltar(sq(rr, cc), camino.concat(sq(rr, cc)), comidas.concat(x));
              rr += dr; cc += dc;
            }
          } else {
            const rr = r + 2 * dr, cc = c + 2 * dc;
            if (!dentro(rr, cc)) continue;
            const x = sq(r + dr, c + dc), a = sq(rr, cc);
            if (b[x] && colorDe(b[x]) !== yo && !comidas.includes(x) && !b[a]) {
              siguio = true;
              saltar(a, camino.concat(a), comidas.concat(x));
            }
          }
        }
        if (!siguio && comidas.length) {
          res.push({ de: i, a: pos, camino, comidas, corona: !dama && fila(pos) === ultimaFila(yo) });
        }
      })(i, [], []);
      b[i] = p;
    }
    return res;
  }

  function simples(s, R) {
    const res = [], yo = s.turno, b = s.b;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || colorDe(p) !== yo) continue;
      const dama = esDama(p), r = fila(i), c = col(i);
      for (const [dr, dc] of DIAG) {
        if (!dama && dr !== adelante(yo)) continue;
        let rr = r + dr, cc = c + dc;
        while (dentro(rr, cc) && !b[sq(rr, cc)]) {
          const a = sq(rr, cc);
          res.push({ de: i, a, camino: [a], comidas: [], corona: !dama && rr === ultimaFila(yo) });
          if (!dama || !R.voladora) break;
          rr += dr; cc += dc;
        }
      }
    }
    return res;
  }

  function legales(s, R = REGLAS) {
    const caps = capturas(s, R);
    if (caps.length && R.obligatorio) return caps;
    return caps.concat(simples(s, R));
  }

  function mover(s, mv) {
    const b = s.b.slice();
    const p = b[mv.de];
    b[mv.de] = '';
    mv.comidas.forEach(x => { b[x] = ''; });
    b[mv.a] = mv.corona ? p.toUpperCase() : p;
    return { b, turno: otro(s.turno), sinComer: mv.comidas.length || !esDama(p) ? 0 : s.sinComer + 1 };
  }

  const clave = s => s.b.map(x => x || '.').join('') + s.turno;

  // Pierde el que no tiene jugadas. Tablas si pasan 50 jugadas solo de damas sin comer, o triple repetición.
  function fin(s, claves = [], R = REGLAS) {
    if (!legales(s, R).length) return { tipo: 'sinJugadas', ganador: otro(s.turno) };
    if (s.sinComer >= 50) return { tipo: 'cincuenta' };
    const k = clave(s);
    if (claves.filter(x => x === k).length >= 2) return { tipo: 'repeticion' };
    return null;
  }

  // ---------- La compu ----------
  function evaluar(s) {
    let v = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (!p) continue;
      const t = colorDe(p), r = fila(i), c = col(i);
      let x;
      if (esDama(p)) x = 300;
      else {
        const avance = t === 'w' ? 7 - r : r;
        x = 100 + avance * 4 + (avance === 0 ? 8 : 0); // la última fila propia defiende la coronación
      }
      if (c > 1 && c < 6 && r > 1 && r < 6) x += 6; // el centro vale un poco más
      v += t === 'w' ? x : -x;
    }
    return s.turno === 'w' ? v : -v;
  }

  const MATE = 100000;
  function buscar(s, prof, alfa, beta, ply, R) {
    const movs = legales(s, R);
    if (!movs.length) return -MATE + ply;
    if (prof <= 0 && !movs[0].comidas.length) return evaluar(s);
    if (prof <= -6) return evaluar(s);
    movs.sort((x, y) => y.comidas.length - x.comidas.length);
    for (const mv of movs) {
      const v = -buscar(mover(s, mv), prof - 1, -beta, -alfa, ply + 1, R);
      if (v >= beta) return beta;
      if (v > alfa) alfa = v;
    }
    return alfa;
  }

  const NIVELES = {
    facil: { prof: 1, ruido: 60, azar: 0.25 },
    medio: { prof: 4, ruido: 10, azar: 0 },
    dificil: { prof: 7, ruido: 0, azar: 0 },
  };

  function jugadaCompu(s, nivel = 'medio', R = REGLAS) {
    const cfg = NIVELES[nivel];
    const movs = legales(s, R);
    if (!movs.length) return null;
    if (Math.random() < cfg.azar) return movs[Math.floor(Math.random() * movs.length)];
    let mejor = movs[0], mejorV = -Infinity;
    for (const mv of movs) {
      const v = -buscar(mover(s, mv), cfg.prof - 1, -MATE - 1, MATE + 1, 1, R) + (Math.random() - 0.5) * 2 * cfg.ruido;
      if (v > mejorV) { mejorV = v; mejor = mv; }
    }
    return mejor;
  }

  return { REGLAS, inicial, legales, mover, fin, clave, jugadaCompu, colorDe, esDama };
})();

if (typeof module !== 'undefined') module.exports = DamasMotor;
