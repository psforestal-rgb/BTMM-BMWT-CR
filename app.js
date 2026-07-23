const STORAGE_KEY = "btmm-bmwt-cr-v2";
const LEGACY_STORAGE_KEY = "btmm-bmwt-cr-v1";
const MEDIA_DB = "btmm-bmwt-media-v1";
const MEDIA_STORE = "photos";

proj4.defs(
  "EPSG:5367",
  "+proj=tmerc +lat_0=0 +lon_0=-84 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +units=m +no_defs +type=crs"
);
proj4.defs(
  "EPSG:8908",
  "+proj=tmerc +lat_0=0 +lon_0=-84 +k=0.9999 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0.16959,-0.35312,-0.51846,-0.03385,0.16325,-0.03446,0.03693 +units=m +no_defs +type=crs"
);

let state = loadState();
let keyNodeId = "start";
let keyHistory = [];
let keyResult = null;
let keyUnknown = "";
const photoQueues = new Map();
let mediaDbPromise;

function uid(prefix = "rec") {
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyState() {
  return {
    schemaVersion: 2,
    trip: {},
    observations: [],
    macroSamples: [],
    identifications: [],
    flowSections: [],
    activeFlowId: null
  };
}

function loadState() {
  let raw = {};
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {};
    if (!Object.keys(raw).length) {
      raw = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "null") || {};
    }
  } catch {
    raw = {};
  }
  const next = { ...emptyState(), ...raw };
  next.observations = Array.isArray(raw.observations) ? raw.observations.map((record) => ({
    ...record, id: record.id || uid("obs"), photoIds: record.photoIds || []
  })) : [];
  next.macroSamples = Array.isArray(raw.macroSamples) ? raw.macroSamples.map((record) => ({
    ...record, id: record.id || uid("macro"), photoIds: record.photoIds || []
  })) : [];
  next.identifications = Array.isArray(raw.identifications) ? raw.identifications.map((record) => ({
    ...record, id: record.id || uid("id"), photoIds: record.photoIds || []
  })) : [];
  next.flowSections = Array.isArray(raw.flowSections) ? raw.flowSections.map((record) => ({
    ...record, id: record.id || uid("flow"), photoIds: record.photoIds || [],
    verticals: Array.isArray(record.verticals) ? record.verticals : []
  })) : [];
  if (!next.flowSections.length && raw.flowSection && Object.keys(raw.flowSection).length) {
    const migrated = {
      ...raw.flowSection,
      id: uid("flow"),
      photoIds: [],
      verticals: Array.isArray(raw.verticals) ? raw.verticals : []
    };
    next.flowSections.push(migrated);
    next.activeFlowId = migrated.id;
  }
  if (next.activeFlowId && !next.flowSections.some((section) => section.id === next.activeFlowId)) {
    next.activeFlowId = next.flowSections[0]?.id || null;
  }
  return next;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const status = document.getElementById("saveStatus");
  status.textContent = `Guardado ${new Date().toLocaleTimeString("es-CR")}`;
  render();
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function fillForm(form, values = {}) {
  [...form.elements].forEach((field) => {
    if (field.name && values[field.name] !== undefined && field.type !== "file") {
      field.value = values[field.name];
    }
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function normalizeFamily(value) {
  const clean = String(value || "").trim().toLowerCase();
  return BMWP_CR_ALIASES[clean] ||
    Object.keys(BMWP_CR).find((family) => family.toLowerCase() === clean) ||
    value.trim();
}

function familiesFromText(text) {
  return (text || "")
    .split(/[\n,;]/)
    .map(normalizeFamily)
    .filter(Boolean);
}

function bmwpScoreForSample(sample) {
  const families = [...new Set(familiesFromText(sample.familias))];
  const missing = [];
  const score = families.reduce((sum, family) => {
    if (BMWP_CR[family] === undefined) {
      missing.push(family);
      return sum;
    }
    return sum + BMWP_CR[family];
  }, 0);
  return { score, familyCount: families.length, missing };
}

function classifyBmwp(score) {
  if (score > 120) return "Excelente";
  if (score >= 101) return "Muy buena";
  if (score >= 61) return "Aceptable";
  if (score >= 36) return "Dudosa";
  if (score >= 16) return "Crítica";
  return "Muy crítica o sin datos suficientes";
}

function calculateFlow(section) {
  const width = Number(section?.anchoTotal || 0);
  const verticals = (section?.verticals || [])
    .map((vertical, rawIndex) => ({
      ...vertical,
      rawIndex,
      distancia: Number(vertical.distancia),
      profundidad: Number(vertical.profundidad),
      velocidad: Number(vertical.velocidad)
    }))
    .filter((vertical) =>
      Number.isFinite(vertical.distancia) &&
      Number.isFinite(vertical.profundidad) &&
      Number.isFinite(vertical.velocidad)
    )
    .sort((a, b) => a.distancia - b.distancia);
  if (!width || !verticals.length) return { cubic: 0, liters: 0, verticals };
  const points = [
    { distancia: 0, profundidad: 0, velocidad: 0 },
    ...verticals,
    { distancia: width, profundidad: 0, velocidad: 0 }
  ];
  let cubic = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    const segmentWidth = Math.max(0, right.distancia - left.distancia);
    cubic += segmentWidth *
      ((left.profundidad + right.profundidad) / 2) *
      ((left.velocidad + right.velocidad) / 2);
  }
  return { cubic, liters: cubic * 1000, verticals };
}

function coordinateRow(record) {
  const crtm = record.este && record.norte
    ? `CRTM05: E ${Number(record.este).toFixed(2)} · N ${Number(record.norte).toFixed(2)} · ${record.crs || "EPSG:5367"}`
    : "CRTM05: sin coordenadas";
  const wgs = record.lat && record.lon
    ? `WGS84: ${Number(record.lat).toFixed(7)}, ${Number(record.lon).toFixed(7)} · precisión ${record.precision || "s/d"} m`
    : "WGS84: sin lectura";
  return [crtm, wgs];
}

function convertLatLon(form) {
  const lat = Number(form.elements.lat?.value);
  const lon = Number(form.elements.lon?.value);
  const crs = form.elements.crs?.value || "EPSG:5367";
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const [east, north] = proj4("EPSG:4326", crs, [lon, lat]);
  form.elements.este.value = east.toFixed(2);
  form.elements.norte.value = north.toFixed(2);
}

function captureGps(form, button) {
  const status = form.querySelector(".field-status");
  if (!navigator.geolocation) {
    status.textContent = "Este navegador no ofrece geolocalización.";
    return;
  }
  button.disabled = true;
  status.textContent = "Esperando una lectura GPS precisa…";
  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude, accuracy, altitude } = position.coords;
    form.elements.lat.value = latitude.toFixed(7);
    form.elements.lon.value = longitude.toFixed(7);
    form.elements.precision.value = Number(accuracy).toFixed(1);
    form.elements.altitud.value = altitude == null ? "" : Number(altitude).toFixed(1);
    form.elements.gpsFecha.value = new Date(position.timestamp).toISOString();
    convertLatLon(form);
    status.textContent = `Lectura capturada con precisión estimada de ${Number(accuracy).toFixed(1)} m.`;
    button.disabled = false;
  }, (error) => {
    const messages = {
      1: "Permiso de ubicación denegado.",
      2: "No fue posible determinar la posición.",
      3: "La lectura GPS agotó el tiempo de espera."
    };
    status.textContent = messages[error.code] || "No fue posible capturar la ubicación.";
    button.disabled = false;
  }, {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 0
  });
}

