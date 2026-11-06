# Tokens de diseño de MMV (v0.34.0)

Todos los colores viven en `src/tokens.css`. Ni `styles.css` ni los componentes llevan hex/rgb (una prueba lo vigila). Única excepción: `theme-color` en `index.html` y `manifest.webmanifest` repite `--bg` (otra prueba comprueba que coincidan).

| Token | Valor | Uso | Contraste mínimo |
|---|---|---|---|
| `--bg` `--sf` `--sf-2` | #0a0f14 · #121923 · #1a2431 | fondo, tarjetas, chips/estados | — |
| `--tx` | #e6edf3 | títulos y valores | ≥ 7:1 |
| `--tx-2` (`--mu`) | #a9b7c6 | ayudas, unidades, etiquetas | ≥ 4,5:1 |
| `--tx-3` | #8d9aaa | placeholders | ≥ 4,5:1 sobre `--bg` |
| `--bd` | #5f7083 | borde de todo control tocable y campo | ≥ 3:1 |
| `--ln` | #1f2a37 | separadores decorativos (nunca marca algo tocable) | — |
| `--ac` | #22d3ee | **todo lo tocable**. Nunca texto informativo | ≥ 4,5:1 |
| `--pr` | #c6f432 | **un solo destacado por pantalla** (CTA o dato clave) | — |
| `--pos` `--neg` `--warn` `--info` | #4ade80 · #ff7a7a · #ffb454 · #8fb4ff | estados; siempre con ícono o texto | ≥ 4,5:1 |
| `--m-p` `--m-c` `--m-g` | cian · #8fb4ff · #c4a1ff | series de macros (con etiqueta de texto) | ≥ 3:1 |

## Botones
- **Secundario (por defecto, `button`)**: borde y texto cian, fondo transparente.
- **Primario `.pri`**: relleno cian. Como máximo uno por pantalla.
- **Destacado `.cta` / `.plus`**: lima. Es el único destacado de Hoy y del temporizador.
- **Deshabilitado**: gris (`--dis-bg`/`--dis-tx`) con opacidad, sin relleno ni borde cian.
- **Presionado**: `:active` (fondo `--ac-press`, escala .98). **Enlace** `.enlace`: sin borde, subrayado.
- `.ghost` sigue existiendo como sinónimo de secundario.

## Chips
Normal (`--sf-2` + borde `--bd`) · presionado (`:active`) · seleccionado (`.on` / `aria-pressed`, relleno cian y ✓).

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
