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


const DEFAULT_PARTICIPANT = Object.freeze({
  nombre: "Pablo Sánchez",
  representada: "BTMM-PNLQ"
});

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function localTimeValue(date = new Date()) {
  return String(date.getHours()).padStart(2, "0") + ":" +
    String(date.getMinutes()).padStart(2, "0");
}

function defaultParticipant() {
  return {
    id: uid("participant"),
    nombre: DEFAULT_PARTICIPANT.nombre,
    representada: DEFAULT_PARTICIPANT.representada,
    editableName: false,
    editableRepresentada: false
  };
}

function defaultTrip() {
  return {
    fecha: localDateValue(),
    horaInicio: localTimeValue(),
    meteoInicial: "",
    participantes: [defaultParticipant()],
    locked: false
  };
}

function normalizeParticipants(value, useDefault = false) {
  if (Array.isArray(value)) {
    return value.map((participant) => ({
      id: participant.id || uid("participant"),
      nombre: String(participant.nombre || participant.name || ""),
      representada: String(participant.representada || participant.institucion || ""),
      editableName: Boolean(participant.editableName || participant.custom || !participant.nombre),
      editableRepresentada: Boolean(participant.editableRepresentada || participant.custom)
    }));
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(/[\n;]/).map((line) => {
      const parts = line.split("/");
      return {
        id: uid("participant"),
        nombre: String(parts.shift() || "").trim(),
        representada: parts.join("/").trim(),
        editableName: true,
        editableRepresentada: true
      };
    }).filter((participant) => participant.nombre || participant.representada);
  }
  return useDefault ? [defaultParticipant()] : [];
}

function persistDraft() {
  state.schemaVersion = 4;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  document.getElementById("saveStatus").textContent =
    "Guardado " + new Date().toLocaleTimeString("es-CR");
  document.getElementById("jsonPreview").textContent = JSON.stringify({
    ...state,
    media: "Las fotografías se incluyen en el respaldo ZIP y se omiten de esta vista."
  }, null, 2);
}

let state = loadState();
let keyNodeId = "start";
let keyHistory = [];
let keyResult = null;
let keyUnknown = "";
const photoQueues = new Map();
let mediaDbPromise;
let fieldMap = null;
let mapRecordLayer = null;
let currentLocationMarker = null;
let currentAccuracyCircle = null;
let currentLatLng = null;
let locationWatchId = null;
let mapCenteredOnFirstFix = false;
let imageryLayer = null;