function openMediaDb() {
  if (mediaDbPromise) return mediaDbPromise;
  mediaDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore(MEDIA_STORE, { keyPath: "id" });
      store.createIndex("recordId", "recordId", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return mediaDbPromise;
}

async function writePhotos(files, recordType, recordId) {
  if (!files.length) return [];
  const db = await openMediaDb();
  const transaction = db.transaction(MEDIA_STORE, "readwrite");
  const store = transaction.objectStore(MEDIA_STORE);
  const ids = [];
  files.forEach((file) => {
    const id = uid("photo");
    ids.push(id);
    store.put({
      id,
      recordType,
      recordId,
      name: file.name || `${id}.jpg`,
      type: file.type || "application/octet-stream",
      size: file.size,
      lastModified: file.lastModified || null,
      createdAt: new Date().toISOString(),
      blob: file
    });
  });
  await transactionDone(transaction);
  return ids;
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function getPhotos(recordId) {
  const db = await openMediaDb();
  const transaction = db.transaction(MEDIA_STORE, "readonly");
  const request = transaction.objectStore(MEDIA_STORE).index("recordId").getAll(recordId);
  const result = await requestPromise(request);
  await transactionDone(transaction);
  return result;
}

async function getAllPhotos() {
  const db = await openMediaDb();
  const transaction = db.transaction(MEDIA_STORE, "readonly");
  const result = await requestPromise(transaction.objectStore(MEDIA_STORE).getAll());
  await transactionDone(transaction);
  return result;
}

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deletePhoto(photoId) {
  const db = await openMediaDb();
  const transaction = db.transaction(MEDIA_STORE, "readwrite");
  transaction.objectStore(MEDIA_STORE).delete(photoId);
  await transactionDone(transaction);
}

async function deleteRecordPhotos(recordId) {
  const photos = await getPhotos(recordId);
  await Promise.all(photos.map((photo) => deletePhoto(photo.id)));
}

async function clearAllPhotos() {
  const db = await openMediaDb();
  const transaction = db.transaction(MEDIA_STORE, "readwrite");
  transaction.objectStore(MEDIA_STORE).clear();
  await transactionDone(transaction);
}

function collectionForType(recordType) {
  if (recordType === "observation") return state.observations;
  if (recordType === "macro") return state.macroSamples;
  if (recordType === "identification") return state.identifications;
  if (recordType === "flow") return state.flowSections;
  return [];
}

function recordForType(recordType, recordId) {
  return collectionForType(recordType).find((record) => record.id === recordId);
}

async function appendPhotos(recordType, recordId, files) {
  const record = recordForType(recordType, recordId);
  if (!record || !files.length) return;
  try {
    const ids = await writePhotos(files, recordType, recordId);
    record.photoIds = [...(record.photoIds || []), ...ids];
    saveState();
    await updateStorageEstimate();
  } catch (error) {
    alert(`No fue posible guardar las fotografías. Verifique el espacio disponible. ${error.message}`);
  }
}

function getQueueKey(form) {
  return form.dataset.photoQueue;
}

function queueFiles(form, files) {
  const key = getQueueKey(form);
  const current = photoQueues.get(key) || [];
  photoQueues.set(key, [...current, ...files]);
  updateQueueStatus(form);
}

function updateQueueStatus(form) {
  const count = (photoQueues.get(getQueueKey(form)) || []).length;
  const status = form.querySelector(".photo-queue-status");
  if (status) status.textContent = `${count} fotografía${count === 1 ? "" : "s"} preparada${count === 1 ? "" : "s"}`;
}

function resetQueue(form) {
  photoQueues.set(getQueueKey(form), []);
  const input = form.querySelector(".photo-input");
  if (input) input.value = "";
  updateQueueStatus(form);
}

async function addRecordFromForm(form, collection, recordType, prefix, additions = {}) {
  const record = { ...formToObject(form), ...additions, id: uid(prefix), photoIds: [] };
  collection.push(record);
  const files = photoQueues.get(getQueueKey(form)) || [];
  try {
    record.photoIds = await writePhotos(files, recordType, record.id);
  } catch (error) {
    alert(`El punto se guardó, pero no todas las fotografías. ${error.message}`);
  }
  form.reset();
  resetQueue(form);
  saveState();
  await updateStorageEstimate();
  return record;
}

function makeItem(record, title, rows, recordType, onDelete, extraActions = []) {
  const div = document.createElement("article");
  div.className = "item";
  div.innerHTML = `
    <div class="item-head">
      <div>
        <h3>${escapeHtml(title)}</h3>
        ${rows.map((row) => `<p>${escapeHtml(row)}</p>`).join("")}
      </div>
    </div>
    <div class="item-actions"></div>
    <div class="photo-gallery" data-gallery-record="${escapeHtml(record.id)}" data-gallery-type="${escapeHtml(recordType)}"></div>
  `;
  const actions = div.querySelector(".item-actions");
  extraActions.forEach(({ label, action, primary = false }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (primary) button.className = "primary";
    button.addEventListener("click", action);
    actions.appendChild(button);
  });
  const photoButton = document.createElement("button");
  photoButton.type = "button";
  photoButton.textContent = "Añadir fotografías";
  photoButton.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.addEventListener("change", () => appendPhotos(recordType, record.id, [...input.files]));
    input.click();
  });
  actions.appendChild(photoButton);
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Eliminar";
  deleteButton.addEventListener("click", onDelete);
  actions.appendChild(deleteButton);
  return div;
}

