const STORAGE_KEY = "btmm-bmwt-cr-v1";

const BMWP_CR = {
  Perlidae: 10, Oligoneuriidae: 10, Odontoceridae: 10, Calamoceratidae: 10,
  Leptophlebiidae: 9, Leptoceridae: 9, Helicopsychidae: 9, Philopotamidae: 9,
  Euthyplociidae: 9, Glossosomatidae: 9,
  Psephenidae: 8, Hydrobiosidae: 8, Corydalidae: 8, Gomphidae: 8,
  Polycentropodidae: 8, Xiphocentronidae: 8,
  Baetidae: 7, Leptohyphidae: 7, Hydropsychidae: 7, Elmidae: 7,
  Aeshnidae: 7, Libellulidae: 7, Naucoridae: 7,
  Veliidae: 6, Gerridae: 6, Gyrinidae: 6, Dryopidae: 6, Lutrochidae: 6,
  Hydroptilidae: 6, Simuliidae: 5, Tipulidae: 5, Ceratopogonidae: 5,
  Tabanidae: 5, Belostomatidae: 5, Corixidae: 5,
  Chironomidae: 2, Culicidae: 2, Psychodidae: 2, Syrphidae: 1,
  Tubificidae: 1, Glossiphoniidae: 1, Planorbidae: 3, Physidae: 3
};

let state = loadState();

