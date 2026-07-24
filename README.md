# BTMM-BMWT-CR

PWA offline-first para registrar giras de campo, puntos de observación, muestreos
de macroinvertebrados acuáticos, identificación asistida, perfil mojado y caudal.

La interfaz es **mobile-first**: está diseñada primero para captura con smartphone
en campo, con navegación inferior fija, controles táctiles amplios, formularios
de una columna y accesos rápidos a los tipos principales de registro. En pantallas
grandes se adapta a una distribución de dos columnas.

## Funciones

- Flujo secuencial de campo: datos preliminares, bloqueo contra edición accidental y continuación al mapa operativo.
- Mapa mobile-first con Esri World Imagery, ubicación GPS actual, círculo de precisión, zoom y puntos guardados de macroinvertebrados, caudal y referencias.
- Descarga de la extensión aérea visible en un ZIP con PNG, PGW, PRJ, GeoJSON y metadatos; la imagen queda georreferenciada en EPSG:3857 y conserva la atribución de Esri World Imagery.
- Botón flotante (+) con cuatro alternativas: Caudal, Macroinvertebrados,
  Observaciones y Cierre de gira.
- Los formularios se abren como hojas de trabajo sobre el mapa; la clave dicotómica forma parte del módulo Macroinvertebrados.
- Las teselas de imagen ya visitadas se conservan en caché cuando el navegador y el espacio disponible lo permiten; la cobertura aérea completa requiere conexión.
- El botón **Continuar** bloquea automáticamente los datos preliminares si aún no se pulsó **Bloquear edición**, de modo que el flujo no queda detenido en un botón deshabilitado.
- Inicio de gira con expediente, fecha y hora automáticas, participantes estructurados, área silvestre protegida, cuerpo de agua, condición meteorológica inicial y observaciones.
- Cierre separado con hora final, condiciones meteorológicas imperantes y observaciones finales.
- Consecutivo único compartido por toda la gira. El orden de guardado genera
  códigos como `001-PM`, `002-MI`, `003-OB`, sin reservar números al cancelar
  formularios ni reutilizarlos después de eliminar un registro.
- Formulario de Observaciones (`OB`) para Ecosistema, Formación hidrogeológica,
  Especie indicadora, Impacto ambiental u Otro, con detalle, hora, coordenadas
  y fotografías.
- Hora de inicio automática en todos los registros PM, MI y OB.
- Coordenadas comunes en todos los puntos de observación, macroinvertebrados y
  perfil mojado/caudal:
  - Digitación manual de X, Y y Z en CRTM05 con incertidumbre declarada.
  - Colecta de múltiples lecturas del dispositivo, promedio ponderado y
    bloqueo cuando X/Y alcanzan una incertidumbre de hasta ±10 m.
  - Conservación de WGS84, CRTM05, altitud, incertidumbres X/Y/Z y fecha/hora.
- Selector entre `CR05 / CRTM05 (EPSG:5367)` y
  `CR-SIRGAS / CRTM05 (EPSG:8908)`.
- Fotografías desde archivos del dispositivo o directamente desde la cámara,
  sin límite fijado por la aplicación y almacenadas como archivos binarios
  offline en IndexedDB. El límite real es el espacio que el navegador conceda.
- Cada fotografía se guarda con fecha/hora y una copia de las coordenadas del
  registro; la imagen lleva una marca de agua discreta en la esquina inferior
  derecha con fecha, hora, X, Y, Z y sistema de referencia. El manifiesto del
  respaldo conserva también esos metadatos.
- Muestreo de macroinvertebrados con método, esfuerzo, hábitats, sustrato,
  ribera, preservante, familias y cálculo preliminar BMWP-CR por muestra.
- Clave dicotómica offline y progresiva: presenta solamente dos alternativas
  por paso y despliega automáticamente el siguiente par de caracteres hasta
  alcanzar familia o el grupo taxonómico admitido por BMWP-CR.
- Resultado con rango, taxonomía superior, puntaje reglamentario, ruta completa
  seguida en la clave y salida no concluyente sin puntaje cuando un carácter no
  puede observarse.