async function hydratePhotoGalleries() {
  const galleries = [...document.querySelectorAll("[data-gallery-record]")];
  await Promise.all(galleries.map(async (gallery) => {
    const recordId = gallery.dataset.galleryRecord;
    const recordType = gallery.dataset.galleryType;
    const photos = await getPhotos(recordId);
    if (!document.body.contains(gallery)) return;
    gallery.innerHTML = "";
    photos.forEach((photo) => {
      const tile = document.createElement("div");
      tile.className = "photo-tile";
      const image = document.createElement("img");
      const objectUrl = URL.createObjectURL(photo.blob);
      image.src = objectUrl;
      image.alt = photo.name || "Fotografía de campo";
      image.onload = () => URL.revokeObjectURL(objectUrl);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Quitar";
      button.addEventListener("click", async () => {
        if (!confirm("¿Quitar esta fotografía del almacenamiento local?")) return;
        await deletePhoto(photo.id);
        const record = recordForType(recordType, recordId);
        if (record) record.photoIds = (record.photoIds || []).filter((id) => id !== photo.id);
        saveState();
        await updateStorageEstimate();
      });
      tile.append(image, button);
      gallery.appendChild(tile);
    });
  }));
}

async function removeRecord(collection, index) {
  const [record] = collection.splice(index, 1);
  if (record) await deleteRecordPhotos(record.id);
  if (record?.id === state.activeFlowId) {
    state.activeFlowId = state.flowSections[0]?.id || null;
  }
  saveState();
  await updateStorageEstimate();
}