function loadState() {
  const fallback = {
    trip: {},
    observations: [],
    macroSamples: [],
    flowSection: {},
    verticals: []
  };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  document.getElementById("saveStatus").textContent = `Guardado ${new Date().toLocaleTimeString("es-CR")}`;
  render();
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function fillForm(form, values = {}) {
  [...form.elements].forEach((field) => {
    if (field.name && values[field.name] !== undefined) field.value = values[field.name];
  });
}

function familiesFromText(text) {
  return (text || "")
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function bmwpScore(samples) {
  const families = new Set(samples.flatMap((sample) => familiesFromText(sample.familias)));
  let score = 0;
  const missing = [];
  families.forEach((family) => {
    if (BMWP_CR[family] !== undefined) score += BMWP_CR[family];
    else missing.push(family);
  });
  return { score, familyCount: families.size, missing };
}

function classifyBmwp(score) {
  if (score > 120) return "Excelente";
  if (score >= 101) return "Muy buena";
  if (score >= 61) return "Aceptable";
  if (score >= 36) return "Dudosa";
  if (score >= 16) return "Critica";
  return "Muy critica o sin datos suficientes";
}

function calculateFlow() {
  const width = Number(state.flowSection.anchoTotal || 0);
  const verticals = [...state.verticals]
    .map((v) => ({
      ...v,
      distancia: Number(v.distancia),
      profundidad: Number(v.profundidad),
      velocidad: Number(v.velocidad)
    }))
    .filter((v) => Number.isFinite(v.distancia) && Number.isFinite(v.profundidad) && Number.isFinite(v.velocidad))
    .sort((a, b) => a.distancia - b.distancia);

  if (!width || verticals.length === 0) return { cubic: 0, liters: 0, verticals };

  const points = [
    { distancia: 0, profundidad: 0, velocidad: 0 },
    ...verticals,
    { distancia: width, profundidad: 0, velocidad: 0 }
  ];

  let cubic = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const left = points[i];
    const right = points[i + 1];
    const segmentWidth = Math.max(0, right.distancia - left.distancia);
    const meanDepth = (left.profundidad + right.profundidad) / 2;
    const meanVelocity = (left.velocidad + right.velocidad) / 2;
    cubic += segmentWidth * meanDepth * meanVelocity;
  }
  return { cubic, liters: cubic * 1000, verticals };
}

function makeItem(title, rows, onDelete) {
  const div = document.createElement("div");
  div.className = "item";
  div.innerHTML = `<h3>${escapeHtml(title)}</h3>${rows.map((row) => `<p>${escapeHtml(row)}</p>`).join("")}`;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Eliminar";
  button.addEventListener("click", onDelete);
  div.appendChild(button);
  return div;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function render() {
  fillForm(document.getElementById("tripForm"), state.trip);
  fillForm(document.getElementById("sectionForm"), state.flowSection);

  const obsList = document.getElementById("obsList");
  obsList.innerHTML = "";
  state.observations.forEach((obs, index) => {
    obsList.appendChild(makeItem(obs.nombre || `Punto ${index + 1}`, [
      `${obs.tipo || ""} | ${obs.lat || "sin lat"}, ${obs.lon || "sin lon"}`,
      `Precision: ${obs.precision || "sin dato"} m | Fotos: ${obs.fotos || "sin dato"}`,
      obs.notas || ""
    ], () => {
      state.observations.splice(index, 1);
      saveState();
    }));
  });

  const macroList = document.getElementById("macroList");
  macroList.innerHTML = "";
  state.macroSamples.forEach((sample, index) => {
    macroList.appendChild(makeItem(sample.codigo || `Muestra ${index + 1}`, [
      `${sample.metodo || ""} | ${sample.tiempo || "0"} min | ${sample.submuestras || "0"} submuestras`,
      `Habitats: ${sample.habitats || "sin dato"}`,
      `Familias: ${sample.familias || "sin dato"}`
    ], () => {
      state.macroSamples.splice(index, 1);
      saveState();
    }));
  });

  const score = bmwpScore(state.macroSamples);
  document.getElementById("bmwpSummary").textContent =
    `BMWP-CR preliminar: ${score.score} | ${classifyBmwp(score.score)} | Familias: ${score.familyCount}` +
    (score.missing.length ? ` | Sin puntaje cargado: ${score.missing.join(", ")}` : "");

  const verticalList = document.getElementById("verticalList");
  verticalList.innerHTML = "";
  const flow = calculateFlow();
  flow.verticals.forEach((vertical, index) => {
    verticalList.appendChild(makeItem(`Vertical ${index + 1}`, [
      `Distancia: ${vertical.distancia} m | Profundidad: ${vertical.profundidad} m | Velocidad: ${vertical.velocidad} m/s`,
      vertical.obs || ""
    ], () => {
      state.verticals.splice(index, 1);
      saveState();
    }));
  });

  const recommended = Number(state.flowSection.verticalesRecomendadas || 25);
  const warning = state.verticals.length && state.verticals.length < recommended
    ? ` | Advertencia: ${state.verticals.length}/${recommended} verticales`
    : "";
  document.getElementById("flowSummary").textContent =
    `Caudal estimado: ${flow.cubic.toFixed(4)} m3/s | ${flow.liters.toFixed(2)} l/s${warning}`;

  document.getElementById("jsonPreview").textContent = JSON.stringify(state, null, 2);
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function buildCsv() {
  const rows = [["tipo", "codigo", "punto", "lat", "lon", "detalle"]];
  state.observations.forEach((obs) => rows.push([
    "observacion", obs.nombre, obs.tipo, obs.lat, obs.lon, obs.notas
  ]));
  state.macroSamples.forEach((sample) => rows.push([
    "macroinvertebrados", sample.codigo, sample.punto, "", "", sample.familias
  ]));
  state.verticals.forEach((vertical, index) => rows.push([
    "vertical_caudal", `V${index + 1}`, state.flowSection.codigo || "", "", "",
    `dist=${vertical.distancia}; prof=${vertical.profundidad}; vel=${vertical.velocidad}`
  ]));
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.panel).classList.add("active");
  });
});

document.getElementById("tripForm").addEventListener("input", (event) => {
  state.trip = formToObject(event.currentTarget);
  saveState();
});

document.getElementById("sectionForm").addEventListener("input", (event) => {
  state.flowSection = formToObject(event.currentTarget);
  saveState();
});

document.getElementById("obsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.observations.push(formToObject(event.currentTarget));
  event.currentTarget.reset();
  saveState();
});

document.getElementById("macroForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.macroSamples.push(formToObject(event.currentTarget));
  event.currentTarget.reset();
  saveState();
});

document.getElementById("verticalForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.verticals.push(formToObject(event.currentTarget));
  event.currentTarget.reset();
  saveState();
});

document.getElementById("exportJson").addEventListener("click", () => {
  download(`BTMM-BMWT-CR-${Date.now()}.json`, JSON.stringify(state, null, 2), "application/json");
});

document.getElementById("exportCsv").addEventListener("click", () => {
  download(`BTMM-BMWT-CR-${Date.now()}.csv`, buildCsv(), "text/csv;charset=utf-8");
});

document.getElementById("printReport").addEventListener("click", () => window.print());

document.getElementById("clearData").addEventListener("click", () => {
  if (!confirm("Esto borra los datos guardados en este dispositivo. Desea continuar?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  saveState();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}

render();