- Múltiples secciones de perfil mojado, cada una con sus propias verticales,
  fotografías y cálculo de caudal.
- Editor gráfico del perfil mojado: al ingresar el ancho mojado se dibuja la
  horizontal de 0 al ancho (etiquetada en ambos extremos); la cantidad de
  verticales recomendadas se marca sobre esa línea con la distancia acumulada
  a la que debe medirse cada una. Cada vertical agregada se dibuja como una
  profundidad hacia abajo (-y) a partir de la horizontal, con su distancia
  acumulada editable en la lista inferior — al modificarla se redibuja el
  perfil de inmediato. Debajo del dibujo se definen el método de velocidad y
  su factor, y el caudal se recalcula automáticamente con cada cambio.
- Bloqueo por sección de perfil mojado: botón **Guardar y bloquear edición**
  que deshabilita el ancho, las verticales, el método y el factor; un botón
  **Editar** para reabrirla a propósito y un botón **Cerrar y volver al
  mapa**, para evitar modificaciones accidentales.
- Observaciones y muestras de macroinvertebrados quedan bloqueadas al
  guardarse; cada registro de la lista tiene su propio botón **Editar** para
  volver a abrirlo (sin crear un duplicado) y un botón **Cerrar y volver al
  mapa** junto al de guardado.
- Respaldo ZIP con JSON, CSV, fotografías y manifiesto de asociación.
- Migración automática de los datos básicos guardados por la versión 1.

## Fotografías

Las fotografías no se incluyen dentro de `localStorage`; se guardan en
IndexedDB para evitar el límite reducido de almacenamiento de texto. La pestaña
**Respaldar** muestra el uso estimado y permite solicitar almacenamiento
persistente. Se recomienda descargar un ZIP al finalizar cada gira.

## Coordenadas

El dispositivo entrega coordenadas geográficas WGS84. Durante la colecta, la
aplicación promedia hasta 60 lecturas ponderadas por la precisión informada por
el navegador, calcula su dispersión, conserva la lectura original y ejecuta
localmente la proyección Transversa de Mercator de CRTM05. El bloqueo automático
requiere al menos tres lecturas y una incertidumbre horizontal estimada de hasta
±10 m. La incertidumbre vertical se guarda cuando el dispositivo la proporciona;
la aplicación no afirma una precisión Z que el teléfono no haya reportado.
Para trabajos geodésicos o catastrales se debe aplicar la transformación oficial
y el control correspondiente; una lectura de teléfono no sustituye un
levantamiento topográfico.

SNIT documenta que `EPSG:5367` corresponde a CR05/CRTM05 y que
`EPSG:8908` corresponde a CR-SIRGAS/CRTM05, sistema que reemplaza al anterior
desde 2018.

## Identificación

La clave offline usa pares de caracteres externos observables en campo o con
lupa. El artículo 15 del Decreto Ejecutivo 33903-MINAE-S exige identificar los
organismos bentónicos hasta el máximo nivel posible y acepta como mínimo la
familia, excepto para Annelida. Los puntajes corresponden al Apéndice III,
Cuadro 5, del mismo decreto.

La clave cubre los grupos de uso más frecuente incluidos en las guías
costarricenses consultadas. Cuando un carácter no puede observarse o la
combinación queda fuera de su alcance, la aplicación termina como “no
concluyente” y no asigna puntaje. La identificación debe confirmarse con material
preservado, equipo óptico, literatura taxonómica especializada y, cuando
corresponda, una persona especialista.

Fuentes de consulta para la arquitectura de la clave:

- [Decreto Ejecutivo 33903-MINAE-S, Reglamento para la Evaluación y Clasificación de la Calidad de Cuerpos de Agua Superficiales](https://www.da.go.cr/wp-content/uploads/2016/06/Decreto-Evaluacion-y-Clasificacion-Calidad-Agua-Superficial-DE-33903-MINAE-S.pdf).
- *Clave ilustrada para la identificación de macroinvertebrados de agua dulce*,
  PNUD Costa Rica, Proyecto Transición hacia una Economía Verde Urbana.
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