function keyPathText() {
  return keyHistory.map((step, index) =>
    `${index + 1}. ${step.question} → ${step.answer}`
  ).join(" | ");
}

function syncKeyFields() {
  const form = document.getElementById("idForm");
  if (!form) return;
  form.elements.taxon.value = keyResult?.taxon || "";
  form.elements.rango.value = keyResult?.rank || "";
  form.elements.puntaje.value =
    keyResult?.score === null || keyResult?.score === undefined ? "" : String(keyResult.score);
  form.elements.rutaClave.value = keyPathText();
}

function selectKeyChoice(choice) {
  const node = DICHOTOMOUS_KEY[keyNodeId];
  keyHistory.push({
    nodeId: keyNodeId,
    question: node.question,
    answer: choice.label
  });
  keyResult = null;
  keyUnknown = "";

  if (choice.result) {
    const result = KEY_RESULTS[choice.result];
    keyResult = {
      ...result,
      score: BMWP_CR[result.taxon] ?? null
    };
  } else if (choice.unknown) {
    keyUnknown = choice.unknown;
  } else {
    keyNodeId = choice.next;
  }
  renderDichotomousKey();
}

function resetDichotomousKey() {
  keyNodeId = "start";
  keyHistory = [];
  keyResult = null;
  keyUnknown = "";
  renderDichotomousKey();
}

function backDichotomousKey() {
  const previous = keyHistory.pop();
  if (!previous) return;
  keyNodeId = previous.nodeId;
  keyResult = null;
  keyUnknown = "";
  renderDichotomousKey();
}

function stopDichotomousKey() {
  const node = DICHOTOMOUS_KEY[keyNodeId];
  keyUnknown =
    `No se pudo observar el carácter: “${node.question}”. ` +
    "Conserve el ejemplar y continúe la determinación con lupa o estereoscopio.";
  keyResult = null;
  renderDichotomousKey();
}

function renderDichotomousKey() {
  const container = document.getElementById("dichotomousKey");
  const progress = document.getElementById("keyProgress");
  const saveButton = document.getElementById("saveIdentification");
  if (!container || !progress || !saveButton) return;

  progress.textContent = keyResult
    ? `Determinación alcanzada en ${keyHistory.length} pasos`
    : `Paso ${keyHistory.length + 1}`;
  saveButton.disabled = !keyResult;

  if (keyResult) {
    const scoreText = keyResult.score === null
      ? "No figura con puntaje propio en el Cuadro 5; no sumar al BMWP-CR."
      : `Puntaje BMWP-CR: ${keyResult.score}`;
    container.innerHTML = `
      <article class="key-result" aria-live="polite">
        <span class="key-result-label">Resultado de la clave</span>
        <h3><i>${escapeHtml(keyResult.taxon)}</i></h3>
        <p><strong>${escapeHtml(keyResult.rank)}</strong> · ${escapeHtml(keyResult.higher)}</p>
        <p>${escapeHtml(keyResult.diagnostic)}</p>
        <div class="key-score">${escapeHtml(scoreText)}</div>
        <p class="key-warning">Confirme los caracteres diagnósticos antes de incorporar el taxón al resultado oficial.</p>
      </article>
    `;
    syncKeyFields();
    return;
  }

  if (keyUnknown) {
    container.innerHTML = `
      <div class="key-unknown" aria-live="polite">
        <strong>Determinación no concluyente</strong>
        <p>${escapeHtml(keyUnknown)}</p>
        <p>No se asignó familia ni puntaje.</p>
      </div>
    `;
    syncKeyFields();
    return;
  }

  const node = DICHOTOMOUS_KEY[keyNodeId];
  container.innerHTML = `
    <fieldset class="key-couplet">
      <legend>${escapeHtml(node.question)}</legend>
      ${node.help ? `<p class="key-help">${escapeHtml(node.help)}</p>` : ""}
      <div class="key-choices">
        ${node.choices.map((choice, index) => `
          <button type="button" class="key-choice" data-key-choice="${index}">
            <span class="key-choice-letter">${index === 0 ? "A" : "B"}</span>
            <span>
              <strong>${escapeHtml(choice.label)}</strong>
              <small>${escapeHtml(choice.detail || "")}</small>
            </span>
          </button>
        `).join("")}
      </div>
    </fieldset>
  `;
  container.querySelectorAll("[data-key-choice]").forEach((button) => {
    button.addEventListener("click", () =>
      selectKeyChoice(node.choices[Number(button.dataset.keyChoice)])
    );
  });
  syncKeyFields();
}

