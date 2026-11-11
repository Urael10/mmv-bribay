# Tokens de diseño de MMV (v0.46.0)

Todos los colores viven en `src/tokens.css`. Ni `styles.css` ni los componentes llevan hex/rgb (una prueba lo vigila). Única excepción: `theme-color` en `index.html` y `manifest.webmanifest` repite `--bg` (otra prueba comprueba que coincidan).

| Token | Valor | Uso | Contraste mínimo |
|---|---|---|---|
| `--bg` `--sf` `--sf-2` | #0a0f14 · #121923 · #1a2431 | fondo, tarjetas, chips/estados | — |
| `--tx` | #e6edf3 | títulos y valores | ≥ 7:1 |
| `--tx-2` (`--mu`) | #a9b7c6 | ayudas, unidades, etiquetas | ≥ 4,5:1 |
| `--tx-3` | #8d9aaa | placeholders | ≥ 4,5:1 sobre `--bg` |
| `--bd` | #5f7083 | borde de todo control tocable y campo | ≥ 3:1 |
| `--pista` | #506378 | pista vacía de los anillos (visible con el anillo en 0) | ≥ 3:1 sobre `--bg` |
| `--ln` | #1f2a37 | separadores decorativos (nunca marca algo tocable) | — |
| `--ac` | #22d3ee | **todo lo tocable**. Nunca texto informativo | ≥ 4,5:1 |
| `--pr` | #c6f432 | **un solo destacado por pantalla** (CTA o dato clave) | — |
| `--pos` `--neg` `--warn` `--info` | #4ade80 · #ff7a7a · #ffb454 · #8fb4ff | estados; siempre con ícono o texto | ≥ 4,5:1 |
| `--m-p` `--m-c` `--m-g` | cian · #8fb4ff · #c4a1ff | series de macros (con etiqueta de texto) | ≥ 3:1 |
| `--m-comida` `--m-agua` `--m-sueno` `--m-pasos` `--m-peso` | cian · #5aa9ff · #b8a4ff · #ff9f7a · #f0abfc | color por métrica en Hoy: arco del anillo e ícono (nunca el valor ni el texto) | ≥ 3:1 sobre `--bg` y `--sf` |

## Botones
- **Secundario (por defecto, `button`)**: borde y texto cian, fondo transparente.
- **Primario `.pri`**: relleno cian. Como máximo uno por pantalla.
- **Destacado `.cta` / `.plus`**: lima. Es el único destacado de Hoy y del temporizador.
- **Deshabilitado**: gris (`--dis-bg`/`--dis-tx`) con opacidad, sin relleno ni borde cian.
- **Presionado**: `:active` (fondo `--ac-press`, escala .98). **Enlace** `.enlace`: sin borde, subrayado.
- `.ghost` sigue existiendo como sinónimo de secundario.

## Chips
Normal (`--sf-2` + borde `--bd`) · presionado (`:active`) · seleccionado (`.on` / `aria-pressed`, relleno cian e ícono de tilde: `--ico-check`, pintado con máscara y `currentColor`).

## Variaciones y estados
- `claseVariacion(d, {neutra})` (`src/domain/variacion.js`): verde ▲ / rojo ▼ con comparación firme; gris con ▲/▼ si la semana sigue en curso o el dato no se juzga (peso).
- Rótulos de Pilares y tests: componente `Estado` (ícono + texto + color); el mapa está en `chipEstado`.
- Íconos: `src/ui/Icono.jsx`, un solo trazo de 2 px sobre 24×24.

## Cambiar un color
Edita solo `src/tokens.css` y corré `npm test`: las pruebas recalculan los contrastes.

## Forma, espacio y elevación (v0.31.0)
Radios, espacios y sombras también viven solo en `src/tokens.css`. `styles.css` y los componentes usan `var(--…)`.

| Token | Valor | Uso |
|---|---|---|
| `--r-card` | 24px | tarjetas grandes (`section`, preparación) |
| `--r-tile` | 18px | teselas y filas plegables de Hoy |
| `--r-ctl` | 14px | botón principal de Hoy |
| `--sp-1` … `--sp-6` | 4 · 8 · 12 · 16 · 24 · 32 px | separaciones |
| `--sombra-1` | dos capas suaves | elevación de tarjetas y teselas (reemplaza el borde) |
| `--ancho-app` | 520px (760px desde 840px de ancho) | ancho máximo de la app y de la barra inferior |

