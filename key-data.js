"use strict";

// Puntajes del Apéndice III, Cuadro 5, Decreto Ejecutivo 33903-MINAE-S.
// Se usan nombres taxonómicos actualmente aceptados cuando el decreto contiene
// una grafía histórica; BMWP_CR_ALIASES conserva la compatibilidad de captura.
const BMWP_CR = Object.freeze({
  Polythoridae: 9,
  Blephariceridae: 9,
  Athericidae: 9,
  Heptageniidae: 9,
  Perlidae: 9,
  Lepidostomatidae: 9,
  Odontoceridae: 9,
  Hydrobiosidae: 9,
  Ecnomidae: 9,
  Leptophlebiidae: 8,
  Cordulegastridae: 8,
  Corduliidae: 8,
  Aeshnidae: 8,
  Perilestidae: 8,
  Limnephilidae: 8,
  Calamoceratidae: 8,
  Leptoceridae: 8,
  Glossosomatidae: 8,
  Blaberidae: 8,
  Ptilodactylidae: 7,
  Psephenidae: 7,
  Lutrochidae: 7,
  Gomphidae: 7,
  Lestidae: 7,
  Megapodagrionidae: 7,
  Protoneuridae: 7,
  Platystictidae: 7,
  Philopotamidae: 7,
  Talitridae: 7,
  Gammaridae: 7,
  Libellulidae: 6,
  Corydalidae: 6,
  Hydroptilidae: 6,
  Polycentropodidae: 6,
  Xiphocentronidae: 6,
  Euthyplociidae: 6,
  Isonychidae: 6,
  Pyralidae: 5,
  Hydropsychidae: 5,
  Helicopsychidae: 5,
  Dryopidae: 5,
  Hydraenidae: 5,
  Elmidae: 5,
  Limnichidae: 5,
  Leptohyphidae: 5,
  Oligoneuriidae: 5,
  Polymitarcyidae: 5,
  Baetidae: 5,
  Crustacea: 5,
  Turbellaria: 5,
  Chrysomelidae: 4,
  Curculionidae: 4,
  Haliplidae: 4,
  Lampyridae: 4,
  Staphylinidae: 4,
  Dytiscidae: 4,
  Gyrinidae: 4,
  Scirtidae: 4,
  Noteridae: 4,
  Dixidae: 4,
  Simuliidae: 4,
  Tipulidae: 4,
  Dolichopodidae: 4,
  Empididae: 4,
  Muscidae: 4,
  Sciomyzidae: 4,
  Ceratopogonidae: 4,
  Stratiomyidae: 4,
  Tabanidae: 4,
  Belostomatidae: 4,
  Corixidae: 4,
  Naucoridae: 4,
  Pleidae: 4,
  Nepidae: 4,
  Notonectidae: 4,
  Calopterygidae: 4,
  Coenagrionidae: 4,
  Caenidae: 4,
  Hidracarina: 4,
  Hydrophilidae: 3,
  Psychodidae: 3,
  Valvatidae: 3,
  Hydrobiidae: 3,
  Lymnaeidae: 3,
  Physidae: 3,
  Planorbidae: 3,
  Bithyniidae: 3,
  Bythinellidae: 3,
  Sphaeriidae: 3,
  Glossiphoniidae: 3,
  Hirudidae: 3,
  Erpobdellidae: 3,
  Asellidae: 3,
  Chironomidae: 2,
  Culicidae: 2,
  Ephydridae: 2,
  Syrphidae: 1,
  Oligochaeta: 1
});

const BMWP_CR_ALIASES = Object.freeze({
  "simulidae": "Simuliidae",
  "oligochatea": "Oligochaeta",
  "oligochaeta (todas las clases)": "Oligochaeta",
  "sphaeridae": "Sphaeriidae",
  "glossiphonidae": "Glossiphoniidae",
  "platysticitidae": "Platystictidae",
  "pyralidae/crambidae": "Pyralidae",
  "crambidae": "Pyralidae",
  "hidrácari": "Hidracarina",
  "hidracarina": "Hidracarina",
  "hydrachnidia": "Hidracarina",
  "ácaros acuáticos": "Hidracarina",
  "oligoquetos": "Oligochaeta"
});

