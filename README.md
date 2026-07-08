# GFC BOX — Dashboard de Diagnóstico IST

Dashboard interactivo (HTML + CSS + JS puro, sin frameworks ni build step) para analizar los registros de falla de prueba en sistema (IST) de las tarjetas GFC BOX. 100% portable y listo para publicarse en **GitHub Pages**.

## Estructura del proyecto

```
Dashboard/
│
├── index.html          → página principal (ábrela desde aquí)
├── style.css           → todos los estilos
├── script.js           → toda la lógica (filtros, gráficas, tablas)
│
├── data/
│   └── datos.json       → dataset (extraído de Info_Mau.xlsx)
│
├── assets/
│   ├── iconos/          → reservado para íconos futuros (vacío por ahora)
│   ├── imagenes/        → reservado para imágenes futuras (vacío por ahora)
│   └── README.txt
│
└── README.md
```

> **Nota:** el dashboard actual no usa ningún logo ni imagen — el ícono de la marca y todos los indicadores se generan con CSS/SVG, por lo que la carpeta `assets/` queda vacía y lista por si en el futuro agregas un logo real.

Todas las rutas dentro del proyecto son **relativas** (`style.css`, `script.js`, `data/datos.json`). No existe ninguna ruta absoluta de sistema operativo (`C:\`, `D:\`, `file://`, etc.), por lo que el proyecto funciona igual sin importar en qué computadora, carpeta o dominio se aloje.

La única dependencia externa es una fuente de **Google Fonts** cargada por CDN (`<link>` en `index.html`) — no requiere descarga ni instalación.

---

## 1. Crear un repositorio nuevo en GitHub

1. Entra a [github.com](https://github.com) e inicia sesión (o crea una cuenta).
2. Clic en el botón **"+"** (arriba a la derecha) → **"New repository"**.
3. Dale un nombre, por ejemplo `gfc-dashboard`.
4. Déjalo como **público** (para que GitHub Pages funcione gratis sin plan de pago).
5. Puedes dejar todas las demás opciones por defecto → clic en **"Create repository"**.

## 2. Subir los archivos

### Opción A — Desde la web (sin usar terminal)
1. Dentro del repositorio recién creado, clic en **"Add file" → "Upload files"**.
2. Arrastra **toda la carpeta** `Dashboard/` (o selecciona todos sus archivos y subcarpetas: `index.html`, `style.css`, `script.js`, `data/datos.json`, `assets/`, `README.md`).
3. Verifica que la estructura de carpetas se mantenga igual (GitHub respeta las subcarpetas al arrastrar).
4. Clic en **"Commit changes"**.

### Opción B — Desde terminal (git)
```bash
cd Dashboard
git init
git add .
git commit -m "Dashboard GFC BOX - versión inicial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/gfc-dashboard.git
git push -u origin main
```

## 3. Activar GitHub Pages

1. Dentro del repositorio, ve a **Settings** (⚙️, arriba).
2. En el menú izquierdo, clic en **Pages**.
3. En **Build and deployment → Source**, selecciona **"Deploy from a branch"**.
4. En **Branch**, elige `main` y carpeta `/ (root)` → clic en **Save**.
5. Espera 1–2 minutos. GitHub mostrará un mensaje con la URL pública, algo como:
   ```
   https://tu-usuario.github.io/gfc-dashboard/
   ```

## 4. Abrir el dashboard

Simplemente entra a la URL anterior desde cualquier navegador (Chrome, Edge, Firefox, Safari). Como `index.html` está en la raíz del repo, GitHub Pages lo sirve automáticamente al entrar a la URL base — no hace falta escribir `/index.html`.

No se requiere ninguna instalación ni configuración adicional por parte de quien lo visita.

### ¿Por qué no puedo simplemente abrir `index.html` con doble clic en mi computadora?
El dashboard carga los datos con `fetch('data/datos.json')`. Los navegadores bloquean por seguridad las peticiones `fetch` cuando el archivo se abre directo desde disco (protocolo `file://`). Esto **no es un problema en GitHub Pages** (ahí todo se sirve por `https://`), pero si quieres probarlo en tu computadora antes de subirlo, corre un servidor local simple desde la carpeta del proyecto:

```bash
# con Python instalado
python3 -m http.server 8000
```
y abre `http://localhost:8000` en tu navegador. (También funciona con la extensión "Live Server" de VS Code, o `npx serve`.)

---

## 5. Actualizar los datos más adelante

Cuando tengas un nuevo extracto de datos (por ejemplo, nuevas semanas de producción):

1. Genera un nuevo `datos.json` con la misma estructura que el actual (ver formato abajo).
2. Reemplaza el archivo `data/datos.json` en el repositorio:
   - Desde la web: entra a `data/datos.json` en GitHub → ícono de lápiz (editar) → pega el nuevo contenido → **Commit changes**. (Para archivos grandes es más fácil borrar el archivo viejo y subir el nuevo con "Add file → Upload files".)
   - Desde terminal: reemplaza el archivo local y corre:
     ```bash
     git add data/datos.json
     git commit -m "Actualización de datos"
     git push
     ```
3. GitHub Pages se actualiza solo, en 1-2 minutos, sin tocar `index.html`, `style.css` ni `script.js`.

### Formato esperado de `data/datos.json`
Para mantener el archivo ligero, los valores categóricos (línea, rack, turno, tipo de falla, etc.) se guardan como **índices** que apuntan a listas de valores únicos (`lookups`), en vez de repetir el texto en cada fila:

```json
{
  "lookups": {
    "revision": ["C","D","E","F"],
    "po": ["NA","PLG000372", "..."],
    "line": ["PHI-REPAIR-TLA-GF-LINE", "..."],
    "...": "..."
  },
  "cols": ["week","revision","po","serial","line","rack","slot","gen","testTime","turno","failName","failDesc","defectCode","location","rework","unitState","aparic"],
  "rows": [
    [27, 2, 6, "FLG2622-03355", 2, 15, 8, 2, "2026-06-29 11:56:30", 0, 41, 213, 26, 258, 0, 11, 2],
    "..."
  ]
}
```
Si prefieres regenerarlo desde un Excel/CSV nuevo, dile a Claude "genera el nuevo datos.json a partir de este archivo" y se encarga de recrearlo con el mismo formato — solo asegúrate de subir el Excel actualizado.

---

## Recursos no reconstruibles automáticamente

- **Ninguno.** Todo el contenido visual (ícono de marca, indicadores, gráficas, mapa de racks) se genera con CSS y SVG en tiempo real desde `script.js` y `style.css` — no depende de ninguna imagen externa que debiera regenerarse manualmente.
- La única dependencia fuera del propio repositorio son las tipografías de Google Fonts, cargadas por CDN público (`fonts.googleapis.com`). Si en algún momento no tienes acceso a internet, el dashboard sigue funcionando igual mostrando la fuente por defecto del sistema — solo cambia la tipografía, no la funcionalidad.

---

## Funcionalidad incluida (sin cambios respecto a la versión original)

- Mapa interactivo de racks × slots (click para filtrar)
- KPIs en vivo: total de fallas, % NDF, reincidentes ≥3, modo de falla top, defecto "Tester Instruments", delta semanal
- Filtros cruzados: semana, turno, línea, PO/lote, revisión, defect code, búsqueda por serial
- Tendencia semanal por línea
- Pareto de modos de falla con curva de acumulado y referencia al 80%
- Composición por turno, por Defect Code, por Location y por Rework Action
- Comparación por generación de prueba (First/Second/Third)
- Tabla de reincidencia por serial (ordenable)
- Tabla de perfil de falla por lote/PO (ordenable)
- Botón de limpiar filtros y leyenda de filtros activos