Las tarjetas ya no llevan borde: se separan del fondo con `--sf` y `--sombra-1`. El borde `--bd` sigue siendo obligatorio en los controles tocables.

## Lista limpia (v0.32.0)
Sin tokens nuevos. En Hoy, Entreno y Progreso (clase `plano` en `<main>`) las secciones pierden fondo, sombra, radio y relleno; el ritmo lo dan `--sp-5` entre filas y `--sp-6` entre bloques. Siguen con caja las de aviso (`.warn`) y con borde `--bd` todos los controles tocables. El lima sigue siendo uno por pantalla (botón de entrenar).

## Anillo de pasos y modo sueño (v0.34.0)
Sin tokens nuevos. El anillo de pasos usa `Anillo` (`--info`, `--pos` al llegar a la meta, `--sf-2` de pista); el estado del conteo va siempre con ícono + texto (`--pos` contando, `--warn` buscando o en pausa). La pantalla de dormir usa `--bg` y `--tx-2`, con el anillo a opacidad 0,6 para no encandilar. Cian = tocable y lima = destacado no se usan en los bloques nuevos (los botones heredan el estilo base).

## Modo bolsillo (v0.36.0)
Sin tokens nuevos. Total del día en `Anillo` (`--info`; `--pos` al llegar a la meta; `--warn` en pausa); estado con ícono + texto (`--pos` contando, `--warn` buscando o en pausa); barras de señal de GPS (`--pos` buena, `--warn` débil, `--tx-dis` apagadas o en pausa) siempre con el texto al lado. La onda por paso usa `--info`. Cian = tocable y lima = destacado no se usan en el bloque; los botones de mantener presionado heredan el borde base de `.ghost`. Toda animación se apaga con `prefers-reduced-motion`.

## Arreglos de las capturas (v0.39.0)
Dos tokens nuevos: `--pista` (color de la pista de los anillos; las pantallas casi negras de dormir y bolsillo siguen con `--sf-2`) y `--ico-check` (no es un color: el trazo del tilde como imagen de máscara, para que ni el CSS lleve el carácter ✓). Los anillos de Hoy llevan un ícono en el centro (`--tx-2`, `--pos` al llegar a la meta).

## Color por métrica en Hoy (v0.44.0)
Cinco tokens nuevos: `--m-comida` (= `--ac`, cian: así lo pediste), `--m-agua`, `--m-sueno`, `--m-pasos` y `--m-peso`. Cada fila de Hoy declara su métrica con una clase (`m-agua`, …) que fija `--m`; el arco del anillo y el ícono usan `var(--m)`. **Verde, ámbar y rojo no son color de métrica**: al llegar a la meta el anillo pasa a `--pos` como siempre (una prueba exige que ningún `--m-*` coincida con `--pos`, `--neg` ni `--warn`). El valor y el texto siguen en `--tx` y `--tx-2`. El cian de la fila de Comida es dato, no acción: toda la fila sigue siendo lo tocable. Peso no tiene meta y mantiene su círculo fijo, con el ícono en `--m-peso`.

## Hoy en rejilla (v0.45.0)
Sin tokens nuevos. Los cuatro mosaicos con meta (Comida, Agua, Sueño, Pasos) van de a dos con `--sf`, `--sombra-1` y `--r-tile`, `--sp-3` de separación y de relleno; el anillo mide 40 px y el valor 22 px. Peso ocupa las dos columnas en una fila. Al pasar el cursor el mosaico pasa a `--sf-2`. El color de métrica sigue solo en el arco y el ícono.

## Nota del día (v0.46.0)
Sin tokens nuevos. Una franja de una línea arriba de la rejilla de Hoy (`--sf`, `--sombra-1`, `--r-tile`; al pasar el cursor `--sf-2`) que se abre al tocarla y muestra hasta 3 señales. El texto va en `--tx` y el ícono en `--tx-2`: **no usa** los colores de métrica (`--m-*`) ni los de estado (`--pos`, `--neg`, `--warn`, `--info`) ni el lima. El cian (`--ac`) está solo en el chevron, porque es lo único tocable. En pantalla ancha ocupa una fila propia debajo de la preparación y la rejilla.