function uid(prefix = "rec") {
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyState() {
  return {
    schemaVersion: 4,
    trip: defaultTrip(),
    closure: {},
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
  const rawTrip = raw.trip && typeof raw.trip === "object" ? raw.trip : {};
  const hasParticipants = Object.prototype.hasOwnProperty.call(rawTrip, "participantes");
  next.trip = {
    ...defaultTrip(),
    ...rawTrip,
    meteoInicial: rawTrip.meteoInicial || rawTrip.meteo || "",
    participantes: normalizeParticipants(rawTrip.participantes, !hasParticipants)
  };
  next.closure = raw.closure && typeof raw.closure === "object" ? { ...raw.closure } : {};
  if (!next.closure.horaFinal && rawTrip.horaCierre) {
    next.closure.horaFinal = rawTrip.horaCierre;
  }
  next.schemaVersion = 4;
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

function participantInput(labelText, value, className, placeholder, readOnly) {
  const label = document.createElement("label");
  label.className = "participant-cell";
  const caption = document.createElement("span");
  caption.className = "participant-mobile-label";
  caption.textContent = labelText;
  const input = document.createElement("input");
  input.className = className;
  input.value = value || "";
  input.placeholder = placeholder;
  input.readOnly = readOnly;
  label.append(caption, input);
  return { label, input };
}

function renderParticipantRows(focusId = "") {
  const container = document.getElementById("participantRows");
  if (!container) return;
  container.innerHTML = "";
  (state.trip.participantes || []).forEach((participant) => {
    const row = document.createElement("div");
    row.className = "participant-row";
    row.dataset.participantId = participant.id;
    row.setAttribute("role", "row");

    const nameField = participantInput(
      "Nombre completo",
      participant.nombre,
      "participant-name",
      "Escriba el nombre completo",
      !participant.editableName
    );
    const representedField = participantInput(
      "Representada",
      participant.representada,
      "participant-represented",
      "Escriba la institución o dependencia representada",
      !participant.editableRepresentada
    );
    nameField.label.setAttribute("role", "cell");
    representedField.label.setAttribute("role", "cell");

    nameField.input.addEventListener("input", () => {
      participant.nombre = nameField.input.value;
      persistDraft();
    });
    representedField.input.addEventListener("input", () => {
      participant.representada = representedField.input.value;
      persistDraft();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "participant-remove";
    remove.setAttribute("aria-label", "Eliminar participante " + (participant.nombre || "sin nombre"));
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      state.trip.participantes = state.trip.participantes.filter((item) => item.id !== participant.id);
      renderParticipantRows();
      persistDraft();
    });

    row.append(nameField.label, representedField.label, remove);
    container.appendChild(row);
  });

  if (!(state.trip.participantes || []).length) {
    const empty = document.createElement("p");
    empty.className = "participant-empty";
    empty.textContent = "No hay participantes agregados.";
    container.appendChild(empty);
  }

  if (focusId) {
    container.querySelector('[data-participant-id="' + focusId + '"] .participant-name')?.focus();
  }
}

function addParticipantFromOption(option) {
  if (!option || (!option.value && !option.dataset.name && !option.dataset.representada)) return;
  const custom = option.value === "__other__";
  const participant = {
    id: uid("participant"),
    nombre: custom ? "" : (option.dataset.name || ""),
    representada: custom ? "" : (option.dataset.representada || ""),
    editableName: custom || !option.dataset.name,
    editableRepresentada: custom
  };
  state.trip.participantes = [...(state.trip.participantes || []), participant];
  renderParticipantRows(participant.editableName ? participant.id : "");
  persistDraft();
}

function render() {
  fillForm(document.getElementById("tripForm"), state.trip);
  fillForm(document.getElementById("closureForm"), state.closure);
  renderParticipantRows();

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
  updateTripLockUI();
  renderMapRecords();
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
  rows.push([
    "gira_inicio", state.trip.expediente || "", state.trip.cuerpoAgua || "", "", "", "", "", "", "", "", "",
    "fecha=" + (state.trip.fecha || "") + "; hora_inicio=" + (state.trip.horaInicio || "") +
      "; area_silvestre=" + (state.trip.areaSilvestre || "") +
      "; meteorologia_inicial=" + (state.trip.meteoInicial || "") +
      "; observaciones=" + (state.trip.observaciones || "")
  ]);
  (state.trip.participantes || []).forEach((participant) => rows.push([
    "participante", participant.nombre || "", participant.representada || "", "", "", "", "", "", "", "", "", ""
  ]));
  rows.push([
    "gira_cierre", "", "", "", "", "", "", "", "", "", "",
    "hora_final=" + (state.closure.horaFinal || "") +
      "; meteorologia_final=" + (state.closure.meteoFinal || "") +
      "; observaciones_finales=" + (state.closure.observacionesFinales || "")
  ]);
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


function updateTripLockUI() {
  const form = document.getElementById("tripForm");
  if (!form) return;
  const locked = Boolean(state.trip.locked);
  [...form.elements].forEach((field) => {
    field.disabled = locked;
  });
  document.getElementById("showParticipantPicker").disabled = locked;
  document.querySelectorAll(".participant-remove").forEach((button) => {
    button.disabled = locked;
  });
  const lockButton = document.getElementById("lockTripButton");
  const continueButton = document.getElementById("continueToMap");
  const status = document.getElementById("tripLockStatus");
  if (lockButton) lockButton.textContent = locked ? "Desbloquear edición" : "Bloquear edición";
  if (continueButton) {
    continueButton.disabled = false;
    continueButton.textContent = locked ? "Continuar al mapa" : "Continuar y bloquear";
  }
  if (status) {
    status.textContent = locked
      ? "Edición bloqueada. Puede continuar al mapa."
      : "Puede bloquear los datos para revisarlos; al continuar se bloquearán automáticamente.";
    status.classList.toggle("locked", locked);
  }
}

function setTripLocked(locked) {
  state.trip.locked = Boolean(locked);
  persistDraft();
  render();
}

function prepareFieldWorkflow() {
  const macroPanel = document.getElementById("macro");
  const keyPanel = document.getElementById("identificar");
  if (macroPanel && keyPanel && keyPanel.parentElement !== macroPanel) {
    keyPanel.classList.remove("panel");
    keyPanel.classList.add("macro-key-subsection");
    macroPanel.appendChild(keyPanel);
    const keyJump = document.createElement("button");
    keyJump.type = "button";
    keyJump.className = "secondary key-jump";
    keyJump.textContent = "Abrir clave dicotómica";
    keyJump.addEventListener("click", () => {
      keyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      keyPanel.querySelector("input:not([type='hidden'])")?.focus({ preventScroll: true });
    });
    macroPanel.querySelector(".section-head")?.appendChild(keyJump);
  }

  const exportPanel = document.getElementById("exportar");
  const closureCard = exportPanel?.querySelector(".closure-card");
  if (exportPanel && closureCard && !document.getElementById("cierre")) {
    const closurePanel = document.createElement("section");
    closurePanel.id = "cierre";
    closurePanel.className = "panel record-sheet";
    closurePanel.setAttribute("aria-label", "Cierre de gira");
    closurePanel.appendChild(closureCard);
    exportPanel.parentNode.insertBefore(closurePanel, exportPanel);
    const closureForm = document.getElementById("closureForm");
    if (closureForm && !document.getElementById("saveClosure")) {
      const saveButton = document.createElement("button");
      saveButton.type = "submit";
      saveButton.id = "saveClosure";
      saveButton.className = "primary wide";
      saveButton.textContent = "Guardar cierre de gira";
      closureForm.appendChild(saveButton);
      closureForm.addEventListener("submit", (event) => {
        event.preventDefault();
        state.closure = { ...state.closure, ...formToObject(event.currentTarget) };
        persistDraft();
        closeRecordSheet();
      });
    }
  }

  ["macro", "caudal", "cierre", "exportar"].forEach((panelId) => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.add("record-sheet");
    if (!panel.querySelector(":scope > .sheet-header")) {
      const header = document.createElement("div");
      header.className = "sheet-header";
      const title = panel.querySelector("h2, h3")?.textContent || "Registro";
      header.innerHTML = '<strong>' + escapeHtml(title) + '</strong>';
      const close = document.createElement("button");
      close.type = "button";
      close.className = "sheet-close";
      close.setAttribute("aria-label", "Cerrar y volver al mapa");
      close.textContent = "×";
      close.addEventListener("click", closeRecordSheet);
      header.appendChild(close);
      panel.prepend(header);
    }
  });
  updateTripLockUI();
}

function openRecordMenu() {
  const menu = document.getElementById("recordMenu");
  if (!menu) return;
  menu.hidden = false;
  document.body.classList.add("menu-open");
  menu.querySelector("[data-open-record]")?.focus();
}

function closeRecordMenu() {
  const menu = document.getElementById("recordMenu");
  if (!menu) return;
  menu.hidden = true;
  document.body.classList.remove("menu-open");
  document.getElementById("mapAddRecord")?.focus({ preventScroll: true });
}

function openRecordSheet(panelId) {
  closeRecordMenu();
  activatePanel(panelId, { scroll: false });
  document.body.classList.add("sheet-open");
  requestAnimationFrame(() => {
    document.getElementById(panelId)?.querySelector("input:not([type='hidden']), select, textarea")?.focus({ preventScroll: true });
  });
}

function closeRecordSheet() {
  document.body.classList.remove("sheet-open");
  activatePanel("mapa", { scroll: false });
}

function recordLatLng(record) {
  const lat = Number(record.lat);
  const lon = Number(record.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
  const east = Number(record.este);
  const north = Number(record.norte);
  if (!Number.isFinite(east) || !Number.isFinite(north)) return null;
  try {
    const converted = proj4(record.crs || "EPSG:5367", "EPSG:4326", [east, north]);
    return [converted[1], converted[0]];
  } catch {
    return null;
  }
}

function mapIcon(kind) {
  const labels = { macro: "M", flow: "C", reference: "R" };
  return L.divIcon({
    className: "field-map-div-icon",
    html: '<span class="map-pin map-pin--' + kind + '"><b>' + labels[kind] + "</b></span>",
    iconSize: [34, 42],
    iconAnchor: [17, 39],
    popupAnchor: [0, -36]
  });
}

function renderMapRecords() {
  if (!fieldMap || !mapRecordLayer || !window.L) return;
  mapRecordLayer.clearLayers();
  const groups = [
    { kind: "macro", records: state.macroSamples, title: (r, i) => r.codigo || r.punto || "Muestra " + (i + 1) },
    { kind: "flow", records: state.flowSections, title: (r, i) => r.codigo || r.punto || "Caudal " + (i + 1) },
    { kind: "reference", records: state.observations, title: (r, i) => r.nombre || "Referencia " + (i + 1) }
  ];
  let count = 0;
  groups.forEach((group) => {
    group.records.forEach((record, index) => {
      const latLng = recordLatLng(record);
      if (!latLng) return;
      count += 1;
      const marker = L.marker(latLng, { icon: mapIcon(group.kind), keyboard: true });
      const crtm = coordinateRow(record)[0] || "CRTM05: sin dato";
      marker.bindPopup(
        "<strong>" + escapeHtml(group.title(record, index)) + "</strong><br>" +
        escapeHtml(crtm) + "<br>" +
        escapeHtml(group.kind === "flow" ? "Registro de caudal" : group.kind === "macro" ? "Muestreo de macroinvertebrados" : (record.tipo || "Referencia"))
      );
      marker.addTo(mapRecordLayer);
    });
  });
  const countLabel = document.getElementById("mapPointCount");
  if (countLabel) countLabel.textContent = count + (count === 1 ? " punto" : " puntos");
}

function updateCurrentLocation(position, center = false) {
  if (!fieldMap || !window.L) return;
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const accuracy = Number(position.coords.accuracy || 0);
  currentLatLng = [lat, lon];
  if (!currentLocationMarker) {
    currentLocationMarker = L.circleMarker(currentLatLng, {
      radius: 9,
      color: "#ffffff",
      weight: 3,
      fillColor: "#1976d2",
      fillOpacity: 1
    }).addTo(fieldMap).bindPopup("Ubicación actual");
    currentAccuracyCircle = L.circle(currentLatLng, {
      radius: accuracy,
      color: "#1976d2",
      weight: 1,
      fillColor: "#1976d2",
      fillOpacity: 0.12
    }).addTo(fieldMap);
  } else {
    currentLocationMarker.setLatLng(currentLatLng);
    currentAccuracyCircle.setLatLng(currentLatLng).setRadius(accuracy);
  }
  let crtmText = "";
  try {
    const crtm = proj4("EPSG:4326", "EPSG:5367", [lon, lat]);
    crtmText = " · E " + crtm[0].toFixed(1) + " / N " + crtm[1].toFixed(1);
  } catch {
    crtmText = "";
  }
  const status = document.getElementById("mapGpsStatus");
  if (status) status.textContent = "GPS ±" + accuracy.toFixed(1) + " m" + crtmText;
  if (center || !mapCenteredOnFirstFix) {
    fieldMap.setView(currentLatLng, Math.max(fieldMap.getZoom(), 17));
    mapCenteredOnFirstFix = true;
  }
}

function handleMapLocationError(error) {
  const messages = {
    1: "Permiso de ubicación denegado",
    2: "Ubicación no disponible",
    3: "Tiempo de GPS agotado"
  };
  const status = document.getElementById("mapGpsStatus");
  if (status) status.textContent = messages[error?.code] || "No fue posible obtener la ubicación";
}

function startLocationWatch() {
  if (locationWatchId !== null || !navigator.geolocation) return;
  locationWatchId = navigator.geolocation.watchPosition(
    (position) => updateCurrentLocation(position),
    handleMapLocationError,
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 }
  );
}

function locateOnMap() {
  if (currentLatLng && fieldMap) {
    fieldMap.setView(currentLatLng, Math.max(fieldMap.getZoom(), 18));
    currentLocationMarker?.openPopup();
    return;
  }
  if (!navigator.geolocation) {
    handleMapLocationError();
    return;
  }
  const status = document.getElementById("mapGpsStatus");
  if (status) status.textContent = "Buscando ubicación precisa…";
  navigator.geolocation.getCurrentPosition(
    (position) => updateCurrentLocation(position, true),
    handleMapLocationError,
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
  );
}

function initFieldMap() {
  if (fieldMap || !window.L) {
    if (!window.L) {
      const status = document.getElementById("mapGpsStatus");
      if (status) status.textContent = "No se pudo cargar el motor cartográfico";
    }
    return;
  }
  fieldMap = L.map("fieldMap", {
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true
  }).setView([9.65, -83.85], 10);
  imageryLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 20,
      crossOrigin: true,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics and contributors"
    }
  );
  imageryLayer.on("tileerror", () => {
    const status = document.getElementById("mapGpsStatus");
    if (status && !navigator.onLine) status.textContent = "Sin conexión · se muestran las imágenes ya visitadas";
  });
  imageryLayer.addTo(fieldMap);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(fieldMap);
  mapRecordLayer = L.layerGroup().addTo(fieldMap);
  renderMapRecords();
  startLocationWatch();
}

const WEB_MERCATOR_RADIUS = 6378137;
const WEB_MERCATOR_MAX_LAT = 85.05112878;
const IMAGERY_TILE_SIZE = 256;
const IMAGERY_MAX_ZOOM = 20;
const IMAGERY_TARGET_LONG_EDGE = 2048;
const IMAGERY_MAX_LONG_EDGE = 4096;
const IMAGERY_MAX_TILES = 96;

function clampMercatorLatitude(latitude) {
  return Math.max(-WEB_MERCATOR_MAX_LAT, Math.min(WEB_MERCATOR_MAX_LAT, Number(latitude)));
}

function slippyPixel(latitude, longitude, zoom) {
  const lat = clampMercatorLatitude(latitude) * Math.PI / 180;
  const worldSize = IMAGERY_TILE_SIZE * (2 ** zoom);
  return {
    x: ((Number(longitude) + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + Math.sin(lat)) / (1 - Math.sin(lat))) / (4 * Math.PI)) * worldSize
  };
}

