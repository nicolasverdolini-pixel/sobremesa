// La Bomba: el celu pasa de mano en mano diciendo cosas de la consigna. Explota cuando quiere.

const Bomba = (() => {
  const MECHAS = {
    corta: { nombre: 'Corta', min: 10, max: 25 },
    normal: { nombre: 'Normal', min: 20, max: 45 },
    larga: { nombre: 'Larga', min: 35, max: 70 },
  };
  let mecha = App.leer('bomba:mecha', 'normal');

  function inicio() {
    App.despierto(false);
    const p = App.pantalla({ titulo: 'La Bomba', volver: App.menu, clase: 'bomba-inicio', html: `
      <div class="bomba-ilus"><span class="bomba-emo">💣</span></div>
      <div class="opcion">
        <span>Mecha</span>
        <div class="segmentos" id="mecha">
          ${Object.entries(MECHAS).map(([k, m]) => `<button data-k="${k}" class="${k === mecha ? 'on' : ''}">${m.nombre}</button>`).join('')}
        </div>
      </div>
      <div class="como">
        <b>Cómo se juega</b>
        <p>Aparece una consigna (por ejemplo, "Frutas"). El que tiene el celu dice algo que entre en la consigna y lo pasa al de al lado. ¡No se puede repetir! Nadie sabe cuándo explota: el que la tiene en la mano cuando hace <b>¡BUM!</b>, pierde.</p>
      </div>
      <div class="acciones"><button class="btn grande rojo" id="encender" data-sin>🔥 Encender la mecha</button></div>` });
    p.querySelectorAll('#mecha button').forEach(b => {
      b.onclick = () => {
        mecha = b.dataset.k;
        App.guardar('bomba:mecha', mecha);
        p.querySelectorAll('#mecha button').forEach(x => x.classList.toggle('on', x === b));
      };
    });
    p.querySelector('#encender').onclick = () => { Sonido.desbloquear(); jugar(); };
  }

  function jugar() {
    const m = MECHAS[mecha];
    const total = (m.min + Math.random() * (m.max - m.min)) * 1000;
    let inicioT = Date.now();
    let timer = null, explotada = false;

    const p = App.pantalla({ clase: 'bomba-juego', html: `
      <div class="qs-arriba">
        <button class="btn-redondo" id="salir" aria-label="Salir">✕</button>
        <span class="bomba-titulo">¡Pasala!</span>
        <span style="width:46px"></span>
      </div>
      <div class="bomba-centro">
        <small>Consigna</small>
        <b id="consigna"></b>
        <div class="bomba-emo latiendo" id="bomba">💣</div>
      </div>
      <button class="btn chico gris" id="otra">Cambiar consigna</button>` });
    const elBomba = p.querySelector('#bomba');
    const nueva = () => { p.querySelector('#consigna').textContent = App.sacar('bomba', BOMBA); };
    nueva();
    App.despierto(true);
    Sonido.fosforo();

    // El tic-tac se acelera un poco hacia el final, pero nunca avisa exactamente cuándo.
    function tic() {
      const pasado = Date.now() - inicioT;
      if (pasado >= total) return explotar();
      const avance = pasado / total;
      Sonido.tictac(avance);
      elBomba.classList.remove('tic'); void elBomba.offsetWidth; elBomba.classList.add('tic');
      timer = setTimeout(tic, avance > 0.75 ? 260 : avance > 0.45 ? 400 : 560);
    }
    tic();

    function explotar() {
      explotada = true;
      Sonido.boom();
      App.vibrar([400, 100, 400]);
      const q = App.pantalla({ clase: 'bomba-boom', html: `
        <div class="boom">💥</div>
        <h2>¡BUM!</h2>
        <p>El que tiene el celu, ¡perdió!</p>
        <div class="acciones">
          <button class="btn grande blanco" id="otra" data-sin>🔥 Otra ronda</button>
          <button class="btn violeta" id="menu">Opciones</button>
        </div>` });
      q.querySelector('#otra').onclick = () => { Sonido.desbloquear(); jugar(); };
      q.querySelector('#menu').onclick = inicio;
    }

    p.querySelector('#otra').onclick = nueva;
    p.querySelector('#salir').onclick = async () => {
      if (explotada) return;
      clearTimeout(timer);
      const pausa = Date.now();
      if (await App.preguntar('¿Apagar la bomba?', 'Sí, salir', 'Seguir')) return inicio();
      inicioT += Date.now() - pausa;
      tic();
    };
    App.alSalir(() => { clearTimeout(timer); App.despierto(false); });
  }

  return { inicio };
})();
