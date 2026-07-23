# BTMM-BMWT-CR

PWA offline-first para registrar giras de campo, puntos de observación, muestreos
de macroinvertebrados acuáticos, identificación asistida, perfil mojado y caudal.

La interfaz es **mobile-first**: está diseñada primero para captura con smartphone
en campo, con navegación inferior fija, controles táctiles amplios, formularios
de una columna y accesos rápidos a los tipos principales de registro. En pantallas
grandes se adapta a una distribución de dos columnas.

## Funciones

- Datos preliminares de gira: expediente, fecha, participantes, sector, cuerpo de
  agua, meteorología y objetivo.
- Coordenadas en todos los puntos de observación, macroinvertebrados y perfil:
  conserva la lectura WGS84 del GPS y calcula CRTM05.
- Selector entre `CR05 / CRTM05 (EPSG:5367)` y
  `CR-SIRGAS / CRTM05 (EPSG:8908)`.
- Fotografías sin límite fijado por la aplicación, almacenadas como archivos
  binarios offline en IndexedDB. El límite real es el espacio que el navegador
  conceda al dispositivo.
- Muestreo de macroinvertebrados con método, esfuerzo, hábitats, sustrato,
  ribera, preservante, familias y cálculo preliminar BMWP-CR por muestra.
- Identificación asistida offline mediante rasgos observables y candidatos de
  orden/familia. No se presenta como identificación taxonómica confirmada.
- Múltiples secciones de perfil mojado, cada una con sus propias verticales,
  fotografías y cálculo de caudal.
- Respaldo ZIP con JSON, CSV, fotografías y manifiesto de asociación.
- Migración automática de los datos básicos guardados por la versión 1.

## Fotografías

Las fotografías no se incluyen dentro de `localStorage`; se guardan en
IndexedDB para evitar el límite reducido de almacenamiento de texto. La pestaña
**Respaldar** muestra el uso estimado y permite solicitar almacenamiento
persistente. Se recomienda descargar un ZIP al finalizar cada gira.

## Coordenadas

El dispositivo entrega coordenadas geográficas WGS84. La aplicación conserva la
lectura original, precisión, altitud y fecha, y ejecuta localmente la proyección
Transversa de Mercator de CRTM05. Para trabajos geodésicos o catastrales se debe
aplicar la transformación oficial y el control correspondiente; una lectura de
teléfono no sustituye levantamiento topográfico.

SNIT documenta que `EPSG:5367` corresponde a CR05/CRTM05 y que
`EPSG:8908` corresponde a CR-SIRGAS/CRTM05, sistema que reemplaza al anterior
desde 2018.

## Identificación

La clave offline usa caracteres externos que pueden verse en campo o con lupa.
La identificación a familia debe confirmarse con una clave taxonómica adecuada,
material preservado y, cuando corresponda, un especialista. Para añadir
clasificación automática de fotografías se requiere un conjunto de entrenamiento
costarricense etiquetado, permisos de uso de imágenes, validación independiente y
un modelo compatible con ejecución local en el navegador.

Fuentes de consulta para la arquitectura de la clave:

- [USGS, North American Aquatic Macroinvertebrate Digital Reference Collection](https://sciencebase.usgs.gov/naamdrc).
- [Macroinvertebrates.org](https://www.macroinvertebrates.org/about), proyecto
  educativo financiado por NSF y desarrollado con participación de Carnegie
  Mellon University.
- [EPSG:5367, CR05 / CRTM05](https://epsg.io/5367) y
  [EPSG:8908, CR-SIRGAS / CRTM05](https://epsg.io/8908).
- [Sistema Nacional de Información Territorial de Costa Rica](https://www.snitcr.go.cr/)
  para documentación nacional de sistemas de referencia.

## Uso

Abra la página publicada, instale la PWA y ábrala una vez con conexión para
almacenar todos los archivos. Después puede utilizarse sin conexión. Los datos
permanecen en el dispositivo hasta que se respalden o borren.

## Nota técnica de caudal

El cálculo integra segmentos entre verticales. Para resultados oficiales debe
verificarse la metodología institucional, calibración del equipo, selección de
sección, condiciones hidráulicas y control de calidad de campo.