function webMercator(latitude, longitude) {
  const lat = clampMercatorLatitude(latitude) * Math.PI / 180;
  return {
    x: WEB_MERCATOR_RADIUS * Number(longitude) * Math.PI / 180,
    y: WEB_MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat / 2))
  };
}

function inverseWebMercator(x, y) {
  return {
    longitude: Number(x) / WEB_MERCATOR_RADIUS * 180 / Math.PI,
    latitude: (2 * Math.atan(Math.exp(Number(y) / WEB_MERCATOR_RADIUS)) - Math.PI / 2) * 180 / Math.PI
  };
}

function imageryExportPlan(bounds, mapZoom, mapSize) {
  const north = clampMercatorLatitude(bounds.getNorth());
  const south = clampMercatorLatitude(bounds.getSouth());
  const west = Number(bounds.getWest());
  const east = Number(bounds.getEast());
  if (![north, south, west, east].every(Number.isFinite) || north <= south || east <= west) {
    throw new Error("La extensión visible del mapa no es válida.");
  }

  const longEdge = Math.max(Number(mapSize.x) || 0, Number(mapSize.y) || 0, 1);
  const preferredScale = Math.max(1, IMAGERY_TARGET_LONG_EDGE / longEdge);
  let zoom = Math.min(
    IMAGERY_MAX_ZOOM,
    Math.max(0, Math.round(Number(mapZoom) + Math.log2(preferredScale)))
  );
  let northWest;
  let southEast;
  let width;
  let height;
  let minTileX;
  let maxTileX;
  let minTileY;
  let maxTileY;
  let tileCount;

  do {
    northWest = slippyPixel(north, west, zoom);
    southEast = slippyPixel(south, east, zoom);
    width = Math.max(1, Math.ceil(southEast.x - northWest.x));
    height = Math.max(1, Math.ceil(southEast.y - northWest.y));
    minTileX = Math.floor(northWest.x / IMAGERY_TILE_SIZE);
    maxTileX = Math.floor((southEast.x - Number.EPSILON) / IMAGERY_TILE_SIZE);
    minTileY = Math.floor(northWest.y / IMAGERY_TILE_SIZE);
    maxTileY = Math.floor((southEast.y - Number.EPSILON) / IMAGERY_TILE_SIZE);
    tileCount = (maxTileX - minTileX + 1) * (maxTileY - minTileY + 1);
    if (
      zoom > 0 &&
      (Math.max(width, height) > IMAGERY_MAX_LONG_EDGE || tileCount > IMAGERY_MAX_TILES)
    ) {
      zoom -= 1;
      continue;
    }
    break;
  } while (zoom >= 0);

  const resolution = 2 * Math.PI * WEB_MERCATOR_RADIUS / (IMAGERY_TILE_SIZE * (2 ** zoom));
  const projectedNorthWest = webMercator(north, west);
  const projectedSouthEast = {
    x: projectedNorthWest.x + resolution * width,
    y: projectedNorthWest.y - resolution * height
  };
  const imageSouthEast = inverseWebMercator(projectedSouthEast.x, projectedSouthEast.y);

  return {
    north,
    south,
    west,
    east,
    zoom,
    northWest,
    southEast,
    width,
    height,
    minTileX,
    maxTileX,
    minTileY,
    maxTileY,
    tileCount,
    resolution,
    projectedNorthWest,
    projectedSouthEast,
    imageEast: imageSouthEast.longitude,
    imageSouth: imageSouthEast.latitude
  };
}