function render() {
  fillForm(document.getElementById("tripForm"), state.trip);

  const obsList = document.getElementById("obsList");
  obsList.innerHTML = "";
  state.observations.forEach((record, index) => {
    obsList.appendChild(makeItem(record, record.nombre || `Punto ${index + 1}`, [
      record.tipo || "Observación general",
      ...coordinateRow(record),
      record.notas || ""
    ], "observation", () => removeRecord(state.observations, index)));
  });

  const macroList = document.getElementById("macroList");
  macroList.innerHTML = "";
  state.macroSamples.forEach((record, index) => {
    const result = bmwpScoreForSample(record);
    macroList.appendChild(makeItem(record, record.codigo || `Muestra ${index + 1}`, [
      ...coordinateRow(record),
      `${record.metodo || ""} · ${record.tiempo || "0"} min · ${record.submuestras || "0"} submuestras`,
      `Hábitats: ${record.habitats || "sin dato"}`,
      `Familias: ${record.familias || "sin dato"}`,
      `BMWP-CR preliminar: ${result.score} · ${classifyBmwp(result.score)}` +
        (result.missing.length ? ` · sin puntaje cargado: ${result.missing.join(", ")}` : "")
    ], "macro", () => removeRecord(state.macroSamples, index)));
  });
  const lastSample = state.macroSamples.at(-1);
  const latestScore = lastSample ? bmwpScoreForSample(lastSample) : null;
  document.getElementById("bmwpSummary").textContent = latestScore
    ? `Última muestra: ${lastSample.codigo || "sin código"} · BMWP-CR ${latestScore.score} · ${classifyBmwp(latestScore.score)} · ${latestScore.familyCount} familias`
    : "Aún no hay muestras para calcular BMWP-CR.";

  const idList = document.getElementById("idList");
  idList.innerHTML = "";
  state.identifications.forEach((record, index) => {
    idList.appendChild(makeItem(record, record.codigo || `Organismo ${index + 1}`, [
      `Punto/muestra: ${record.punto || "sin asociar"}`,
      record.taxon
        ? `${record.rango || "Taxón"}: ${record.taxon}` +
          (record.puntaje ? ` · BMWP-CR ${record.puntaje}` : "")
        : `Identificación anterior: ${(record.candidates || []).join(" · ") || "sin determinar"}`,
      record.rutaClave ? `Ruta: ${record.rutaClave}` : "",
      record.notas || ""
    ], "identification", () => removeRecord(state.identifications, index)));
  });

  const sectionList = document.getElementById("sectionList");
  sectionList.innerHTML = "";
  state.flowSections.forEach((section, index) => {
    const flow = calculateFlow(section);
    sectionList.appendChild(makeItem(section, section.codigo || `Sección ${index + 1}`, [
      ...coordinateRow(section),
      `Ancho: ${section.anchoTotal || "s/d"} m · ${section.verticals.length} verticales`,
      `Caudal: ${flow.cubic.toFixed(4)} m³/s · ${flow.liters.toFixed(2)} L/s`
    ], "flow", () => removeRecord(state.flowSections, index), [{
      label: section.id === state.activeFlowId ? "Sección activa" : "Registrar verticales",
      primary: section.id !== state.activeFlowId,
      action: () => {
        state.activeFlowId = section.id;
        saveState();
      }
    }]));
  });

  const activeSection = state.flowSections.find((section) => section.id === state.activeFlowId);
  const activeMessage = document.getElementById("activeSectionMessage");
  const verticalForm = document.getElementById("verticalForm");
  const verticalList = document.getElementById("verticalList");
  verticalList.innerHTML = "";
  [...verticalForm.elements].forEach((field) => { field.disabled = !activeSection; });
  if (!activeSection) {
    activeMessage.textContent = "Agregue o seleccione una sección para registrar verticales.";
    document.getElementById("flowSummary").textContent = "Seleccione una sección.";
  } else {
    activeMessage.textContent = `Sección activa: ${activeSection.codigo || activeSection.punto || "sin código"}`;
    const flow = calculateFlow(activeSection);
    flow.verticals.forEach((vertical, displayIndex) => {
      const simpleRecord = { id: `${activeSection.id}-vertical-${vertical.rawIndex}` };
      const item = makeItem(simpleRecord, `Vertical ${displayIndex + 1}`, [
        `Distancia: ${vertical.distancia} m · Profundidad: ${vertical.profundidad} m · Velocidad: ${vertical.velocidad} m/s`,
        vertical.obs || ""
      ], "none", () => {
        activeSection.verticals.splice(vertical.rawIndex, 1);
        saveState();
      });
      item.querySelector("button:nth-last-child(2)")?.remove();
      item.querySelector(".photo-gallery")?.remove();
      verticalList.appendChild(item);
    });
    const recommended = Number(activeSection.verticalesRecomendadas || 25);
    const warning = activeSection.verticals.length < recommended
      ? ` · advertencia ${activeSection.verticals.length}/${recommended} verticales`
      : "";
    document.getElementById("flowSummary").textContent =
      `Caudal: ${flow.cubic.toFixed(4)} m³/s · ${flow.liters.toFixed(2)} L/s${warning}`;
  }

  document.getElementById("jsonPreview").textContent = JSON.stringify({
    ...state,
    media: "Las fotografías se incluyen en el respaldo ZIP y se omiten de esta vista."
  }, null, 2);
  renderDichotomousKey();
  void hydratePhotoGalleries();
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function buildCsv() {
  const rows = [[
    "tipo", "codigo", "punto", "crs", "este", "norte", "lat_wgs84", "lon_wgs84",
    "precision_m", "altitud_m", "fecha_gps", "detalle"
  ]];
  state.observations.forEach((record) => rows.push([
    "observacion", record.nombre, record.tipo, record.crs, record.este, record.norte,
    record.lat, record.lon, record.precision, record.altitud, record.gpsFecha, record.notas
  ]));
  state.macroSamples.forEach((record) => rows.push([
    "macroinvertebrados", record.codigo, record.punto, record.crs, record.este, record.norte,
    record.lat, record.lon, record.precision, record.altitud, record.gpsFecha, record.familias
  ]));
  state.flowSections.forEach((section) => {
    const flow = calculateFlow(section);
    rows.push([
      "perfil_caudal", section.codigo, section.punto, section.crs, section.este, section.norte,
      section.lat, section.lon, section.precision, section.altitud, section.gpsFecha,
      `ancho=${section.anchoTotal}; verticales=${section.verticals.length}; caudal_m3s=${flow.cubic}`
    ]);
    section.verticals.forEach((vertical, index) => rows.push([
      "vertical_caudal", `V${index + 1}`, section.codigo, "", "", "", "", "", "", "", "",
      `distancia_m=${vertical.distancia}; profundidad_m=${vertical.profundidad}; velocidad_ms=${vertical.velocidad}; nota=${vertical.obs || ""}`
    ]));
  });
  state.identifications.forEach((record) => rows.push([
    "identificacion", record.codigo, record.punto, "", "", "", "", "", "", "", "",
    record.taxon
      ? `taxon=${record.taxon}; rango=${record.rango || ""}; puntaje=${record.puntaje || ""}; ruta=${record.rutaClave || ""}`
      : (record.candidates || []).join("; ")
  ]));
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(filename, text, type) {
  downloadBlob(filename, new Blob([text], { type }));
}

function safeFilename(value) {
  return String(value || "archivo").replace(/[^\p{L}\p{N}._-]+/gu, "_");
}

async function exportZip() {
  const button = document.getElementById("exportZip");
  button.disabled = true;
  button.textContent = "Preparando respaldo…";
  try {
    const zip = new JSZip();
    const timestamp = new Date().toISOString();
    zip.file("datos/BTMM-BMWT-CR.json", JSON.stringify({ ...state, exportedAt: timestamp }, null, 2));
    zip.file("datos/BTMM-BMWT-CR.csv", buildCsv());
    const photos = await getAllPhotos();
    const manifest = [["photo_id", "tipo_registro", "id_registro", "nombre", "tipo_mime", "bytes", "fecha"]];
    photos.forEach((photo, index) => {
      const filename = `${String(index + 1).padStart(4, "0")}_${safeFilename(photo.name)}`;
      zip.file(`fotografias/${safeFilename(photo.recordType)}/${safeFilename(photo.recordId)}/${filename}`, photo.blob);
      manifest.push([
        photo.id, photo.recordType, photo.recordId, photo.name, photo.type, photo.size, photo.createdAt
      ]);
    });
    zip.file("datos/manifiesto_fotografias.csv",
      manifest.map((row) => row.map(csvEscape).join(",")).join("\n"));
    zip.file("LEAME.txt",
      "Respaldo completo BTMM-BMWT-CR.\n" +
      "datos/ contiene JSON, CSV y el manifiesto de fotografías.\n" +
      "fotografias/ organiza los archivos por tipo e identificador del registro.\n" +
      `Fecha de exportación: ${timestamp}\n`);
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    downloadBlob(`BTMM-BMWT-CR-respaldo-${Date.now()}.zip`, blob);
  } catch (error) {
    alert(`No fue posible crear el ZIP. ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Descargar respaldo completo ZIP";
  }
}

async function updateStorageEstimate() {
  const element = document.getElementById("storageEstimate");
  if (!navigator.storage?.estimate) {
    element.textContent = "El navegador no informa la cuota disponible.";
    return;
  }
  const estimate = await navigator.storage.estimate();
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  element.textContent =
    `${formatBytes(estimate.usage)} usados de aproximadamente ${formatBytes(estimate.quota)} · ` +
    `${persisted ? "almacenamiento persistente" : "almacenamiento no persistente"}`;
}

function updateNetworkStatus() {
  document.getElementById("networkStatus").textContent = navigator.onLine
    ? "En línea · datos locales"
    : "Sin conexión · modo offline";
}

function activatePanel(panelId, options = {}) {
  const panel = document.getElementById(panelId);
  const tab = document.querySelector(`.tab[data-panel="${panelId}"]`);
  if (!panel || !tab) return;

  document.querySelectorAll(".tab").forEach((item) => {
    const active = item === tab;
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll(".panel").forEach((item) => {
    item.classList.toggle("active", item === panel);
  });

  history.replaceState(null, "", `#${panelId}`);
  sessionStorage.setItem("btmm-active-panel", panelId);
  if (options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: options.smooth ? "smooth" : "auto" });
  }
  if (options.focusForm) {
    requestAnimationFrame(() => {
      panel.querySelector("input:not([type='hidden']), select, textarea")?.focus({ preventScroll: true });
    });
  }
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => activatePanel(tab.dataset.panel));
});