const KEY_RESULTS = Object.freeze({
  sphaeriidae: {
    taxon: "Sphaeriidae", rank: "Familia", higher: "Mollusca · Bivalvia",
    diagnostic: "Molusco pequeño con dos valvas articuladas."
  },
  ancylidae: {
    taxon: "Ancylidae", rank: "Familia", higher: "Mollusca · Gastropoda",
    diagnostic: "Concha no espiralada, baja y semejante a un sombrero o lapa."
  },
  planorbidae: {
    taxon: "Planorbidae", rank: "Familia", higher: "Mollusca · Gastropoda",
    diagnostic: "Concha enrollada en un solo plano, con aspecto discoidal."
  },
  physidae: {
    taxon: "Physidae", rank: "Familia", higher: "Mollusca · Gastropoda",
    diagnostic: "Concha espiralada, generalmente sinistral; la abertura queda a la izquierda con el ápice hacia arriba."
  },
  thiaridae: {
    taxon: "Thiaridae", rank: "Familia", higher: "Mollusca · Gastropoda",
    diagnostic: "Concha alta y alargada, dextral, frecuentemente con nódulos o relieves marcados."
  },
  hydrobiidae: {
    taxon: "Hydrobiidae", rank: "Familia", higher: "Mollusca · Gastropoda",
    diagnostic: "Caracol pequeño, de concha dextral relativamente lisa y abertura oval."
  },
  lymnaeidae: {
    taxon: "Lymnaeidae", rank: "Familia", higher: "Mollusca · Gastropoda",
    diagnostic: "Concha dextral, alargada, de espira evidente y abertura grande."
  },
  turbellaria: {
    taxon: "Turbellaria", rank: "Grupo BMWP-CR", higher: "Platyhelminthes · Tricladida",
    diagnostic: "Cuerpo muy blando y aplanado, sin segmentación ni ventosas terminales; desplazamiento deslizante."
  },
  oligochaeta: {
    taxon: "Oligochaeta", rank: "Clase aceptada para BMWP-CR", higher: "Annelida",
    diagnostic: "Cuerpo cilíndrico, anillado y vermiforme, sin patas articuladas ni ventosas terminales."
  },
  glossiphoniidae: {
    taxon: "Glossiphoniidae", rank: "Familia", higher: "Annelida · Hirudinea",
    diagnostic: "Sanguijuela aplanada y relativamente ancha, con ventosa posterior evidente."
  },
  hirudidae: {
    taxon: "Hirudidae", rank: "Familia", higher: "Annelida · Hirudinea",
    diagnostic: "Sanguijuela musculosa, con ventosas anterior y posterior bien desarrolladas."
  },
  erpobdellidae: {
    taxon: "Erpobdellidae", rank: "Familia", higher: "Annelida · Hirudinea",
    diagnostic: "Sanguijuela alargada, depredadora, sin probóscide y con ventosa anterior poco diferenciada."
  },
  blephariceridae: {
    taxon: "Blephariceridae", rank: "Familia", higher: "Diptera",
    diagnostic: "Larva aplanada, con seis discos de succión ventrales y expansiones laterales; típica de corrientes rápidas."
  },
  simuliidae: {
    taxon: "Simuliidae", rank: "Familia", higher: "Diptera",
    diagnostic: "Larva con abanicos cefálicos, cuerpo ensanchado posteriormente y disco adhesivo terminal."
  },
  culicidae: {
    taxon: "Culicidae", rank: "Familia", higher: "Diptera",
    diagnostic: "Larva acuática con cabeza evidente, tórax ensanchado y sedas; suele colgar de la superficie."
  },
  psychodidae: {
    taxon: "Psychodidae", rank: "Familia", higher: "Diptera",
    diagnostic: "Larva con numerosas sedas o espinas distribuidas por los segmentos corporales."
  },
  stratiomyidae: {
    taxon: "Stratiomyidae", rank: "Familia", higher: "Diptera",
    diagnostic: "Larva alargada y endurecida, con extremo posterior redondeado y corona de pelos."
  },
  tipulidae: {
    taxon: "Tipulidae", rank: "Familia", higher: "Diptera",
    diagnostic: "Larva generalmente grande, sin patas, con cápsula cefálica retraída y lóbulos o tentáculos terminales."
  },
  chironomidae: {
    taxon: "Chironomidae", rank: "Familia", higher: "Diptera",
    diagnostic: "Larva delgada con cápsula cefálica y falsas patas anterior y posterior; algunas son rojas."
  },
  syrphidae: {
    taxon: "Syrphidae", rank: "Familia", higher: "Diptera",
    diagnostic: "Larva ápoda con sifón respiratorio posterior largo y telescópico en las formas acuáticas típicas."
  },
  hidracarina: {
    taxon: "Hidracarina", rank: "Grupo BMWP-CR", higher: "Arachnida · Acari",
    diagnostic: "Ácaro acuático pequeño, generalmente redondeado, muy activo y con cuatro pares de patas."
  },
  asellidae: {
    taxon: "Asellidae", rank: "Familia", higher: "Crustacea · Isopoda",
    diagnostic: "Crustáceo aplanado dorsoventralmente, con patas semejantes entre sí y sin caparazón de decápodo."
  },
  amphipoda: {
    taxon: "Amphipoda", rank: "Requiere confirmar familia", higher: "Crustacea",
    diagnostic: "Crustáceo comprimido lateralmente. Para BMWP-CR debe separarse Gammaridae o Talitridae antes de puntuar."
  },
  crustacea: {
    taxon: "Crustacea", rank: "Grupo BMWP-CR", higher: "Arthropoda",
    diagnostic: "Camarón o cangrejo decápodo. El Cuadro 5 del BMWP-CR asigna puntaje al grupo Crustacea."
  },
  blaberidae: {
    taxon: "Blaberidae", rank: "Familia", higher: "Blattodea",
    diagnostic: "Cucaracha acuática de cuerpo ovalado y aplanado, con antenas largas y patas espinosas."
  },
  gerridae: {
    taxon: "Gerridae", rank: "Familia", higher: "Hemiptera",
    diagnostic: "Patinador de superficie con patas medias y posteriores mucho más largas que el cuerpo."
  },
  veliidae: {
    taxon: "Veliidae", rank: "Familia", higher: "Hemiptera",
    diagnostic: "Patinador pequeño y robusto; las patas no exceden ampliamente la longitud del cuerpo."
  },
  hydrometridae: {
    taxon: "Hydrometridae", rank: "Familia", higher: "Hemiptera",
    diagnostic: "Chinche de superficie extremadamente delgada, con cabeza, cuerpo y patas muy alargados."
  },
  naucoridae: {
    taxon: "Naucoridae", rank: "Familia", higher: "Hemiptera",
    diagnostic: "Chinche ovalada y aplanada, pequeña, con patas anteriores raptoras engrosadas."
  },
  belostomatidae: {
    taxon: "Belostomatidae", rank: "Familia", higher: "Hemiptera",
    diagnostic: "Chinche acuática grande y ovalada, con patas anteriores raptoras robustas y posteriores nadadoras."
  },
  nepidae: {
    taxon: "Nepidae", rank: "Familia", higher: "Hemiptera",
    diagnostic: "Chinche con patas anteriores raptoras y sifón respiratorio caudal largo."
  },
  corixidae: {
    taxon: "Corixidae", rank: "Familia", higher: "Hemiptera",
    diagnostic: "Chinche nadadora con patas posteriores en forma de remo y rostro corto, triangular, adaptado al raspado."
  },
  notonectidae: {
    taxon: "Notonectidae", rank: "Familia", higher: "Hemiptera",
    diagnostic: "Chinche nadadora de dorso convexo que suele desplazarse boca arriba, con rostro perforador."
  },
  gyrinidae: {
    taxon: "Gyrinidae", rank: "Familia", higher: "Coleoptera",
    diagnostic: "Escarabajo de superficie con ojos divididos y patas medias/posteriores cortas, aplanadas y natatorias."
  },
  staphylinidae: {
    taxon: "Staphylinidae", rank: "Familia", higher: "Coleoptera",
    diagnostic: "Escarabajo con élitros muy cortos que dejan expuesta gran parte del abdomen."
  },
  dytiscidae: {
    taxon: "Dytiscidae", rank: "Familia", higher: "Coleoptera",
    diagnostic: "Escarabajo nadador de cuerpo hidrodinámico, con patas posteriores largas, aplanadas y con flecos."
  },
  hydrophilidae: {
    taxon: "Hydrophilidae", rank: "Familia", higher: "Coleoptera",
    diagnostic: "Escarabajo acuático con palpos maxilares largos y antenas cortas terminadas en maza."
  },
  elmidae_adult: {
    taxon: "Elmidae", rank: "Familia", higher: "Coleoptera",
    diagnostic: "Escarabajo pequeño de corriente, con patas no transformadas en remos y cuerpo completamente cubierto por élitros."
  },
  psephenidae: {
    taxon: "Psephenidae", rank: "Familia", higher: "Coleoptera",
    diagnostic: "Larva muy aplanada y redondeada, semejante a una moneda, con patas ocultas desde arriba."
  },
  ptilodactylidae: {
    taxon: "Ptilodactylidae", rank: "Familia", higher: "Coleoptera",
    diagnostic: "Larva alargada y endurecida, frecuentemente pardo-rojiza, con espiráculo terminal expuesto."
  },
  elmidae_larva: {
    taxon: "Elmidae", rank: "Familia", higher: "Coleoptera",
    diagnostic: "Larva alargada, endurecida y segmentada, con opérculo branquial terminal."
  },
  corydalidae: {
    taxon: "Corydalidae", rank: "Familia", higher: "Megaloptera",
    diagnostic: "Larva grande con mandíbulas fuertes y pares de filamentos laterales a lo largo del abdomen."
  },
  pyralidae: {
    taxon: "Pyralidae", rank: "Familia", higher: "Lepidoptera",
    diagnostic: "Larva tipo oruga, con falsas patas abdominales y sedas, frecuentemente asociada a refugios de seda."
  },
  helicopsychidae: {
    taxon: "Helicopsychidae", rank: "Familia", higher: "Trichoptera",
    diagnostic: "Estuche de arena o piedritas enrollado en espiral, semejante a una concha de caracol."
  },
  glossosomatidae: {
    taxon: "Glossosomatidae", rank: "Familia", higher: "Trichoptera",
    diagnostic: "Estuche de piedritas en forma de caparazón de tortuga, fuertemente adherido al sustrato."
  },
  hydroptilidae: {
    taxon: "Hydroptilidae", rank: "Familia", higher: "Trichoptera",
    diagnostic: "Larva muy pequeña, usualmente menor de 5 mm, con estuche de seda y arena en forma de bolsita o tubo."
  },
  calamoceratidae: {
    taxon: "Calamoceratidae", rank: "Familia", higher: "Trichoptera",
    diagnostic: "Estuche aplanado de fragmentos de hojas, característicamente semejante a una espátula."
  },
  lepidostomatidae: {
    taxon: "Lepidostomatidae", rank: "Familia", higher: "Trichoptera",
    diagnostic: "Estuche tubular construido con fragmentos vegetales o piedritas finas; patas relativamente cortas."
  },
  leptoceridae: {
    taxon: "Leptoceridae", rank: "Familia", higher: "Trichoptera",
    diagnostic: "Larva esbelta, de antenas y patas posteriores largas; estuche tubular de arena o fibras vegetales."
  },
  odontoceridae: {
    taxon: "Odontoceridae", rank: "Familia", higher: "Trichoptera",
    diagnostic: "Estuche tubular mineral firme, de granos relativamente gruesos; la confirmación requiere revisar cabeza, pronoto y patas."
  },
  hydropsychidae: {
    taxon: "Hydropsychidae", rank: "Familia", higher: "Trichoptera",
    diagnostic: "Larva sin estuche portátil, con abundantes branquias abdominales ventrales y mechón de setas en las uñas anales."
  },
  philopotamidae: {
    taxon: "Philopotamidae", rank: "Familia", higher: "Trichoptera",
    diagnostic: "Larva libre sin branquias abdominales, de cuerpo claro y cabeza anaranjada; labro membranoso en forma de T."
  },
  hydrobiosidae: {
    taxon: "Hydrobiosidae", rank: "Familia", higher: "Trichoptera",
    diagnostic: "Larva libre depredadora, sin branquias abdominales, con patas anteriores más cortas y mandíbulas fuertes."
  },
  polycentropodidae: {
    taxon: "Polycentropodidae", rank: "Familia", higher: "Trichoptera",
    diagnostic: "Larva sin estuche portátil ni branquias abdominales, con patrón de manchas oscuras en la cabeza."
  },
  xiphocentronidae: {
    taxon: "Xiphocentronidae", rank: "Familia", higher: "Trichoptera",
    diagnostic: "Larva alargada sin branquias abdominales, con abundantes setas cefálicas y labio proyectado."
  },
  perlidae: {
    taxon: "Perlidae", rank: "Familia", higher: "Plecoptera",
    diagnostic: "Ninfa con dos cercos, antenas largas y branquias ramificadas en tórax o base de las patas."
  },
  heptageniidae: {
    taxon: "Heptageniidae", rank: "Familia", higher: "Ephemeroptera",
    diagnostic: "Ninfa muy aplanada, con cabeza ancha y ovalada; dos o tres cercos y branquias abdominales."
  },
  leptophlebiidae: {
    taxon: "Leptophlebiidae", rank: "Familia", higher: "Ephemeroptera",
    diagnostic: "Ninfa de tres cercos, cabeza relativamente cuadrada y branquias frecuentemente bifurcadas o plumosas."
  },
  oligoneuriidae: {
    taxon: "Oligoneuriidae", rank: "Familia", higher: "Ephemeroptera",
    diagnostic: "Ninfa con hileras densas de setas filtradoras en las patas anteriores."
  },
  euthyplociidae: {
    taxon: "Euthyplociidae", rank: "Familia", higher: "Ephemeroptera",
    diagnostic: "Ninfa grande, con mandíbulas desarrolladas y branquias abdominales gruesas con flecos."
  },
  caenidae: {
    taxon: "Caenidae", rank: "Familia", higher: "Ephemeroptera",
    diagnostic: "Segundo par de branquias ensanchado como placas que cubren los pares posteriores."
  },
  leptohyphidae: {
    taxon: "Leptohyphidae", rank: "Familia", higher: "Ephemeroptera",
    diagnostic: "Ninfa pequeña, con branquias operculares triangulares y antenas relativamente cortas."
  },
  baetidae: {
    taxon: "Baetidae", rank: "Familia", higher: "Ephemeroptera",
    diagnostic: "Ninfa hidrodinámica, con antenas largas y branquias laminares simples; dos o tres cercos."
  },
  polythoridae: {
    taxon: "Polythoridae", rank: "Familia", higher: "Odonata · Zygoptera",
    diagnostic: "Ninfa alargada con tres branquias caudales globosas o saculares."
  },
  calopterygidae: {
    taxon: "Calopterygidae", rank: "Familia", higher: "Odonata · Zygoptera",
    diagnostic: "Ninfa alargada con antenas largas y tres branquias caudales laminares no globosas."
  },
  coenagrionidae: {
    taxon: "Coenagrionidae", rank: "Familia", higher: "Odonata · Zygoptera",
    diagnostic: "Ninfa esbelta con antenas cortas y tres branquias caudales laminares."
  },
  gomphidae: {
    taxon: "Gomphidae", rank: "Familia", higher: "Odonata · Anisoptera",
    diagnostic: "Ninfa robusta y aplanada, sin branquias externas, con antenas de cuatro segmentos y labio extensible."
  },
  libellulidae: {
    taxon: "Libellulidae", rank: "Familia", higher: "Odonata · Anisoptera",
    diagnostic: "Ninfa corta y globosa, sin branquias externas, con labio inferior en forma de cuchara."
  },
  aeshnidae: {
    taxon: "Aeshnidae", rank: "Familia", higher: "Odonata · Anisoptera",
    diagnostic: "Ninfa alargada y de ojos grandes, sin branquias externas, con labio inferior plano y extensible."
  }
});

