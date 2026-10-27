// Ajedrez: reglas completas y la compu (sin pantalla, para poder probarlo aparte).
// Tablero: 64 casillas, 0 = a8 … 63 = h1. Mayúsculas = blancas, minúsculas = negras, '' = vacía.

const AjedrezMotor = (() => {
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const fila = i => i >> 3, col = i => i & 7;
  const sq = (r, c) => r * 8 + c;
  const dentro = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const colorDe = p => (p === p.toUpperCase() ? 'w' : 'b');
  const tipo = p => p.toLowerCase();
  const otro = t => (t === 'w' ? 'b' : 'w');
  const DIR = {
    n: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
    b: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    r: [[-1, 0], [1, 0], [0, -1], [0, 1]],
  };
  DIR.q = DIR.b.concat(DIR.r);
  DIR.k = DIR.q;

  function desdeFEN(f) {
    const [pos, t, enr, ep, m, n] = f.split(' ');
    const b = [];
    for (const ch of pos) {
      if (ch === '/') continue;
      if (/\d/.test(ch)) for (let k = 0; k < +ch; k++) b.push('');
      else b.push(ch);
    }
    return { b, turno: t, enroque: enr === '-' ? '' : enr, ep: ep === '-' ? -1 : sq(8 - +ep[1], ep.charCodeAt(0) - 97), medio: +m || 0, num: +n || 1 };
  }
  const inicial = () => desdeFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  // ¿La casilla i está atacada por el color `por`?
  function atacada(b, i, por) {
    const r = fila(i), c = col(i), w = por === 'w';
    const dr = w ? 1 : -1;
    for (const dc of [-1, 1]) {
      const rr = r + dr, cc = c + dc;
      if (dentro(rr, cc) && b[sq(rr, cc)] === (w ? 'P' : 'p')) return true;
    }
    for (const [a, d] of DIR.n) {
      const rr = r + a, cc = c + d;
      if (dentro(rr, cc) && b[sq(rr, cc)] === (w ? 'N' : 'n')) return true;
    }
    for (const [a, d] of DIR.k) {
      const rr = r + a, cc = c + d;
      if (dentro(rr, cc) && b[sq(rr, cc)] === (w ? 'K' : 'k')) return true;
    }
    for (const [dirs, piezas] of [[DIR.b, w ? 'BQ' : 'bq'], [DIR.r, w ? 'RQ' : 'rq']]) {
      for (const [a, d] of dirs) {
        let rr = r + a, cc = c + d;
        while (dentro(rr, cc)) {
          const p = b[sq(rr, cc)];
          if (p) { if (piezas.includes(p)) return true; break; }
          rr += a; cc += d;
        }
      }
    }
    return false;
  }

  const rey = (b, t) => b.indexOf(t === 'w' ? 'K' : 'k');
  const enJaque = (s, t) => atacada(s.b, rey(s.b, t), otro(t));

  function pseudo(s) {
    const m = [], yo = s.turno, b = s.b;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || colorDe(p) !== yo) continue;
      const t = tipo(p), r = fila(i), c = col(i);
      if (t === 'p') {
        const dir = yo === 'w' ? -1 : 1, salida = yo === 'w' ? 6 : 1, ultima = yo === 'w' ? 0 : 7;
        const agregar = (a, extra) => {
          if (fila(a) === ultima) for (const pr of 'qrbn') m.push({ de: i, a, promo: pr, ...extra });
          else m.push({ de: i, a, ...extra });
        };
        const uno = sq(r + dir, c);
        if (!b[uno]) {
          agregar(uno, {});
          const dos = sq(r + 2 * dir, c);
          if (r === salida && !b[dos]) m.push({ de: i, a: dos, doble: true });
        }
        for (const dc of [-1, 1]) {
          if (!dentro(r + dir, c + dc)) continue;
          const a = sq(r + dir, c + dc);
          if (b[a] && colorDe(b[a]) !== yo) agregar(a, { captura: b[a] });
          else if (a === s.ep) m.push({ de: i, a, ep: true, captura: yo === 'w' ? 'p' : 'P' });
        }
      } else if (t === 'n' || t === 'k') {
        for (const [a, d] of DIR[t]) {
          const rr = r + a, cc = c + d;
          if (!dentro(rr, cc)) continue;
          const x = b[sq(rr, cc)];
          if (!x) m.push({ de: i, a: sq(rr, cc) });
          else if (colorDe(x) !== yo) m.push({ de: i, a: sq(rr, cc), captura: x });
        }
        if (t === 'k') {
          const enemigo = otro(yo), E = s.enroque;
          if (yo === 'w' && i === 60) {
            if (E.includes('K') && !b[61] && !b[62] && b[63] === 'R' && ![60, 61, 62].some(x => atacada(b, x, enemigo))) m.push({ de: 60, a: 62, enroque: 'K' });
            if (E.includes('Q') && !b[59] && !b[58] && !b[57] && b[56] === 'R' && ![60, 59, 58].some(x => atacada(b, x, enemigo))) m.push({ de: 60, a: 58, enroque: 'Q' });
          }
          if (yo === 'b' && i === 4) {
            if (E.includes('k') && !b[5] && !b[6] && b[7] === 'r' && ![4, 5, 6].some(x => atacada(b, x, enemigo))) m.push({ de: 4, a: 6, enroque: 'k' });
            if (E.includes('q') && !b[3] && !b[2] && !b[1] && b[0] === 'r' && ![4, 3, 2].some(x => atacada(b, x, enemigo))) m.push({ de: 4, a: 2, enroque: 'q' });
          }
        }
      } else {
        for (const [a, d] of DIR[t]) {
          let rr = r + a, cc = c + d;
          while (dentro(rr, cc)) {
            const x = b[sq(rr, cc)];
            if (!x) m.push({ de: i, a: sq(rr, cc) });
            else { if (colorDe(x) !== yo) m.push({ de: i, a: sq(rr, cc), captura: x }); break; }
            rr += a; cc += d;
          }
        }
      }
    }
    return m;
  }

  const TORRE_ENROQUE = { K: [63, 61], Q: [56, 59], k: [7, 5], q: [0, 3] };

  function mover(s, mv) {
    const b = s.b.slice();
    const p = b[mv.de];
    b[mv.a] = mv.promo ? (s.turno === 'w' ? mv.promo.toUpperCase() : mv.promo) : p;
    b[mv.de] = '';
    if (mv.ep) b[mv.a + (s.turno === 'w' ? 8 : -8)] = '';
    if (mv.enroque) { const [x, y] = TORRE_ENROQUE[mv.enroque]; b[y] = b[x]; b[x] = ''; }
    let enr = s.enroque;
    if (p === 'K') enr = enr.replace(/[KQ]/g, '');
    if (p === 'k') enr = enr.replace(/[kq]/g, '');
    for (const [c, f] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']]) if (mv.de === c || mv.a === c) enr = enr.replace(f, '');
    return {
      b, turno: otro(s.turno), enroque: enr,
      ep: mv.doble ? (mv.de + mv.a) / 2 : -1,
      medio: tipo(p) === 'p' || mv.captura ? 0 : s.medio + 1,
      num: s.num + (s.turno === 'b' ? 1 : 0),
    };
  }

  const legales = s => pseudo(s).filter(mv => !enJaque(mover(s, mv), s.turno));

  const clave = s => s.b.map(x => x || '.').join('') + s.turno + s.enroque + s.ep;

  function materialInsuficiente(b) {
    const resto = b.filter(p => p && tipo(p) !== 'k');
    if (!resto.length) return true;
    return resto.length === 1 && 'nb'.includes(tipo(resto[0]));
  }

  // ¿Terminó? `claves` son las posiciones anteriores, para la triple repetición.
  function fin(s, claves = []) {
    const movs = legales(s);
    if (!movs.length) return enJaque(s, s.turno)
      ? { tipo: 'mate', ganador: otro(s.turno) }
      : { tipo: 'ahogado' };
    if (s.medio >= 100) return { tipo: 'cincuenta' };
    if (materialInsuficiente(s.b)) return { tipo: 'material' };
    const k = clave(s);
    if (claves.filter(x => x === k).length >= 2) return { tipo: 'repeticion' };
    return null;
  }

  function perft(s, prof) {
    if (!prof) return 1;
    let n = 0;
    for (const mv of legales(s)) n += perft(mover(s, mv), prof - 1);
    return n;
  }

  // ---------- La compu ----------
  // Tablas de posición (para las blancas, a8 = 0); las negras usan la casilla espejada.
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  };
  const MATE = 100000;

  function evaluar(s) {
    let v = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.b[i];
      if (!p) continue;
      const t = tipo(p);
      if (colorDe(p) === 'w') v += VAL[t] + PST[t][i];
      else v -= VAL[t] + PST[t][i ^ 56];
    }
    return s.turno === 'w' ? v : -v;
  }

  // Primero las capturas que ganan más (víctima valiosa, atacante barato).
  const orden = mv => (mv.captura ? 10 * VAL[tipo(mv.captura)] - VAL[tipo('p')] : 0) + (mv.promo === 'q' ? 800 : 0);
  const ordenar = (movs, s) => movs.sort((x, y) => (orden(y) - VAL[tipo(s.b[y.de])] / 100) - (orden(x) - VAL[tipo(s.b[x.de])] / 100));

  function quieto(s, alfa, beta, ctx, q) {
    ctx.nodos++;
    const base = evaluar(s);
    if (base >= beta) return beta;
    if (base > alfa) alfa = base;
    if (q >= 4) return alfa;
    const caps = ordenar(legales(s).filter(m => m.captura || m.promo), s);
    for (const mv of caps) {
      const v = -quieto(mover(s, mv), -beta, -alfa, ctx, q + 1);
      if (v >= beta) return beta;
      if (v > alfa) alfa = v;
    }
    return alfa;
  }

  function buscar(s, prof, alfa, beta, ply, ctx) {
    ctx.nodos++;
    if (prof === 0) return ctx.quieto ? quieto(s, alfa, beta, ctx, 0) : evaluar(s);
    const movs = legales(s);
    if (!movs.length) return enJaque(s, s.turno) ? -MATE + ply : 0;
    if (s.medio >= 100) return 0;
    ordenar(movs, s);
    for (const mv of movs) {
      const v = -buscar(mover(s, mv), prof - 1, -beta, -alfa, ply + 1, ctx);
      if (v >= beta) return beta;
      if (v > alfa) alfa = v;
    }
    return alfa;
  }

  const NIVELES = {
    facil: { prof: 1, ruido: 120, azar: 0.2, quieto: false },
    medio: { prof: 2, ruido: 25, azar: 0, quieto: true },
    dificil: { prof: 3, ruido: 0, azar: 0, quieto: true },
  };

  function jugadaCompu(s, nivel = 'medio') {
    const cfg = NIVELES[nivel];
    const movs = ordenar(legales(s), s);
    if (!movs.length) return null;
    if (Math.random() < cfg.azar) return movs[Math.floor(Math.random() * movs.length)];
    const ctx = { nodos: 0, quieto: cfg.quieto };
    let mejor = movs[0], mejorV = -Infinity;
    for (const mv of movs) {
      const v = -buscar(mover(s, mv), cfg.prof - 1, -MATE - 1, MATE + 1, 1, ctx) + (Math.random() - 0.5) * 2 * cfg.ruido;
      if (v > mejorV) { mejorV = v; mejor = mv; }
    }
    return mejor;
  }

  return { inicial, desdeFEN, legales, mover, enJaque, rey, fin, clave, perft, jugadaCompu, colorDe, tipo, VAL };
})();

if (typeof module !== 'undefined') module.exports = AjedrezMotor;