document.querySelectorAll("[data-go-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    activatePanel(button.dataset.goPanel, { smooth: true, focusForm: true });
  });
});

document.querySelectorAll(".gps-button").forEach((button) => {
  button.addEventListener("click", () => captureGps(button.closest("form"), button));
});

document.querySelectorAll(".point-form").forEach((form) => {
  ["lat", "lon", "crs"].forEach((name) => {
    form.elements[name]?.addEventListener("change", () => convertLatLon(form));
  });
});

document.querySelectorAll(".photo-input").forEach((input) => {
  input.addEventListener("change", () => {
    queueFiles(input.closest("form"), [...input.files]);
    input.value = "";
  });
});

document.getElementById("tripForm").addEventListener("input", (event) => {
  state.trip = formToObject(event.currentTarget);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  document.getElementById("saveStatus").textContent =
    `Guardado ${new Date().toLocaleTimeString("es-CR")}`;
  document.getElementById("jsonPreview").textContent = JSON.stringify(state, null, 2);
});

document.getElementById("obsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await addRecordFromForm(event.currentTarget, state.observations, "observation", "obs");
});

document.getElementById("macroForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await addRecordFromForm(event.currentTarget, state.macroSamples, "macro", "macro");
});

document.getElementById("sectionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const section = await addRecordFromForm(
    event.currentTarget, state.flowSections, "flow", "flow", { verticals: [] }
  );
  state.activeFlowId = section.id;
  saveState();
});