async function imageBitmapFromResponse(response) {
  const blob = await response.blob();
  if ("createImageBitmap" in window) return createImageBitmap(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("El navegador no pudo interpretar una tesela aérea."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, type = "image/png") {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("El navegador no pudo crear la imagen PNG."));
    }, type);
  });
}

function imageryWorldFile(plan) {
  const pixelX = plan.resolution;
  const pixelY = -plan.resolution;
  return [
    pixelX.toFixed(12),
    "0.000000000000",
    "0.000000000000",
    pixelY.toFixed(12),
    (plan.projectedNorthWest.x + pixelX / 2).toFixed(6),
    (plan.projectedNorthWest.y + pixelY / 2).toFixed(6)
  ].join("\n") + "\n";
}

function imageryExtentGeoJson(plan) {
  return {
    type: "FeatureCollection",
    name: "extension_imagen_aerea",
    crs: {
      type: "name",
      properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" }
    },
    features: [{
      type: "Feature",
      properties: {
        fuente: "Esri World Imagery",
        zoom: plan.zoom,
        ancho_px: plan.width,
        alto_px: plan.height
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [plan.west, plan.north],
          [plan.imageEast, plan.north],
          [plan.imageEast, plan.imageSouth],
          [plan.west, plan.imageSouth],
          [plan.west, plan.north]
        ]]
      }
    }]
  };
}