// Cada nodo presenta exactamente dos alternativas morfológicas. El botón
// independiente “No puedo observarlo” evita forzar una identificación falsa.
const DICHOTOMOUS_KEY = Object.freeze({
  start: {
    question: "¿El organismo presenta una concha externa evidente?",
    help: "Observe el cuerpo completo. No confunda un estuche construido con arena u hojas con una concha producida por el animal.",
    choices: [
      { label: "Sí, tiene concha", detail: "Una concha espiralada, una lapa o dos valvas.", next: "shell_valves" },
      { label: "No tiene concha", detail: "El cuerpo está expuesto o vive dentro de un estuche construido.", next: "jointed_legs" }
    ]
  },
  shell_valves: {
    question: "¿La concha está formada por dos valvas articuladas?",
    choices: [
      { label: "Sí, son dos valvas", detail: "Se abre como una almeja pequeña.", result: "sphaeriidae" },
      { label: "No, es una sola pieza", detail: "Es una lapa o una concha de caracol.", next: "shell_limpet" }
    ]
  },
  shell_limpet: {
    question: "¿La concha es baja, sin espiral visible y con forma de sombrero?",
    choices: [
      { label: "Sí, parece una lapa", detail: "Concha aplanada adherida al sustrato.", result: "ancylidae" },
      { label: "No, tiene espiral", detail: "Concha enrollada de caracol.", next: "shell_planispiral" }
    ]
  },
  shell_planispiral: {
    question: "¿La espiral está enrollada en un solo plano, como un disco?",
    choices: [
      { label: "Sí, es discoidal", detail: "Las vueltas se observan en el mismo plano.", result: "planorbidae" },
      { label: "No, forma una espira elevada", detail: "Tiene ápice y vueltas superpuestas.", next: "shell_sinistral" }
    ]
  },
  shell_sinistral: {
    question: "Con el ápice hacia arriba y la abertura de frente, ¿la abertura queda a la izquierda?",
    choices: [
      { label: "Sí, queda a la izquierda", detail: "Concha sinistral.", result: "physidae" },
      { label: "No, queda a la derecha", detail: "Concha dextral.", next: "shell_dextral_shape" }
    ]
  },
  shell_dextral_shape: {
    question: "¿La concha es muy alargada y presenta nódulos o relieves oscuros?",
    choices: [
      { label: "Sí, alargada y ornamentada", detail: "Aspecto de torre con relieve.", result: "thiaridae" },
      { label: "No, es lisa o poco ornamentada", detail: "Revise tamaño de abertura y espira.", next: "shell_aperture" }
    ]
  },
  shell_aperture: {
    question: "¿La abertura ocupa gran parte de la altura de la concha?",
    choices: [
      { label: "Sí, abertura grande", detail: "La última vuelta domina la concha.", result: "lymnaeidae" },
      { label: "No, abertura pequeña", detail: "Caracol pequeño de espira definida.", result: "hydrobiidae" }
    ]
  },
  jointed_legs: {
    question: "¿Tiene patas articuladas verdaderas?",
    help: "Las falsas patas carnosas de larvas de mosca no cuentan como patas articuladas.",
    choices: [
      { label: "No tiene patas articuladas", detail: "Cuerpo blando, vermiforme o aplanado.", next: "head_capsule" },
      { label: "Sí tiene patas articuladas", detail: "Se observan segmentos y articulaciones.", next: "leg_count" }
    ]
  },
  head_capsule: {
    question: "¿Se distingue una cápsula cefálica endurecida o una cabeza claramente diferenciada?",
    choices: [
      { label: "Sí, la cabeza es distinguible", detail: "Probable larva de Diptera.", next: "diptera_suckers" },
      { label: "No hay cabeza endurecida", detail: "Lombriz, sanguijuela o planaria.", next: "worm_suckers" }
    ]
  },
  diptera_suckers: {
    question: "¿Tiene una serie de discos redondos de succión en la cara ventral?",
    choices: [
      { label: "Sí, varios discos ventrales", detail: "Cuerpo aplanado adherido a rocas.", result: "blephariceridae" },
      { label: "No tiene esa serie de discos", detail: "Revise cabeza y extremo posterior.", next: "diptera_fans" }
    ]
  },
  diptera_fans: {
    question: "¿Presenta abanicos de pelos en la cabeza y un disco adhesivo en el extremo posterior?",
    choices: [
      { label: "Sí, abanicos y disco", detail: "Cuerpo ensanchado hacia atrás.", result: "simuliidae" },
      { label: "No presenta ambos rasgos", detail: "Revise sedas y extremo abdominal.", next: "diptera_hairy" }
    ]
  },
  diptera_hairy: {
    question: "¿El cuerpo presenta pelos o espinas abundantes y evidentes?",
    choices: [
      { label: "Sí, son abundantes", detail: "Observe cómo se distribuyen y la forma del extremo posterior.", next: "diptera_hair_pattern" },
      { label: "No, es casi liso", detail: "Puede tener pocas sedas localizadas.", next: "diptera_terminal" }
    ]
  },
  diptera_hair_pattern: {
    question: "¿El extremo posterior termina en una corona redondeada de pelos?",
    choices: [
      { label: "Sí, corona posterior", detail: "Cuerpo alargado y algo endurecido.", result: "stratiomyidae" },
      { label: "No, pelos o espinas por segmentos", detail: "Aspecto muy piloso.", next: "diptera_surface" }
    ]
  },
  diptera_surface: {
    question: "¿La larva tiene tórax ancho y suele permanecer suspendida de la superficie?",
    choices: [
      { label: "Sí, tórax ancho", detail: "Con sedas y, frecuentemente, sifón respiratorio.", result: "culicidae" },
      { label: "No, cuerpo uniformemente segmentado", detail: "Sedas o espinas distribuidas en el cuerpo.", result: "psychodidae" }
    ]
  },
  diptera_terminal: {
    question: "¿El extremo posterior tiene lóbulos carnosos semejantes a tentáculos?",
    choices: [
      { label: "Sí, lóbulos terminales", detail: "La cabeza puede estar retraída.", result: "tipulidae" },
      { label: "No tiene lóbulos terminales", detail: "Revise falsas patas o sifón.", next: "diptera_prolegs" }
    ]
  },
  diptera_prolegs: {
    question: "¿Tiene falsas patas con pequeños ganchos cerca de la cabeza y al final del abdomen?",
    choices: [
      { label: "Sí, falsas patas con ganchos", detail: "Cuerpo delgado; puede ser rojo.", result: "chironomidae" },
      { label: "No presenta esas falsas patas", detail: "Revise la presencia de un sifón largo.", next: "diptera_siphon" }
    ]
  },
  diptera_siphon: {
    question: "¿Presenta un sifón respiratorio posterior muy largo y telescópico?",
    choices: [
      { label: "Sí, sifón largo", detail: "Aspecto de cola respiratoria.", result: "syrphidae" },
      { label: "No, falta ese sifón", detail: "Los caracteres observados no bastan para esta clave.", unknown: "Diptera: se requiere una clave especializada para determinar la familia." }
    ]
  },
  worm_suckers: {
    question: "¿Tiene una ventosa evidente en uno o ambos extremos del cuerpo?",
    choices: [
      { label: "Sí, tiene ventosa", detail: "Es una sanguijuela.", next: "leech_shape" },
      { label: "No tiene ventosas", detail: "Revise si el cuerpo es plano o cilíndrico.", next: "worm_flat" }
    ]
  },
  worm_flat: {
    question: "¿El cuerpo es muy aplanado, blando y se desliza sin ondular como una lombriz?",
    choices: [
      { label: "Sí, es plano y deslizante", detail: "Sin segmentación externa marcada.", result: "turbellaria" },
      { label: "No, es cilíndrico y anillado", detail: "Aspecto de lombriz acuática.", result: "oligochaeta" }
    ]
  },
  leech_shape: {
    question: "¿El cuerpo es ancho, muy aplanado y con la ventosa posterior claramente mayor?",
    choices: [
      { label: "Sí, ancho y aplanado", detail: "Frecuentemente se observa cuidado de huevos o crías.", result: "glossiphoniidae" },
      { label: "No, es más alargado y musculoso", detail: "Revise el tamaño de la ventosa anterior.", next: "leech_anterior" }
    ]
  },
  leech_anterior: {
    question: "¿La ventosa anterior está bien desarrollada y claramente delimitada?",
    choices: [
      { label: "Sí, es evidente", detail: "Cuerpo musculoso.", result: "hirudidae" },
      { label: "No, es poco diferenciada", detail: "Cuerpo alargado de depredador.", result: "erpobdellidae" }
    ]
  },
  leg_count: {
    question: "¿Cuántas patas articuladas se observan?",
    choices: [
      { label: "Tres pares: 6 patas", detail: "Insecto adulto, ninfa o larva.", next: "insect_stage" },
      { label: "Cuatro pares o más: 8+", detail: "Ácaro o crustáceo.", next: "many_legs" }
    ]
  },
  many_legs: {
    question: "¿Tiene exactamente cuatro pares de patas y cuerpo pequeño, redondeado y sin antenas?",
    choices: [
      { label: "Sí, 8 patas y sin antenas", detail: "Ácaro acuático.", result: "hidracarina" },
      { label: "No, tiene más patas y antenas", detail: "Crustáceo.", next: "crustacean_shape" }
    ]
  },
  crustacean_shape: {
    question: "¿El cuerpo está claramente aplanado de arriba hacia abajo, como una cochinilla?",
    choices: [
      { label: "Sí, aplanado dorsoventralmente", detail: "Isópodo acuático.", result: "asellidae" },
      { label: "No tiene esa forma", detail: "Revise si está comprimido de lado o tiene pinzas.", next: "crustacean_lateral" }
    ]
  },
  crustacean_lateral: {
    question: "¿El cuerpo está comprimido de lado y suele curvarse en forma de C?",
    choices: [
      { label: "Sí, comprimido lateralmente", detail: "Anfípodo.", result: "amphipoda" },
      { label: "No, parece camarón o cangrejo", detail: "Decápodo.", result: "crustacea" }
    ]
  },
  insect_stage: {
    question: "¿Tiene alas funcionales o el primer par de alas endurecido como élitros?",
    choices: [
      { label: "Sí, adulto con alas o élitros", detail: "Chinche, escarabajo o cucaracha acuática.", next: "adult_mouth" },
      { label: "No tiene alas funcionales", detail: "Larva o ninfa acuática.", next: "larva_lateral_filaments" }
    ]
  },
  adult_mouth: {
    question: "¿Tiene un pico perforador articulado bajo la cabeza?",
    choices: [
      { label: "Sí, tiene pico", detail: "Chinche acuática o semiaquática.", next: "hemiptera_surface" },
      { label: "No tiene pico perforador", detail: "Revise élitros y forma corporal.", next: "adult_elytra" }
    ]
  },
  adult_elytra: {
    question: "¿El primer par de alas forma dos cubiertas duras que se unen en una línea dorsal?",
    choices: [
      { label: "Sí, tiene élitros", detail: "Escarabajo acuático.", next: "beetle_split_eyes" },
      { label: "No, alas blandas sobrepuestas", detail: "Cuerpo ovalado y aplanado.", result: "blaberidae" }
    ]
  },
  hemiptera_surface: {
    question: "¿Se desplaza principalmente sobre la película superficial del agua?",
    choices: [
      { label: "Sí, camina o patina en superficie", detail: "Patas largas y cuerpo fuera del agua.", next: "surface_bug_slender" },
      { label: "No, nada o camina sumergido", detail: "Cuerpo adaptado a nadar o sujetarse.", next: "hemiptera_raptorial" }
    ]
  },
  surface_bug_slender: {
    question: "¿La cabeza y el cuerpo son extremadamente delgados y alargados?",
    choices: [
      { label: "Sí, parecen una aguja", detail: "Cabeza muy prolongada.", result: "hydrometridae" },
      { label: "No, cuerpo más compacto", detail: "Compare longitud de las patas con el cuerpo.", next: "surface_bug_legs" }
    ]
  },
  surface_bug_legs: {
    question: "¿Las patas medias y posteriores son mucho más largas que todo el cuerpo?",
    choices: [
      { label: "Sí, mucho más largas", detail: "Patinador de patas largas.", result: "gerridae" },
      { label: "No, similares a la longitud corporal", detail: "Patinador pequeño y robusto.", result: "veliidae" }
    ]
  },
  hemiptera_raptorial: {
    question: "¿Las patas anteriores son raptoras, engrosadas o curvadas para capturar presas?",
    choices: [
      { label: "Sí, son raptoras", detail: "Revise tamaño corporal y sifón caudal.", next: "hemiptera_siphon" },
      { label: "No son raptoras", detail: "Patas posteriores pueden funcionar como remos.", next: "hemiptera_mouth" }
    ]
  },
  hemiptera_siphon: {
    question: "¿Tiene un tubo respiratorio largo en el extremo del abdomen?",
    choices: [
      { label: "Sí, tiene tubo caudal", detail: "Sifón formado por dos piezas.", result: "nepidae" },
      { label: "No tiene tubo caudal", detail: "Compare tamaño y robustez.", next: "hemiptera_size" }
    ]
  },
  hemiptera_size: {
    question: "¿Es grande y tiene patas anteriores muy robustas?",
    choices: [
      { label: "Sí, grande y robusto", detail: "Chinche acuática gigante.", result: "belostomatidae" },
      { label: "No, pequeño y aplanado", detail: "Patas anteriores engrosadas pero menores.", result: "naucoridae" }
    ]
  },
  hemiptera_mouth: {
    question: "¿El rostro es corto y triangular, semejante a una pala de raspado?",
    choices: [
      { label: "Sí, rostro corto y ancho", detail: "Patas posteriores con flecos.", result: "corixidae" },
      { label: "No, rostro delgado y perforador", detail: "Suele nadar con el vientre hacia arriba.", result: "notonectidae" }
    ]
  },
  beetle_split_eyes: {
    question: "¿Cada ojo está dividido en una mitad superior y otra inferior?",
    choices: [
      { label: "Sí, ojos divididos", detail: "Nada en círculos sobre la superficie.", result: "gyrinidae" },
      { label: "No, ojos normales", detail: "Revise longitud de élitros y patas.", next: "beetle_short_elytra" }
    ]
  },
  beetle_short_elytra: {
    question: "¿Los élitros son muy cortos y dejan expuesta la mayor parte del abdomen?",
    choices: [
      { label: "Sí, abdomen expuesto", detail: "Cuerpo flexible y alargado.", result: "staphylinidae" },
      { label: "No, cubren el abdomen", detail: "Revise las patas posteriores.", next: "beetle_swimming" }
    ]
  },
  beetle_swimming: {
    question: "¿Las patas posteriores son largas, aplanadas y con flecos para nadar?",
    choices: [
      { label: "Sí, son remos largos", detail: "Cuerpo hidrodinámico.", result: "dytiscidae" },
      { label: "No tienen esa forma", detail: "Revise antenas y palpos.", next: "beetle_palps" }
    ]
  },
  beetle_palps: {
    question: "¿Los palpos junto a la boca parecen antenas largas y las antenas verdaderas son cortas con maza?",
    choices: [
      { label: "Sí, palpos largos y antenas cortas", detail: "Escarabajo hidrofílido.", result: "hydrophilidae" },
      { label: "No, antenas filiformes visibles", detail: "Escarabajo pequeño asociado a corrientes.", result: "elmidae_adult" }
    ]
  },
  larva_lateral_filaments: {
    question: "¿Tiene pares de filamentos largos a ambos lados de casi todo el abdomen?",
    choices: [
      { label: "Sí, muchos filamentos laterales", detail: "Mandíbulas fuertes y falsas patas anales.", result: "corydalidae" },
      { label: "No presenta esa hilera", detail: "Revise estuche, cercos y branquias.", next: "larva_case_hooks" }
    ]
  },
  larva_case_hooks: {
    question: "¿Tiene dos falsas patas terminales con ganchos o vive en un estuche portátil?",
    choices: [
      { label: "Sí, ganchos o estuche", detail: "Larva de Trichoptera.", next: "trichoptera_case" },
      { label: "No presenta esos rasgos", detail: "Revise cercos, labio y endurecimiento.", next: "nymph_tails" }
    ]
  },
  trichoptera_case: {
    question: "¿El organismo lleva un estuche portátil construido con arena, piedras u hojas?",
    choices: [
      { label: "Sí, lleva estuche", detail: "Observe forma y material sin retirar al animal.", next: "case_spiral" },
      { label: "No lleva estuche portátil", detail: "Larva libre o constructora de red/refugio fijo.", next: "free_caddis_gills" }
    ]
  },
  case_spiral: {
    question: "¿El estuche está enrollado como una concha de caracol?",
    choices: [
      { label: "Sí, es espiral", detail: "Construido con arena o piedritas.", result: "helicopsychidae" },
      { label: "No es espiral", detail: "Revise si es aplanado o tubular.", next: "case_turtle" }
    ]
  },
  case_turtle: {
    question: "¿El estuche parece un caparazón de tortuga y está fuertemente pegado a la roca?",
    choices: [
      { label: "Sí, aplanado y adherido", detail: "Piedritas formando una cúpula.", result: "glossosomatidae" },
      { label: "No, es portátil y tubular o en bolsa", detail: "Revise tamaño y material.", next: "case_micro" }
    ]
  },
  case_micro: {
    question: "¿La larva mide menos de 5 mm y el estuche es una bolsita de seda con arena fina?",
    choices: [
      { label: "Sí, muy pequeña y en bolsita", detail: "Estuche tipo empanada o tubo fino.", result: "hydroptilidae" },
      { label: "No, es mayor o el estuche es distinto", detail: "Revise material vegetal o mineral.", next: "case_leaf" }
    ]
  },
  case_leaf: {
    question: "¿El estuche está construido principalmente con fragmentos de hojas?",
    choices: [
      { label: "Sí, usa hojas", detail: "Observe si es aplanado como espátula o tubular.", next: "case_leaf_shape" },
      { label: "No, usa arena, piedras o fibras", detail: "Revise patas y antenas.", next: "case_long_legs" }
    ]
  },
  case_leaf_shape: {
    question: "¿El estuche es aplanado y ancho, semejante a una espátula?",
    choices: [
      { label: "Sí, forma de espátula", detail: "Dos fragmentos foliares amplios.", result: "calamoceratidae" },
      { label: "No, es tubular", detail: "Fragmentos vegetales formando un tubo.", result: "lepidostomatidae" }
    ]
  },
  case_long_legs: {
    question: "¿La larva tiene antenas visibles y patas posteriores muy largas proyectadas hacia delante?",
    choices: [
      { label: "Sí, patas y antenas largas", detail: "Estuche de arena fina o fibras.", result: "leptoceridae" },
      { label: "No, patas más robustas y cortas", detail: "Estuche mineral firme.", result: "odontoceridae" }
    ]
  },
  free_caddis_gills: {
    question: "¿Tiene abundantes branquias en la parte ventral del abdomen?",
    choices: [
      { label: "Sí, muchas branquias", detail: "También puede tener setas y mechón anal.", result: "hydropsychidae" },
      { label: "No tiene branquias abdominales visibles", detail: "Observe cabeza, mandíbulas y patas anteriores.", next: "free_caddis_head" }
    ]
  },
  free_caddis_head: {
    question: "¿La cabeza presenta manchas oscuras o aspecto de “pecas”?",
    choices: [
      { label: "Sí, cabeza con manchas", detail: "Cuerpo sin branquias abdominales.", result: "polycentropodidae" },
      { label: "No tiene ese patrón", detail: "Revise color, labro y longitud de patas.", next: "free_caddis_orange" }
    ]
  },
  free_caddis_orange: {
    question: "¿La cabeza es anaranjada y el labro es membranoso, ancho y en forma de T?",
    choices: [
      { label: "Sí, cabeza anaranjada y labro en T", detail: "Puede verse un collar oscuro.", result: "philopotamidae" },
      { label: "No presenta ambos rasgos", detail: "Revise mandíbulas y setas cefálicas.", next: "free_caddis_mandibles" }
    ]
  },
  free_caddis_mandibles: {
    question: "¿Tiene mandíbulas fuertes de depredador y patas anteriores más cortas que las demás?",
    choices: [
      { label: "Sí, depredadora y patas anteriores cortas", detail: "Cabeza bien endurecida.", result: "hydrobiosidae" },
      { label: "No; cabeza muy pequeña y con muchas setas", detail: "Labio proyectado hacia delante.", result: "xiphocentronidae" }
    ]
  },
  nymph_tails: {
    question: "¿Tiene dos o tres cercos o “colas” largas en el extremo del abdomen?",
    choices: [
      { label: "Sí, tiene 2 o 3 cercos", detail: "Ninfa de efímera o plecóptero.", next: "nymph_abdominal_gills" },
      { label: "No tiene cercos largos", detail: "Revise labio extensible o cuerpo larval endurecido.", next: "nymph_mask" }
    ]
  },
  nymph_abdominal_gills: {
    question: "¿Tiene branquias visibles a los lados o sobre el abdomen?",
    choices: [
      { label: "Sí, branquias abdominales", detail: "Ninfa de Ephemeroptera.", next: "mayfly_flat_head" },
      { label: "No; tiene dos cercos y branquias torácicas", detail: "Ninfa de Plecoptera.", result: "perlidae" }
    ]
  },
  mayfly_flat_head: {
    question: "¿El cuerpo y la cabeza son muy aplanados, con cabeza ancha y ovalada?",
    choices: [
      { label: "Sí, muy aplanados", detail: "Adaptada a adherirse a piedras en corriente.", result: "heptageniidae" },
      { label: "No, cuerpo menos aplanado", detail: "Observe forma de branquias, patas y antenas.", next: "mayfly_foreleg_setae" }
    ]
  },
  mayfly_foreleg_setae: {
    question: "¿Las patas anteriores presentan hileras densas de pelos largos para filtrar?",
    choices: [
      { label: "Sí, patas anteriores muy pilosas", detail: "Setas largas y conspicuas.", result: "oligoneuriidae" },
      { label: "No tienen esas hileras", detail: "Revise tamaño y branquias.", next: "mayfly_large_gills" }
    ]
  },
  mayfly_large_gills: {
    question: "¿Es una ninfa grande, con mandíbulas desarrolladas y branquias gruesas con flecos?",
    choices: [
      { label: "Sí, grande y con branquias gruesas", detail: "Muy activa; piezas bucales notorias.", result: "euthyplociidae" },
      { label: "No presenta esa combinación", detail: "Revise si las branquias forman placas.", next: "mayfly_operculate" }
    ]
  },
  mayfly_operculate: {
    question: "¿Un par de branquias forma placas que cubren las branquias posteriores?",
    choices: [
      { label: "Sí, placas dorsales amplias", detail: "Segundo par opercular.", result: "caenidae" },
      { label: "No cubren completamente las posteriores", detail: "Revise cabeza, antenas y forma de branquias.", next: "mayfly_square_head" }
    ]
  },
  mayfly_square_head: {
    question: "¿La cabeza es relativamente cuadrada y las branquias son bifurcadas o plumosas?",
    choices: [
      { label: "Sí, cabeza cuadrada", detail: "Tres cercos usualmente largos.", result: "leptophlebiidae" },
      { label: "No, cabeza redondeada", detail: "Compare antenas y branquias operculares.", next: "mayfly_short_antennae" }
    ]
  },
  mayfly_short_antennae: {
    question: "¿Las antenas son cortas y hay branquias triangulares parcialmente operculares?",
    choices: [
      { label: "Sí, antenas cortas", detail: "Ninfa pequeña y compacta.", result: "leptohyphidae" },
      { label: "No, antenas largas y branquias simples", detail: "Cuerpo hidrodinámico.", result: "baetidae" }
    ]
  },
  nymph_mask: {
    question: "¿Tiene un labio inferior extensible en forma de máscara que cubre las piezas bucales?",
    choices: [
      { label: "Sí, labio tipo máscara", detail: "Ninfa de Odonata.", next: "odonata_external_gills" },
      { label: "No tiene labio extensible", detail: "Revise endurecimiento y falsas patas.", next: "beetle_larva_coin" }
    ]
  },
  odonata_external_gills: {
    question: "¿Tiene tres branquias externas en el extremo del abdomen?",
    choices: [
      { label: "Sí, tres branquias caudales", detail: "Zygoptera, cuerpo generalmente alargado.", next: "damselfly_gills" },
      { label: "No tiene branquias externas", detail: "Anisoptera, cuerpo robusto.", next: "dragonfly_flat" }
    ]
  },
  damselfly_gills: {
    question: "¿Las branquias caudales son globosas o en forma de saco?",
    choices: [
      { label: "Sí, son globosas", detail: "No parecen tres hojas planas.", result: "polythoridae" },
      { label: "No, son laminares y alargadas", detail: "Observe longitud de las antenas.", next: "damselfly_antennae" }
    ]
  },
  damselfly_antennae: {
    question: "¿Las antenas son claramente largas en relación con la cabeza?",
    choices: [
      { label: "Sí, antenas largas", detail: "Cuerpo alargado.", result: "calopterygidae" },
      { label: "No, antenas cortas", detail: "Cuerpo esbelto con branquias laminares.", result: "coenagrionidae" }
    ]
  },
  dragonfly_flat: {
    question: "¿El cuerpo es ancho y aplanado y las antenas tienen solo cuatro segmentos?",
    choices: [
      { label: "Sí, aplanado y antenas cortas", detail: "Frecuentemente se entierra en sedimento.", result: "gomphidae" },
      { label: "No, cuerpo no aplanado", detail: "Compare forma globosa o alargada.", next: "dragonfly_globose" }
    ]
  },
  dragonfly_globose: {
    question: "¿El cuerpo es corto y globoso y el labio inferior tiene forma de cuchara?",
    choices: [
      { label: "Sí, corto y globoso", detail: "Labio con lóbulos laterales amplios.", result: "libellulidae" },
      { label: "No, cuerpo alargado y ojos grandes", detail: "Labio relativamente plano.", result: "aeshnidae" }
    ]
  },
  beetle_larva_coin: {
    question: "¿El cuerpo es muy aplanado y redondeado, como una moneda, con patas ocultas desde arriba?",
    choices: [
      { label: "Sí, parece una moneda", detail: "Placas dorsales cubren patas y abdomen.", result: "psephenidae" },
      { label: "No, cuerpo alargado", detail: "Revise espiráculo u opérculo terminal.", next: "beetle_larva_terminal" }
    ]
  },
  beetle_larva_terminal: {
    question: "¿Tiene un espiráculo terminal expuesto y coloración pardo-rojiza?",
    choices: [
      { label: "Sí, espiráculo expuesto", detail: "Larva alargada y endurecida.", result: "ptilodactylidae" },
      { label: "No; tiene opérculo terminal", detail: "Larva segmentada, frecuentemente amarillenta.", next: "larva_caterpillar" }
    ]
  },
  larva_caterpillar: {
    question: "¿Tiene falsas patas carnosas en el abdomen, como una oruga?",
    choices: [
      { label: "Sí, falsas patas abdominales", detail: "Puede vivir entre seda y vegetación.", result: "pyralidae" },
      { label: "No, cuerpo endurecido y sin falsas patas", detail: "Opérculo branquial terminal.", result: "elmidae_larva" }
    ]
  }
});