document.getElementById("verticalForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const section = state.flowSections.find((item) => item.id === state.activeFlowId);
  if (!section) return;
  const vertical = formToObject(event.currentTarget);
  if (Number(vertical.distancia) > Number(section.anchoTotal)) {
    alert("La distancia de la vertical no puede superar el ancho mojado de la sección.");
    return;
  }
  section.verticals.push(vertical);
  event.currentTarget.reset();
  saveState();
});

document.getElementById("keyBack").addEventListener("click", backDichotomousKey);
document.getElementById("keyRestart").addEventListener("click", resetDichotomousKey);
document.getElementById("keyUnknown").addEventListener("click", stopDichotomousKey);

document.getElementById("idForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!keyResult) {
    alert("Complete la clave dicotómica hasta obtener una determinación antes de guardar.");
    return;
  }
  const determination = { ...keyResult };
  await addRecordFromForm(
    event.currentTarget,
    state.identifications,
    "identification",
    "id",
    {
      candidates: [determination.taxon],
      taxon: determination.taxon,
      rango: determination.rank,
      puntaje: determination.score ?? "",
      taxonomiaSuperior: determination.higher,
      diagnostico: determination.diagnostic,
      rutaClave: keyPathText(),
      identifiedAt: new Date().toISOString()
    }
  );
  resetDichotomousKey();
});