async function downloadCurrentImagery() {
  const button = document.getElementById("mapDownloadImagery");
  if (!fieldMap || !imageryLayer) {
    alert("Abra primero el mapa y espere a que cargue la imagen aérea.");
    return;
  }
  if (!navigator.onLine) {
    alert("La descarga de una imagen aérea completa requiere conexión. Las teselas ya visitadas continuarán disponibles en el mapa offline.");
    return;
  }

  const originalText = button?.textContent || "⇩ Imagen aérea";
  if (button) {
    button.disabled = true;
    button.textContent = "Preparando…";
  }

  try {
    const plan = imageryExportPlan(fieldMap.getBounds(), fieldMap.getZoom(), fieldMap.getSize());
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("El navegador no permite componer la imagen.");
    context.fillStyle = "#dce5df";
    context.fillRect(0, 0, plan.width, plan.height);

    const tileJobs = [];
    for (let tileY = plan.minTileY; tileY <= plan.maxTileY; tileY += 1) {
      for (let tileX = plan.minTileX; tileX <= plan.maxTileX; tileX += 1) {
        tileJobs.push({ tileX, tileY });
      }
    }

    let completed = 0;
    const failures = [];
    const workers = Array.from({ length: Math.min(6, tileJobs.length) }, async () => {
      while (tileJobs.length) {
        const tile = tileJobs.shift();
        const url =
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/" +
          `${plan.zoom}/${tile.tileY}/${tile.tileX}`;
        try {
          const response = await fetch(url, { mode: "cors", cache: "force-cache" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const image = await imageBitmapFromResponse(response);
          const drawX = tile.tileX * IMAGERY_TILE_SIZE - plan.northWest.x;
          const drawY = tile.tileY * IMAGERY_TILE_SIZE - plan.northWest.y;
          context.drawImage(image, drawX, drawY, IMAGERY_TILE_SIZE, IMAGERY_TILE_SIZE);
          image.close?.();
        } catch (error) {
          failures.push(`${plan.zoom}/${tile.tileY}/${tile.tileX}: ${error.message}`);
        } finally {
          completed += 1;
          if (button) button.textContent = `Imagen ${completed}/${plan.tileCount}`;
        }
      }
    });
    await Promise.all(workers);
    if (failures.length) {
      throw new Error(`No se descargaron ${failures.length} de ${plan.tileCount} teselas. Revise la conexión e inténtelo nuevamente.`);
    }

    const attribution = "Esri World Imagery · Esri, Maxar, Earthstar Geographics y colaboradores";
    const fontSize = Math.max(11, Math.min(18, Math.round(plan.width / 110)));
    context.font = `600 ${fontSize}px system-ui, sans-serif`;
    context.textAlign = "right";
    context.textBaseline = "bottom";
    const textWidth = Math.min(plan.width - 16, context.measureText(attribution).width + 16);
    context.fillStyle = "rgba(255,255,255,.84)";
    context.fillRect(plan.width - textWidth - 6, plan.height - fontSize - 14, textWidth, fontSize + 10);
    context.fillStyle = "#17312f";
    context.fillText(attribution, plan.width - 12, plan.height - 8, plan.width - 24);

    const imageBlob = await canvasToBlob(canvas);
    const zip = new JSZip();
    const base = `BTMM_imagen_aerea_vista_z${plan.zoom}`;
    const timestamp = new Date().toISOString();
    const metadata = {
      createdAt: timestamp,
      source: "Esri World Imagery",
      sourceUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
      note: "La fecha, resolución y proveedores de la imagen varían según la ubicación.",
      imageCrs: "EPSG:3857",
      extentWgs84: {
        west: plan.west,
        south: plan.imageSouth,
        east: plan.imageEast,
        north: plan.north
      },
      zoom: plan.zoom,
      widthPixels: plan.width,
      heightPixels: plan.height,
      tileCount: plan.tileCount
    };
    const prj =
      'PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",' +
      'SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],' +
      'UNIT["degree",0.0174532925199433]],PROJECTION["Mercator_1SP"],' +
      'PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],' +
      'PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1]]';

    zip.file(`${base}.png`, imageBlob);
    zip.file(`${base}.pgw`, imageryWorldFile(plan));
    zip.file(`${base}.prj`, prj);
    zip.file(`${base}_extension.geojson`, JSON.stringify(imageryExtentGeoJson(plan), null, 2));
    zip.file(`${base}_metadatos.json`, JSON.stringify(metadata, null, 2));
    zip.file(
      "LEAME.txt",
      "Imagen aérea correspondiente a la extensión visible del mapa al momento de la descarga.\n" +
      "El PNG está georreferenciado en EPSG:3857 mediante los archivos PGW y PRJ.\n" +
      "La extensión se incluye también como GeoJSON en WGS84.\n" +
      "Fuente: Esri World Imagery; la fecha, resolución y proveedores varían según la ubicación.\n" +
      "Para recortar exactamente a un polígono se requiere una capa con al menos una entidad geométrica.\n" +
      `Fecha de creación: ${timestamp}\n`
    );
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
    const compactTimestamp = timestamp.replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
    downloadBlob(`BTMM-imagen-aerea-${compactTimestamp}.zip`, zipBlob);
  } catch (error) {
    alert(`No fue posible descargar la imagen aérea. ${error.message}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function updateNetworkStatus() {
  document.getElementById("networkStatus").textContent = navigator.onLine
    ? "En línea · datos locales"
    : "Sin conexión · modo offline";
}

function activatePanel(panelId, options = {}) {
  const panel = document.getElementById(panelId);
  const tab = document.querySelector(`.tab[data-panel="${panelId}"]`);
  if (!panel) return;
  const sheetIds = ["macro", "caudal", "cierre", "exportar"];
  const isRecordSheet = sheetIds.includes(panelId);

  document.querySelectorAll(".tab").forEach((item) => {
    const active = item === tab;
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll(".panel").forEach((item) => {
    item.classList.toggle("active", item === panel || (isRecordSheet && item.id === "mapa"));
  });

  document.body.classList.toggle("map-mode", panelId === "mapa" || isRecordSheet);
  document.body.classList.toggle("sheet-open", isRecordSheet);
  history.replaceState(null, "", `#${panelId}`);
  sessionStorage.setItem("btmm-active-panel", panelId);
  if (panelId === "mapa") {
    initFieldMap();
    requestAnimationFrame(() => {
      fieldMap?.invalidateSize();
      renderMapRecords();
    });
  }
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

document.getElementById("lockTripButton")?.addEventListener("click", () => {
  setTripLocked(!state.trip.locked);
});
document.getElementById("continueToMap")?.addEventListener("click", () => {
  if (!state.trip.locked) {
    setTripLocked(true);
  }
  activatePanel("mapa");
});
document.getElementById("mapBackToTrip")?.addEventListener("click", () => activatePanel("gira"));
document.getElementById("mapLocate")?.addEventListener("click", locateOnMap);
document.getElementById("mapDownloadImagery")?.addEventListener("click", downloadCurrentImagery);
document.getElementById("mapBackup")?.addEventListener("click", () => openRecordSheet("exportar"));
document.getElementById("mapAddRecord")?.addEventListener("click", openRecordMenu);
document.getElementById("closeRecordMenu")?.addEventListener("click", closeRecordMenu);
document.getElementById("recordMenu")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeRecordMenu();
});
document.querySelectorAll("[data-open-record]").forEach((button) => {
  button.addEventListener("click", () => openRecordSheet(button.dataset.openRecord));
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
  if (state.trip.locked) return;
  state.trip = {
    ...state.trip,
    ...formToObject(event.currentTarget),
    participantes: state.trip.participantes || []
  };
  persistDraft();
});

document.getElementById("closureForm").addEventListener("input", (event) => {
  state.closure = { ...state.closure, ...formToObject(event.currentTarget) };
  persistDraft();
});

document.getElementById("showParticipantPicker").addEventListener("click", () => {
  const picker = document.getElementById("participantPicker");
  picker.hidden = !picker.hidden;
  if (!picker.hidden) document.getElementById("participantSelect").focus();
});

document.getElementById("participantSelect").addEventListener("change", (event) => {
  addParticipantFromOption(event.currentTarget.selectedOptions[0]);
  event.currentTarget.selectedIndex = 0;
  document.getElementById("participantPicker").hidden = true;
});

document.getElementById("setEndTime").addEventListener("click", () => {
  const field = document.getElementById("closureForm").elements.horaFinal;
  field.value = localTimeValue();
  state.closure = { ...state.closure, horaFinal: field.value };
  persistDraft();
});

document.getElementById("obsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await addRecordFromForm(event.currentTarget, state.observations, "observation", "obs");
});

document.getElementById("macroForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await addRecordFromForm(event.currentTarget, state.macroSamples, "macro", "macro");
  closeRecordSheet();
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
  const identifiedForm = event.currentTarget;
  await addRecordFromForm(
    identifiedForm,
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
  if (String(determination.rank || "").toLowerCase() === "familia") {
    const familyField = document.getElementById("macroForm")?.elements.familias;
    if (familyField) {
      const existing = familiesFromText(familyField.value);
      if (!existing.some((family) => family.toLowerCase() === determination.taxon.toLowerCase())) {
        familyField.value = [...existing, determination.taxon].join("\n");
      }
    }
  }
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

prepareFieldWorkflow();
updateNetworkStatus();
render();
void updateStorageEstimate();

let requestedPanel = location.hash.slice(1) || sessionStorage.getItem("btmm-active-panel");
if (requestedPanel === "identificar") requestedPanel = "macro";
const workflowPanels = ["gira", "mapa", "macro", "caudal", "cierre", "exportar"];
if (!workflowPanels.includes(requestedPanel)) requestedPanel = "";
if (!requestedPanel || (requestedPanel !== "gira" && !state.trip.locked)) {
  requestedPanel = state.trip.locked ? "mapa" : "gira";
}
if (requestedPanel) activatePanel(requestedPanel, { scroll: false });
