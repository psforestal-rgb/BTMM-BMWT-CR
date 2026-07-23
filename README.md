# BTMM-BMWT-CR

PWA offline-first para registrar giras de campo, puntos de observacion, muestreos de macroinvertebrados acuaticos, perfil mojado y caudal.

## Funciones

- Datos preliminares de gira: expediente, fecha, participantes, sector, cuerpo de agua y objetivo.
- Puntos de observacion con coordenadas WGS84, precision GPS, fotos y notas.
- Muestreo de macroinvertebrados con metodo, esfuerzo, habitats, sustrato, ribera, preservante y familias.
- Calculo preliminar BMWP-CR por familias cargadas en la tabla local.
- Perfil mojado y caudal por verticales de seccion transversal.
- Recomendacion operativa de 25 verticales para canales naturales, con advertencia cuando la medicion queda por debajo.
- Guardado local en el navegador, funcionamiento offline e instalacion como PWA.
- Exportacion JSON y CSV resumido.

## Uso

Abra `index.html` desde GitHub Pages o desde un servidor local. Los datos quedan en el dispositivo hasta que se exporten o se borren.

## Nota tecnica

El calculo de caudal usa integracion por segmentos entre verticales. Para datos oficiales debe verificarse la metodologia institucional aplicable, el equipo de medicion, la seleccion de seccion, las condiciones hidraulicas y el control de calidad de campo.
