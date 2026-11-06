# Tokens de diseño de MMV (v0.24.0)

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

## Layout responsive (v0.31.0)
Variables de layout en `:root` al final de `styles.css` (`--rail`, `--ancho-tablet`, `--ancho-app`, `--ancho-lectura`). Cortes: 720 px (tablet) y 1024 px (riel lateral; también celular acostado de ≤ 520 px de alto). Las media queries no aceptan variables, así que los valores de los cortes están repetidos y una prueba los vigila.
