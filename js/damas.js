// Damas: configuración de la pantalla de tablero con el motor de reglas.

const Damas = (() => {
  const M = DamasMotor;
  const ficha = (p, extra = '') => `<span class="ficha ${M.colorDe(p)} ${M.esDama(p) ? 'dama' : ''} ${extra}">${M.esDama(p) ? '♛︎' : ''}</span>`;

  const TEXTOS = {
    sinJugadas: 'El otro se quedó sin fichas o sin jugadas.',
    cincuenta: '25 jugadas de cada uno solo con damas, sin comer.',
    repeticion: 'La misma posición se repitió tres veces.',
    rendicion: 'Por abandono.',
  };

  const REGLAS = [
    ['obligatorio', 'Comer es obligatorio'],
    ['voladora', 'La dama se mueve lejos (voladora)'],
    ['atras', 'Las fichas comen para atrás'],
  ];

  const cfg = {
    id: 'damas', titulo: 'Damas', emoji: '⚪⚫',
    nombres: { w: 'Blancas', b: 'Negras' },
    como: 'Las fichas avanzan en diagonal de a una casilla. Para comer, saltás por encima de una ficha rival a la casilla libre de atrás, y si podés seguir comiendo, seguís en la misma jugada. Al llegar al fondo, la ficha se corona dama ♛. Gana el que deja al otro sin jugadas.',
    marcarObligadas: true,
    inicial: M.inicial,
    legales: (s, op) => M.legales(s, op),
    mover: M.mover,
    fin: (s, claves, op) => M.fin(s, claves, op),
    clave: M.clave,
    compu: (s, nivel, op) => M.jugadaCompu(s, nivel, op),
    pieza: ficha,
    jaque: () => -1,
    esCaptura: mv => mv.comidas.length > 0,
    // Si dos caminos llegan a la misma casilla, el que más come.
    elegir: async movs => movs.sort((a, b) => b.comidas.length - a.comidas.length)[0],
    textoFin: f => TEXTOS[f.tipo],
    caidas: s => {
      const res = {};
      for (const c of ['w', 'b']) {
        const quedan = s.b.filter(x => x && M.colorDe(x) === c).length;
        res[c] = 12 - quedan ? `${ficha(c, 'chica')}<small>×${12 - quedan}</small>` : '';
      }
      return res;
    },
    opciones: {
      defecto: { ...M.REGLAS },
      html: op => REGLAS.map(([k, t]) => `
        <label class="interruptor">
          <input type="checkbox" data-regla="${k}" ${(op || M.REGLAS)[k] ? 'checked' : ''}>
          <span class="perilla"></span><span>${t}</span>
        </label>`).join(''),
      leer: p => Object.fromEntries(REGLAS.map(([k]) => [k, p.querySelector(`[data-regla="${k}"]`).checked])),
    },
  };
  // `cfg` también lo usa el modo en red (js/tablero-red.js).
  return { ...JuegoDeTablero(cfg), cfg };
})();
