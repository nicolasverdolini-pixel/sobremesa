// Efectos de sonido sintetizados en el momento: no hay archivos de audio.
// Sonidos de juego: alegres, cortitos y con onda.

const Sonido = (() => {
  let ctx = null, salida = null;
  let mudo = false;
  try { mudo = localStorage.getItem('sobremesa:mudo') === '1'; } catch (e) {}

  function contexto() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      salida = ctx.createGain();
      salida.gain.value = 0.7;
      salida.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Una nota simple con su envolvente; `hasta` hace un glissando.
  function tono(freq, dur, { tipo = 'triangle', vol = 0.25, cuando = 0, hasta = null } = {}) {
    if (mudo) return;
    const a = contexto();
    if (!a) return;
    const t = a.currentTime + cuando;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(salida);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Ruido filtrado: raspar un fósforo, mezclar cartas, redoblante.
  function ruido(dur, { vol = 0.2, cuando = 0, filtro = 2000, q = 1, tipo = 'bandpass' } = {}) {
    if (mudo) return;
    const a = contexto();
    if (!a) return;
    const t = a.currentTime + cuando;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = filtro;
    f.Q.value = q;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(salida);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  const arpegio = (notas, paso, op) => notas.forEach((f, i) => tono(f, op.dur || 0.2, { ...op, cuando: (op.cuando || 0) + i * paso }));

  return {
    // En iPhone el audio arranca recién después de un toque.
    desbloquear() { if (!mudo) contexto(); },
    get mudo() { return mudo; },
    alternar() {
      mudo = !mudo;
      try { localStorage.setItem('sobremesa:mudo', mudo ? '1' : '0'); } catch (e) {}
      if (!mudo) this.toque();
      return mudo;
    },

    toque() { tono(640, 0.07, { vol: 0.12 }); },
    acierto() { arpegio([660, 880, 1320], 0.07, { dur: 0.18, vol: 0.22 }); },
    paso() { tono(420, 0.3, { tipo: 'sawtooth', vol: 0.1, hasta: 160 }); },
    tic() { tono(1200, 0.05, { tipo: 'square', vol: 0.06 }); },
    cuenta() { tono(523, 0.18, { vol: 0.25 }); },
    ya() { tono(1046, 0.4, { vol: 0.28 }); tono(1568, 0.4, { vol: 0.12 }); },
    fin() {
      tono(220, 0.6, { tipo: 'sawtooth', vol: 0.14 });
      tono(233, 0.6, { tipo: 'square', vol: 0.08 });
    },
    carta() { ruido(0.18, { vol: 0.25, filtro: 3500, q: 0.8 }); },
    redoble() {
      for (let i = 0; i < 18; i++) ruido(0.06, { vol: 0.06 + i * 0.012, cuando: i * 0.085, filtro: 900, q: 0.6 });
    },
    revelar() { arpegio([392, 523, 659, 784], 0.09, { dur: 0.3, vol: 0.22 }); },
    error() { arpegio([392, 370, 349, 262], 0.16, { dur: 0.3, tipo: 'sawtooth', vol: 0.1 }); },
    ganar() {
      arpegio([523, 659, 784, 1046], 0.1, { dur: 0.25, vol: 0.22 });
      tono(784, 0.6, { cuando: 0.45, vol: 0.2 });
      tono(1046, 0.8, { cuando: 0.45, vol: 0.22 });
      tono(1318, 0.8, { cuando: 0.45, vol: 0.14 });
    },
    // Raspar un fósforo: un chasquido corto y una llamita.
    fosforo() {
      ruido(0.09, { vol: 0.35, filtro: 4200, q: 0.7 });
      ruido(0.25, { vol: 0.08, cuando: 0.06, filtro: 700, q: 0.5, tipo: 'lowpass' });
      tono(880, 0.08, { vol: 0.1, cuando: 0.02 });
    },
    restar() { tono(330, 0.18, { vol: 0.18, hasta: 220 }); },
  };
})();