document.getElementById("exportZip").addEventListener("click", exportZip);
document.getElementById("exportJson").addEventListener("click", () => {
  downloadText(
    `BTMM-BMWT-CR-${Date.now()}.json`,
    JSON.stringify(state, null, 2),
    "application/json"
  );
});
document.getElementById("exportCsv").addEventListener("click", () => {
  downloadText(`BTMM-BMWT-CR-${Date.now()}.csv`, buildCsv(), "text/csv;charset=utf-8");
});
document.getElementById("printReport").addEventListener("click", () => window.print());

document.getElementById("requestPersistence").addEventListener("click", async () => {
  if (!navigator.storage?.persist) {
    alert("Este navegador no permite solicitar almacenamiento persistente.");
    return;
  }
  const granted = await navigator.storage.persist();
  alert(granted
    ? "El navegador concedió almacenamiento persistente."
    : "El navegador no concedió almacenamiento persistente; mantenga respaldos ZIP frecuentes.");
  await updateStorageEstimate();
});

document.getElementById("clearData").addEventListener("click", async () => {
  if (!confirm("Esto borra todos los datos y fotografías guardados en este dispositivo. ¿Continuar?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  await clearAllPhotos();
  state = emptyState();
  photoQueues.clear();
  saveState();
  await updateStorageEstimate();
});

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

function ensureUpdateControls() {
  const headerStatus = document.querySelector(".header-status");
  let status = document.getElementById("updateStatus");
  if (!status && headerStatus) {
    status = document.createElement("div");
    status.id = "updateStatus";
    status.className = "status-pill";
    status.setAttribute("aria-live", "polite");
    status.textContent = "Actualización pendiente";
    headerStatus.appendChild(status);
  }

  const actions = document.querySelector("#exportar .actions");
  let button = document.getElementById("checkForUpdates");
  if (!button && actions) {
    button = document.createElement("button");
    button.type = "button";
    button.id = "checkForUpdates";
    button.textContent = "Actualizar aplicación";
    actions.insertBefore(button, actions.firstChild);
  }
  return { status, button };
}

async function setupServiceWorkerUpdates() {
  if (!("serviceWorker" in navigator)) return;

  const { status, button } = ensureUpdateControls();
  let registration;
  let manualRequest = false;
  let controllerChanging = false;

  const setStatus = (message) => {
    if (status) status.textContent = message;
  };

  const reloadOnce = () => {
    const key = "btmm-cache-refresh-reload";
    const lastReload = Number(sessionStorage.getItem(key) || 0);
    if (!manualRequest && Date.now() - lastReload < 15000) return;
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  };

  const refreshCache = async ({ manual = false } = {}) => {
    manualRequest = manual;
    if (!navigator.onLine) {
      setStatus("Sin conexión · se conserva la versión offline");
      return;
    }
    if (manual && button) button.disabled = true;
    setStatus("Buscando actualización…");
    try {
      await registration.update();
      const worker = registration.waiting || registration.installing;
      if (worker) {
        worker.postMessage({ type: "SKIP_WAITING" });
        return;
      }
      const target = navigator.serviceWorker.controller || registration.active;
      if (!target) {
        setStatus("Preparando uso offline…");
        return;
      }
      target.postMessage({ type: "REFRESH_APP_CACHE" });
    } catch (error) {
      setStatus("No se pudo comprobar · versión offline disponible");
      if (manual && button) button.disabled = false;
      console.warn("No fue posible actualizar la PWA.", error);
    }
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controllerChanging) return;
    controllerChanging = true;
    setStatus("Nueva versión lista · recargando…");
    reloadOnce();
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "APP_CACHE_REFRESHED") {
      const changed = Boolean(event.data.changed);
      setStatus(changed ? "Nueva versión disponible" : "Aplicación al día");
      if (button) button.disabled = false;
      if (changed || manualRequest) reloadOnce();
    }
    if (event.data?.type === "APP_CACHE_REFRESH_FAILED") {
      setStatus("No se pudo comprobar · versión offline disponible");
      if (button) button.disabled = false;
    }
  });

  try {
    registration = await navigator.serviceWorker.register("./sw.js", {
      updateViaCache: "none"
    });
    await navigator.serviceWorker.ready;
    setStatus("Comprobando versión…");

    registration.addEventListener("updatefound", () => {
      setStatus("Descargando nueva versión…");
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setStatus("Instalando nueva versión…");
          worker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });

    button?.addEventListener("click", () => refreshCache({ manual: true }));
    await refreshCache();
  } catch (error) {
    setStatus("Actualización no disponible");
    console.warn("No fue posible registrar el servicio offline.", error);
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => void setupServiceWorkerUpdates());
}

updateNetworkStatus();
render();
void updateStorageEstimate();

const requestedPanel = location.hash.slice(1) || sessionStorage.getItem("btmm-active-panel");
if (requestedPanel) activatePanel(requestedPanel, { scroll: false });
