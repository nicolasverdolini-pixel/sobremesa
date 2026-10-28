# Sobremesa

Juegos para jugar con amigos y familia en la juntada. Se instala en el celu como una app (en iPhone: Safari → Compartir → Agregar a inicio).

- **¿Quién soy?** — el celu en la frente; cabeza abajo = acierto, cabeza arriba = paso.
- **El Impostor** — todos ven la misma palabra menos uno. ¿Quién es?
- **Tabú** — por equipos: hacé adivinar sin decir las palabras prohibidas.
- **Mímica** — por equipos: actuá la palabra sin hablar.
- **La Bomba** — pasá el celu diciendo cosas de la consigna antes de que explote.
- **Ajedrez** — contra la compu (3 niveles) o de a dos en el mismo celu. Reglas completas, verificadas con perft (`js/ajedrez-motor.js`).
- **Damas** — contra la compu (3 niveles) o de a dos, con reglas configurables (`js/damas-motor.js`).
- **Granizada** — para jugar solo: atajá con la parrilla los choripanes que caen del cielo y esquivá el granizo y los rayos. Todo dibujado en `js/granizada.js`.
- **Racimo** — para jugar solo: juego de bloques propio. Juntá 4 del mismo color, explotan y contagian a las vecinas. Reglas en `js/racimo-reglas.js`.
- **Sudoku** — para jugar solo: cuatro niveles, cada tablero se genera al azar con solución única.
- **Crucigrama** — para jugar solo: tres niveles, la grilla se arma al azar con el banco de `js/crucigrama-palabras.js`.
- **Anotador de Truco** — Nosotros / Ellos, a 15 o a 30, con palitos de fósforo.
- **Sorteo de equipos** — cargá los nombres y armá 2 a 4 equipos al azar.

Hecho con HTML, CSS y JavaScript, sin dependencias. Las palabras están en `js/palabras.js` y las cartas de Tabú y consignas de La Bomba en `js/cartas.js`.

## Jugar con varios celus

En **Jugar en red** uno crea una sala (código de 4 letras) y los demás entran desde su celu, con el código o con el link de invitación.
El celu del anfitrión lleva el juego; el servidor (`servidor/`, un Cloudflare Worker con Durable Objects en la cuenta raizapp.oficial) solo reparte los mensajes.
Para publicar cambios del servidor: `cd servidor && npx wrangler deploy`.

Juegos en red: El Impostor, Tutti frutti, Ajedrez o Damas, Anotador de Truco, Sorteo de equipos, Tabú o Mímica, ¿Quién soy?, La Bomba y Duelos de Sudoku, Crucigrama, Racimo y Granizada (`js/*-red.js`). Para sumar otro, se agrega a `JUEGOS_RED` (ver `js/sala.js`).
