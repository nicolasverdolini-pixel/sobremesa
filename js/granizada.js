// Granizada: caen choripanes, empanadas y alfajores del cielo. Atajalos con la parrilla y esquivá el granizo.

const Granizada = (() => {
  // pts: puntos que da; peso: qué tan seguido sale; poder: efecto especial.
  const COSAS = {
    chori: { pts: 10, peso: 40 },
    empanada: { pts: 15, peso: 24 },
    alfajor: { pts: 25, peso: 10 },
    oro: { pts: 100, peso: 1.2 },
    mate: { poder: 'lento', peso: 1.6 },
    paraguas: { poder: 'escudo', peso: 1.6 },
  };
  const VIDAS = 3;

  let control = App.leer('granizada:control', 'dedo');
  // En un duelo en red, todos reciben lo mismo en el mismo orden (azar con semilla).
  let duelo = null, azar = Math.random;

  function inicio() {
    App.despierto(false);
    const record = App.leer('granizada:record', 0);
    const p = App.pantalla({ titulo: 'Granizada', volver: App.menu, clase: 'gr-inicio', html: `
      <canvas class="gr-portada" id="portada" width="600" height="360"></canvas>
      ${record ? `<p class="bajada">Tu récord: <b>${record}</b></p>` : ''}
      <div class="opcion">
        <span>Mover la parrilla</span>
        <div class="segmentos" id="control">
          <button data-v="dedo" class="${control === 'dedo' ? 'on' : ''}">👆 Dedo</button>
          <button data-v="inclinar" class="${control === 'inclinar' ? 'on' : ''}">📱 Inclinando</button>
        </div>
      </div>
      <div class="como">
        <b>Cómo se juega</b>
        <p>Atajá con la parrilla todo lo rico que cae: choripán 10, empanada 15, alfajor 25 y el <b>chori dorado</b> 100. Si atajás varios seguidos se multiplica el puntaje.</p>
        <p>Esquivá el <b>granizo</b> 🧊 (te saca una vida) y, más adelante, los <b>rayos</b> ⚡: cuando ves la franja que titila, ¡corré! El 🧉 mate pone todo en cámara lenta y el ☂️ paraguas te protege un ratito.</p>
      </div>
      <div class="acciones"><button class="btn grande naranja" id="jugar" data-sin>¡A la parrilla!</button></div>` });
    p.querySelectorAll('#control button').forEach(b => {
      b.onclick = () => {
        control = b.dataset.v;
        App.guardar('granizada:control', control);
        p.querySelectorAll('#control button').forEach(x => x.classList.toggle('on', x === b));
      };
    });
    p.querySelector('#jugar').onclick = async () => {
      Sonido.desbloquear();
      if (control === 'inclinar') {
        const D = window.DeviceOrientationEvent;
        if (D && typeof D.requestPermission === 'function') {
          try { if ((await D.requestPermission()) !== 'granted') control = 'dedo'; } catch (e) { control = 'dedo'; }
        }
      }
      jugar();
    };
    portada(p.querySelector('#portada'));
  }

  // ---------- Dibujos ----------
  function chori(g, s, oro = false) {
    g.save();
    // pan
    g.fillStyle = oro ? '#ffd54a' : '#e8b56a';
    redondo(g, -s * 0.95, -s * 0.36, s * 1.9, s * 0.72, s * 0.36); g.fill();
    g.fillStyle = oro ? '#ffe98a' : '#f6d39a';
    redondo(g, -s * 0.8, -s * 0.34, s * 1.6, s * 0.22, s * 0.11); g.fill();
    // chorizo
    g.fillStyle = oro ? '#e0a800' : '#9b3b23';
    redondo(g, -s * 1.08, -s * 0.2, s * 2.16, s * 0.4, s * 0.2); g.fill();
    g.strokeStyle = oro ? '#b98400' : '#6e2412'; g.lineWidth = s * 0.05;
    for (const x of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(s * (x - 0.08), -s * 0.12); g.lineTo(s * (x + 0.08), -s * 0.02); g.stroke(); }
    // chimichurri
    g.fillStyle = '#3c9a3c';
    for (const [x, y] of [[-0.6, -0.08], [-0.2, 0.05], [0.3, -0.1], [0.7, 0.04]]) { g.beginPath(); g.arc(s * x, s * y, s * 0.06, 0, 7); g.fill(); }
    if (oro) brillo(g, s);
    g.restore();
  }

  function empanada(g, s) {
    g.save();
    g.fillStyle = '#e9a94b';
    g.beginPath(); g.arc(0, s * 0.2, s * 0.95, Math.PI, 0); g.closePath(); g.fill();
    g.fillStyle = '#f6c977';
    g.beginPath(); g.arc(-s * 0.15, s * 0.05, s * 0.45, Math.PI * 1.1, Math.PI * 1.6); g.lineTo(-s * 0.15, s * 0.05); g.fill();
    // repulgue
    g.fillStyle = '#d18a2e';
    for (let k = 0; k <= 9; k++) {
      const a = Math.PI + (k / 9) * Math.PI;
      g.beginPath(); g.arc(Math.cos(a) * s * 0.95, s * 0.2 + Math.sin(a) * s * 0.95, s * 0.13, 0, 7); g.fill();
    }
    g.fillStyle = '#c47a22';
    redondo(g, -s * 0.95, s * 0.12, s * 1.9, s * 0.16, s * 0.08); g.fill();
    g.restore();
  }

  function alfajor(g, s) {
    g.save();
    g.fillStyle = '#4a2a18';
    redondo(g, -s * 0.85, -s * 0.5, s * 1.7, s * 0.4, s * 0.2); g.fill();
    g.fillStyle = '#c98a3e';
    redondo(g, -s * 0.78, -s * 0.12, s * 1.56, s * 0.24, s * 0.1); g.fill();
    g.fillStyle = '#4a2a18';
    redondo(g, -s * 0.85, s * 0.1, s * 1.7, s * 0.4, s * 0.2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.25)';
    redondo(g, -s * 0.6, -s * 0.45, s * 0.7, s * 0.1, s * 0.05); g.fill();
    g.restore();
  }

  function mate(g, s) {
    g.save();
    g.strokeStyle = '#c9ced6'; g.lineWidth = s * 0.12; g.lineCap = 'round';
    g.beginPath(); g.moveTo(s * 0.1, -s * 0.3); g.lineTo(s * 0.55, -s * 1.0); g.stroke();
    g.fillStyle = '#8a5a2b';
    g.beginPath(); g.ellipse(0, s * 0.2, s * 0.65, s * 0.72, 0, 0, 7); g.fill();
    g.fillStyle = '#5a8f2e';
    g.beginPath(); g.ellipse(0, -s * 0.38, s * 0.42, s * 0.14, 0, 0, 7); g.fill();
    g.fillStyle = '#d9b26a';
    redondo(g, -s * 0.5, -s * 0.3, s * 1.0, s * 0.12, s * 0.06); g.fill();
    g.restore();
  }

  function paraguas(g, s) {
    g.save();
    const col = ['#ff5d8f', '#ffc93c', '#3cc4ff', '#3ccf7e'];
    for (let k = 0; k < 4; k++) {
      g.fillStyle = col[k];
      g.beginPath(); g.moveTo(0, -s * 0.1);
      g.arc(0, -s * 0.1, s, Math.PI + (k / 4) * Math.PI, Math.PI + ((k + 1) / 4) * Math.PI);
      g.closePath(); g.fill();
    }
    g.strokeStyle = '#2a1640'; g.lineWidth = s * 0.1; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -s * 0.1); g.lineTo(0, s * 0.75); g.arc(-s * 0.18, s * 0.75, s * 0.18, 0, Math.PI); g.stroke();
    g.restore();
  }

  function granizo(g, s) {
    const gr = g.createRadialGradient(-s * 0.3, -s * 0.3, s * 0.1, 0, 0, s);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#cfe9ff'); gr.addColorStop(1, '#8cc4ef');
    g.fillStyle = gr;
    g.beginPath();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2, r = s * (0.82 + ((k * 37) % 7) / 40);
      k ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(80,140,200,.6)'; g.lineWidth = s * 0.08; g.stroke();
  }

  function brillo(g, s) {
    g.fillStyle = '#fff';
    for (const [x, y, r] of [[-1.1, -0.6, 0.14], [1.0, -0.5, 0.1], [0.2, -0.75, 0.08]]) {
      g.beginPath();
      g.moveTo(s * x, s * (y - r * 2)); g.lineTo(s * (x + r * 0.5), s * y); g.lineTo(s * x, s * (y + r * 2)); g.lineTo(s * (x - r * 0.5), s * y);
      g.closePath(); g.fill();
    }
  }

  function redondo(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  const DIBUJO = { chori: (g, s) => chori(g, s), oro: (g, s) => chori(g, s, true), empanada, alfajor, mate, paraguas, granizo };

  function parrilla(g, x, y, w, escudo) {
    const h = w * 0.16;
    g.save();
    // brasas
    const br = g.createRadialGradient(x, y + h * 1.4, 2, x, y + h * 1.4, w * 0.55);
    br.addColorStop(0, 'rgba(255,140,40,.75)'); br.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = br; g.fillRect(x - w * 0.6, y, w * 1.2, h * 3);
    // patas
    g.strokeStyle = '#2b2b33'; g.lineWidth = w * 0.035; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - w * 0.4, y + h); g.lineTo(x - w * 0.46, y + h * 2.6); g.moveTo(x + w * 0.4, y + h); g.lineTo(x + w * 0.46, y + h * 2.6); g.stroke();
    // batea
    g.fillStyle = '#3a3a44';
    redondo(g, x - w / 2, y, w, h, h * 0.35); g.fill();
    // rejilla
    g.strokeStyle = '#9aa0ab'; g.lineWidth = w * 0.022;
    g.beginPath(); g.moveTo(x - w * 0.52, y); g.lineTo(x + w * 0.52, y); g.stroke();
    g.strokeStyle = '#6c717c'; g.lineWidth = w * 0.012;
    for (let k = -5; k <= 5; k++) { g.beginPath(); g.moveTo(x + k * w * 0.09, y - h * 0.15); g.lineTo(x + k * w * 0.09, y + h * 0.15); g.stroke(); }
    if (escudo) {
      g.globalAlpha = 0.85;
      g.translate(x, y - w * 0.45);
      paraguas(g, w * 0.5);
    }
    g.restore();
  }

  function cielo(g, W, H, oscuro) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    const a = 1 - oscuro;
    gr.addColorStop(0, `rgb(${Math.round(70 + 60 * a)},${Math.round(90 + 100 * a)},${Math.round(150 + 90 * a)})`);
    gr.addColorStop(1, `rgb(${Math.round(150 + 80 * a)},${Math.round(150 + 70 * a)},${Math.round(190 + 40 * a)})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  function nube(g, x, y, s, oscuro) {
    const c = Math.round(255 - oscuro * 120);
    g.fillStyle = `rgba(${c},${c},${c + 10 > 255 ? 255 : c + 10},.92)`;
    for (const [dx, dy, r] of [[0, 0, 0.5], [0.45, 0.1, 0.4], [-0.45, 0.12, 0.38], [0.15, -0.25, 0.4]]) {
      g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); g.fill();
    }
  }

  function portada(cv) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    cielo(g, W, H, 0.15);
    nube(g, 110, 70, 120, 0.2); nube(g, 470, 60, 140, 0.3);
    const dib = (f, x, y, s, r) => { g.save(); g.translate(x, y); g.rotate(r); DIBUJO[f](g, s); g.restore(); };
    dib('chori', 150, 160, 44, -0.4); dib('empanada', 300, 110, 40, 0.3); dib('granizo', 420, 170, 20, 0);
    dib('alfajor', 480, 240, 34, -0.2); dib('oro', 250, 220, 36, 0.5); dib('granizo', 90, 250, 16, 0);
    parrilla(g, 300, 300, 200, false);
  }

  // ---------- Juego ----------
  function jugar() {
    App.despierto(true);
    const p = App.pantalla({ clase: 'gr-juego', html: `
      <canvas id="lienzo"></canvas>
      <div class="gr-hud">
        <button class="btn-redondo" id="pausa" aria-label="Pausa">⏸</button>
        <div class="gr-puntos"><b id="puntos">0</b><span id="combo"></span></div>
        <div class="gr-vidas" id="vidas"></div>
      </div>
      <div class="gr-poder" id="poder"></div>
      <div class="gr-ayuda" id="ayuda">${control === 'dedo' ? '👆 Arrastrá el dedo para mover la parrilla' : '📱 Incliná el celu para mover la parrilla'}</div>` });
    const cv = p.querySelector('#lienzo');
    const g = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1;

    function medir() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    medir();
    window.addEventListener('resize', medir);

    const J = {
      t: 0, puntos: 0, combo: 0, vidas: VIDAS, cosas: [], chispas: [], textos: [], rayos: [],
      x: W / 2, objetivo: W / 2, escudo: 0, lento: 0, golpe: 0, sacudon: 0, proxima: 0.6, proximoRayo: 28,
      nubes: Array.from({ length: 5 }, (_, k) => ({ x: Math.random() * W, y: 30 + k * 26, v: 6 + Math.random() * 10, s: 50 + Math.random() * 40 })),
      fin: false, pausa: false,
    };
    const ancho = () => Math.min(W * 0.3, 150);
    const tam = () => Math.min(W * 0.07, 32);
    const yParrilla = () => H - Math.max(110, H * 0.14);

    function elegir() {
      const pGranizo = Math.min(0.5, 0.16 + J.t * 0.006);
      if (azar() < pGranizo) return 'granizo';
      const lista = Object.entries(COSAS);
      let r = azar() * lista.reduce((s, [, c]) => s + c.peso, 0);
      for (const [k, c] of lista) { r -= c.peso; if (r <= 0) return k; }
      return 'chori';
    }

    function soltar() {
      const tipo = elegir();
      const s = tipo === 'granizo' ? tam() * (0.55 + azar() * 0.35) : tam();
      J.cosas.push({
        tipo, s, x: s * 1.3 + azar() * (W - s * 2.6), y: -s * 2,
        v: H * (0.22 + Math.min(J.t, 150) * 0.0045) * (tipo === 'granizo' ? 1.25 : 1) * (0.85 + azar() * 0.3),
        rot: azar() * 6, vr: (azar() - 0.5) * 3,
      });
    }

    function chispas(x, y, color, n = 10) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
        J.chispas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, vida: 0.6, color });
      }
    }
    const texto = (x, y, t, color) => J.textos.push({ x, y, t, color, vida: 0.9 });

    function perderVida() {
      if (J.golpe > 0 || J.fin) return;
      J.vidas--;
      J.combo = 0;
      J.golpe = 1.2;
      J.sacudon = 0.35;
      Sonido.error();
      App.vibrar([80, 40, 80]);
      if (J.vidas <= 0) terminar();
    }

    function atajar(c) {
      const info = COSAS[c.tipo];
      if (c.tipo === 'granizo') {
        if (J.escudo > 0) { chispas(c.x, c.y, '#cfe9ff', 8); Sonido.clac(true); return; }
        chispas(c.x, c.y, '#cfe9ff', 12);
        Sonido.piedra();
        perderVida();
        return;
      }
      if (info.poder) {
        if (info.poder === 'lento') J.lento = 5;
        else J.escudo = 6;
        texto(c.x, c.y, info.poder === 'lento' ? '¡Cámara lenta!' : '¡Paraguas!', '#fff');
        Sonido.revelar();
        chispas(c.x, c.y, '#ffc93c', 14);
        return;
      }
      J.combo++;
      const mult = 1 + Math.floor(J.combo / 5);
      const pts = info.pts * mult;
      J.puntos += pts;
      texto(c.x, c.y - c.s, `+${pts}`, c.tipo === 'oro' ? '#ffd54a' : '#fff');
      chispas(c.x, c.y, c.tipo === 'oro' ? '#ffd54a' : '#ff9a4a', c.tipo === 'oro' ? 20 : 8);
      Sonido.racimo(Math.min(mult, 6));
      if (c.tipo === 'oro') App.vibrar(60);
    }

    // Controles
    const mover = e => { const r = cv.getBoundingClientRect(); J.objetivo = e.clientX - r.left; };
    cv.addEventListener('pointerdown', e => { mover(e); ocultarAyuda(); });
    cv.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') mover(e); });
    let inclinacion = 0;
    const onOri = e => { if (e.gamma != null) inclinacion = e.gamma; };
    if (control === 'inclinar') window.addEventListener('deviceorientation', onOri);
    const ayuda = p.querySelector('#ayuda');
    let ayudaVisible = true;
    const ocultarAyuda = () => { if (ayudaVisible) { ayudaVisible = false; ayuda.classList.add('chau'); } };
    setTimeout(ocultarAyuda, 3500);

    function actualizar(dt) {
      J.t += dt;
      const lentitud = J.lento > 0 ? 0.45 : 1;
      if (control === 'inclinar') J.objetivo = Math.max(0, Math.min(W, J.objetivo + inclinacion * dt * W * 0.06));
      J.x += (J.objetivo - J.x) * Math.min(1, dt * 18);
      const w = ancho();
      J.x = Math.max(w / 2, Math.min(W - w / 2, J.x));
      J.escudo = Math.max(0, J.escudo - dt);
      J.lento = Math.max(0, J.lento - dt);
      J.golpe = Math.max(0, J.golpe - dt);
      J.sacudon = Math.max(0, J.sacudon - dt);

      J.proxima -= dt * lentitud;
      if (J.proxima <= 0) {
        soltar();
        J.proxima = Math.max(0.22, 0.85 - J.t * 0.0065) * (0.7 + azar() * 0.6);
      }

      // Rayos: aviso con una franja que titila y después el golpe.
      if (J.t > J.proximoRayo) {
        J.proximoRayo = J.t + Math.max(4, 10 - J.t * 0.03) + azar() * 4;
        const rw = w * 0.9;
        J.rayos.push({ x: rw / 2 + azar() * (W - rw), w: rw, t: 0 });
      }
      for (const r of J.rayos) {
        r.t += dt * lentitud;
        if (!r.cayo && r.t > 1.3) {
          r.cayo = true;
          Sonido.boom();
          App.vibrar(120);
          if (Math.abs(J.x - r.x) < (r.w + w) / 2 * 0.8) {
            if (J.escudo > 0) chispas(J.x, yParrilla(), '#fff59d', 16);
            else perderVida();
          }
        }
      }
      J.rayos = J.rayos.filter(r => r.t < 1.65);

      const yp = yParrilla();
      for (const c of J.cosas) {
        c.y += c.v * dt * lentitud;
        c.rot += c.vr * dt * lentitud;
        if (!c.listo && c.y + c.s * 0.5 >= yp - 4 && c.y - c.s * 0.5 <= yp + 10 && Math.abs(c.x - J.x) < w / 2 + c.s * 0.4) {
          c.listo = 'atajado';
          atajar(c);
        } else if (!c.listo && c.y - c.s > H) {
          c.listo = 'perdido';
          if (c.tipo !== 'granizo' && !COSAS[c.tipo].poder) J.combo = 0;
        }
      }
      J.cosas = J.cosas.filter(c => !c.listo);

      for (const s of J.chispas) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 400 * dt; s.vida -= dt; }
      J.chispas = J.chispas.filter(s => s.vida > 0);
      for (const t of J.textos) { t.y -= 50 * dt; t.vida -= dt; }
      J.textos = J.textos.filter(t => t.vida > 0);
      for (const n of J.nubes) { n.x += n.v * dt; if (n.x - n.s > W) n.x = -n.s; }
    }

    function dibujar() {
      g.save();
      if (J.sacudon > 0) g.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
      const oscuro = Math.min(0.75, J.t / 140);
      cielo(g, W, H, oscuro);
      for (const n of J.nubes) nube(g, n.x, n.y, n.s, oscuro);

      for (const r of J.rayos) {
        if (!r.cayo) {
          g.fillStyle = `rgba(255,240,120,${0.12 + 0.14 * (Math.sin(r.t * 22) > 0 ? 1 : 0)})`;
          g.fillRect(r.x - r.w / 2, 0, r.w, H);
        } else {
          g.fillStyle = `rgba(255,255,255,${Math.max(0, 0.8 - (r.t - 1.3) * 2.5)})`;
          g.fillRect(0, 0, W, H);
          g.strokeStyle = '#fff59d'; g.lineWidth = 6; g.lineJoin = 'round';
          g.beginPath();
          let x = r.x;
          g.moveTo(x, 0);
          for (let y = 0; y < yParrilla(); y += 40) { x = r.x + (Math.random() - 0.5) * r.w * 0.6; g.lineTo(x, y); }
          g.lineTo(r.x, yParrilla());
          g.stroke();
        }
      }

      for (const c of J.cosas) {
        g.save(); g.translate(c.x, c.y); g.rotate(c.rot); DIBUJO[c.tipo](g, c.s); g.restore();
      }

      // pasto
      g.fillStyle = '#5bbf4a'; g.fillRect(0, yParrilla() + ancho() * 0.4, W, H);
      g.fillStyle = '#4aa83b'; g.fillRect(0, yParrilla() + ancho() * 0.4, W, 6);

      if (!(J.golpe > 0 && Math.floor(J.golpe * 10) % 2)) parrilla(g, J.x, yParrilla(), ancho(), J.escudo > 0);

      for (const s of J.chispas) { g.globalAlpha = Math.max(0, s.vida / 0.6); g.fillStyle = s.color; g.fillRect(s.x - 3, s.y - 3, 6, 6); }
      g.globalAlpha = 1;
      g.textAlign = 'center';
      g.font = '700 22px Fredoka, sans-serif';
      for (const t of J.textos) {
        g.globalAlpha = Math.min(1, t.vida * 2);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(t.t, t.x + 2, t.y + 2);
        g.fillStyle = t.color; g.fillText(t.t, t.x, t.y);
      }
      g.globalAlpha = 1;
      if (J.lento > 0) { g.fillStyle = 'rgba(120,200,255,.12)'; g.fillRect(0, 0, W, H); }
      g.restore();
    }

    const elPuntos = p.querySelector('#puntos'), elCombo = p.querySelector('#combo'), elVidas = p.querySelector('#vidas'), elPoder = p.querySelector('#poder');
    let hudPrevio = '';
    function hud() {
      const mult = 1 + Math.floor(J.combo / 5);
      const clave = `${J.puntos}|${mult}|${J.vidas}|${Math.ceil(J.lento)}|${Math.ceil(J.escudo)}`;
      if (clave === hudPrevio) return;
      hudPrevio = clave;
      elPuntos.textContent = J.puntos;
      elCombo.textContent = mult > 1 ? `×${mult}` : '';
      elVidas.textContent = '❤️'.repeat(Math.max(0, J.vidas)) + '🤍'.repeat(VIDAS - Math.max(0, J.vidas));
      elPoder.textContent = J.lento > 0 ? `🧉 ${Math.ceil(J.lento)}` : J.escudo > 0 ? `☂️ ${Math.ceil(J.escudo)}` : '';
    }

    let ultimo = performance.now(), cuadro = 0, vivo = true;
    function bucle(ahora) {
      if (!vivo) return;
      const dt = Math.min(0.05, (ahora - ultimo) / 1000);
      ultimo = ahora;
      if (!J.pausa && !J.fin) actualizar(dt);
      dibujar();
      hud();
      cuadro = requestAnimationFrame(bucle);
    }
    cuadro = requestAnimationFrame(bucle);

    function pausar(si) {
      if (J.fin) return;
      J.pausa = si;
      if (!si) { ultimo = performance.now(); return; }
      const d = document.createElement('div');
      d.className = 'modal ver';
      d.innerHTML = `<div class="modal-caja"><h2>Pausa</h2><p>${J.puntos} puntos</p>
        <div class="fila"><button class="btn gris" data-r="salir">Salir</button><button class="btn verde" data-r="seguir">Seguir</button></div></div>`;
      document.body.appendChild(d);
      d.addEventListener('click', e => {
        const b = e.target.closest('[data-r]');
        if (!b) return;
        d.remove();
        if (b.dataset.r === 'salir') { if (duelo) salirDuelo(false); else inicio(); } else pausar(false);
      });
    }
    p.querySelector('#pausa').onclick = () => pausar(true);
    const alOcultar = () => { if (document.hidden && !J.pausa) pausar(true); };
    document.addEventListener('visibilitychange', alOcultar);

    function terminar() {
      J.fin = true;
      if (duelo) {
        Sonido.fin();
        duelo.alTerminar({ valor: J.puntos, texto: `${J.puntos} puntos` });
        setTimeout(() => {
          if (!vivo) return;
          const d = document.createElement('div');
          d.className = 'modal ver';
          d.innerHTML = `<div class="modal-caja ganador"><span class="emo">⛈️</span><h2>¡Se largó la tormenta!</h2><p>${J.puntos} puntos · ${Math.floor(J.t)} segundos</p>
            <button class="btn grande verde" data-r="sala">Ver la tabla del duelo</button></div>`;
          document.body.appendChild(d);
          d.querySelector('[data-r]').onclick = () => { d.remove(); salirDuelo(true); };
        }, 900);
        return;
      }
      const record = App.leer('granizada:record', 0);
      const nuevo = J.puntos > record;
      if (nuevo) App.guardar('granizada:record', J.puntos);
      Sonido.fin();
      setTimeout(() => {
        if (!vivo) return;
        if (nuevo) { Sonido.ganar(); App.confeti(150); }
        const d = document.createElement('div');
        d.className = 'modal ver';
        d.innerHTML = `<div class="modal-caja ganador">
          <span class="emo">${nuevo ? '🏆' : '⛈️'}</span>
          <h2>${nuevo ? '¡Nuevo récord!' : '¡Se largó la tormenta!'}</h2>
          <p>${J.puntos} puntos · ${Math.floor(J.t)} segundos</p>
          ${!nuevo && record ? `<p style="font-size:1rem;opacity:.8">Récord: ${record}</p>` : ''}
          <div class="fila"><button class="btn gris" data-r="salir">Salir</button><button class="btn naranja" data-r="otra">Otra</button></div>
        </div>`;
        document.body.appendChild(d);
        d.addEventListener('click', e => {
          const b = e.target.closest('[data-r]');
          if (!b) return;
          d.remove();
          b.dataset.r === 'otra' ? jugar() : inicio();
        });
      }, 900);
    }

    puntosActuales = () => J.puntos;
    App.alSalir(() => {
      vivo = false;
      cancelAnimationFrame(cuadro);
      window.removeEventListener('resize', medir);
      window.removeEventListener('deviceorientation', onOri);
      document.removeEventListener('visibilitychange', alOcultar);
      document.querySelectorAll('.modal').forEach(m => m.remove());
      App.despierto(false);
    });
  }

  // ---------- Duelo en red ----------
  let puntosActuales = () => 0;
  let controlAntes = control;
  function desafio(semilla, cb) {
    duelo = cb;
    controlAntes = control;
    control = 'dedo'; // en el duelo, con el dedo (inclinar pide permisos)
    azar = App.azarCon(semilla);
    Sonido.desbloquear();
    jugar();
  }

  function salirDuelo(termino) {
    const d = duelo;
    if (!d) return;
    if (!termino) d.alTerminar({ valor: puntosActuales(), texto: `${puntosActuales()} puntos (abandonó)` });
    duelo = null;
    azar = Math.random;
    control = controlAntes;
    d.volver();
  }

  return { inicio, desafio };
})();
