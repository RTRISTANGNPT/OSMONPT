# OsmoNPT

**Evaluación integral de Nutrición Parenteral.**

OsmoNPT es una herramienta web de apoyo para la evaluación de formulaciones de Nutrición Parenteral (NPT). Estima la osmolaridad final, el aporte proteico, el volumen de agua, los volúmenes de cada componente y las calorías totales, proteicas y no proteicas. También da una orientación de acceso venoso (periférica o central) a partir de la osmolaridad calculada y avisa si los componentes superan el volumen total prescrito.

> OsmoNPT es una herramienta de apoyo. No sustituye el juicio clínico, la prescripción individualizada ni la validación farmacéutica.

## Privacidad

- Todo el cálculo ocurre **en el navegador**. No hay servidor, base de datos, cuentas de usuario, cookies ni analítica.
- La página no solicita nombres, expedientes ni otros datos identificables de pacientes.
- El código de referencia del resumen impreso se genera en el navegador y no contiene datos del paciente.
- El navegador solo recuerda, en el propio dispositivo, el **hospital** y los **productos comerciales** elegidos (`localStorage`). No se guardan cálculos, pesos, volúmenes ni dosis.
- La política de seguridad (`vercel.json` y `<meta>` en `index.html`) usa `connect-src 'none'`, `form-action 'none'` y `img-src 'self' data:`. El navegador **bloquea** cualquier intento de enviar datos a otro servidor, incluso si el código se modificara por error.
- La única conexión externa es la descarga de las tipografías (Inter y Manrope) desde Google Fonts al abrir la página. No lleva ningún dato ingresado. Para eliminarla, descargue las fuentes, guárdelas en `assets/fonts/` y cambie el enlace de `index.html` por un `@font-face` propio en `styles.css` (ajustando `font-src` y `style-src`).
- Como todo sitio alojado, el proveedor de hosting (Vercel) puede registrar las visitas (por ejemplo, dirección IP y hora). Nunca recibe lo que se escribe en la calculadora.

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Diseño, colores, adaptación a celular e impresión |
| `app.js` | Cálculos, pestañas, código de referencia e impresión |
| `assets/` | Logo e íconos |
| `favicon.ico`, `manifest.webmanifest` | Ícono de la pestaña y de la aplicación |
| `vercel.json` | Cabeceras de seguridad para Vercel |
| `LICENSE` | Todos los derechos reservados |

No hay dependencias, `package.json` ni paso de compilación: es un sitio estático.

## Probar en el computador

Abra `index.html` con doble clic. Funciona sin internet (las tipografías usarán las del sistema).

Para probarlo como en un servidor:

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Publicar en Vercel

1. Suba el contenido de esta carpeta a un repositorio de GitHub.
2. En Vercel: **Add New… → Project → Import** el repositorio.
3. Framework Preset: **Other**. Deje vacíos *Build Command*, *Output Directory* e *Install Command*.
4. Presione **Deploy**.

## Cómo modificar

Todo está en `app.js`:

- **Componentes y productos comerciales:** arreglo `COMPONENTS`. Cada producto define `conc` (cantidad por mL de la unidad del componente) y `osm` (mOsm por mL). Para agregar otra marca, añada un objeto a la lista `brands` del componente. Use siempre los datos de la ficha técnica del producto.
- **Hospitales del código de referencia:** arreglo `HOSPITALS`.
- **Límite de orientación:** constante `LIMIT` (900 mOsm/L).
- **Factores calóricos:** propiedad `kcal` de cada macronutriente (aminoácidos 4, dextrosa monohidrato 3.4, lípidos 10 kcal/g).

## Código de referencia

Formato: `ONP-<hospital>-<AAMMDD>-<HHMM>-<verificación>`, por ejemplo `ONP-HST-260921-0432-9MMQ`.

- Se genera al imprimir el resumen, solo en el navegador.
- Los 4 caracteres finales se calculan a partir de los datos del cálculo (hospital, volumen, peso, dosis y productos). Los mismos datos dan la misma verificación y cualquier cambio la modifica. No permiten reconstruir ningún dato.
- Identifica únicamente el resumen impreso.

---

© 2026 OsmoNPT. Todos los derechos reservados.
