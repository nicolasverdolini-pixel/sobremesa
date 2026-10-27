// Ajedrez: configuración de la pantalla de tablero con el motor de reglas.

const Ajedrez = (() => {
  const M = AjedrezMotor;
  // Siempre las figuras "rellenas", pintadas por CSS; el ︎ evita que el iPhone las muestre como emoji.
  const FIG = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const fig = (t, c, extra = '') => `<span class="pz ${c} ${extra}">${FIG[t]}︎</span>`;
  const INICIAL = { p: 8, n: 2, b: 2, r: 2, q: 1 };

  const TEXTOS = {
    mate: '¡Jaque mate!',
    ahogado: 'Rey ahogado: no tiene jugadas pero no está en jaque.',
    cincuenta: '50 jugadas sin capturas ni movimientos de peón.',
    material: 'No queda material para dar mate.',
    repeticion: 'La misma posición se repitió tres veces.',
    rendicion: 'Por abandono.',
  };

  // Elegir a qué pieza corona el peón.
  const elegirPromo = (movs, s) => new Promise(res => {
    const c = s.turno;
    const d = document.createElement('div');
    d.className = 'modal ver';
    d.innerHTML = `<div class="modal-caja"><p>¿En qué se convierte el peón?</p>
      <div class="promo">${['q', 'r', 'b', 'n'].map(t => `<button data-t="${t}">${fig(t, c)}</button>`).join('')}</div></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', e => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      d.remove();
      res(movs.find(m => m.promo === b.dataset.t));
    });
  });

  return JuegoDeTablero({
    id: 'ajedrez', titulo: 'Ajedrez', emoji: '♞',
    nombres: { w: 'Blancas', b: 'Negras' },
    como: 'Tocá una pieza tuya para ver adónde puede ir y después tocá la casilla. Están todas las reglas: enroque, captura al paso, coronación, jaque mate y tablas.',
    inicial: M.inicial,
    legales: s => M.legales(s),
    mover: M.mover,
    fin: (s, claves) => M.fin(s, claves),
    clave: M.clave,
    compu: (s, nivel) => M.jugadaCompu(s, nivel),
    pieza: (p, extra) => fig(M.tipo(p), M.colorDe(p), extra),
    jaque: s => (M.enJaque(s, s.turno) ? M.rey(s.b, s.turno) : -1),
    esCaptura: mv => !!mv.captura,
    elegir: elegirPromo,
    textoFin: f => TEXTOS[f.tipo],
    // Piezas que perdió cada color, de la más valiosa a la menos.
    caidas: s => {
      const res = {};
      for (const c of ['w', 'b']) {
        res[c] = ['q', 'r', 'b', 'n', 'p'].map(t => {
          const hay = s.b.filter(x => x && M.tipo(x) === t && M.colorDe(x) === c).length;
          return fig(t, c, 'chica').repeat(Math.max(0, INICIAL[t] - hay));
        }).join('');
      }
      return res;
    },
  });
})();
