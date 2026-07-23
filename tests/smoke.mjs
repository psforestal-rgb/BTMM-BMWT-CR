import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "/tmp/btmm-test/node_modules/jsdom/lib/api.js";
import { indexedDB, IDBKeyRange } from "/tmp/btmm-test/node_modules/fake-indexeddb/build/esm/index.js";

const root = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const dom = new JSDOM(html, {
  url: "https://example.test/BTMM-BMWT-CR/",
  runScripts: "outside-only"
});
const { window } = dom;

Object.defineProperty(window, "indexedDB", { value: indexedDB });
Object.defineProperty(window, "IDBKeyRange", { value: IDBKeyRange });
Object.defineProperty(window.navigator, "storage", {
  value: {
    estimate: async () => ({ usage: 1024, quota: 1024 * 1024 }),
    persisted: async () => true,
    persist: async () => true
  }
});
window.alert = (message) => {
  throw new Error("Alerta inesperada: " + message);
};
window.confirm = () => true;
window.URL.createObjectURL = () => "blob:test";
window.URL.revokeObjectURL = () => {};
window.createImageBitmap = async () => ({ width: 1200, height: 900, close() {} });
window.HTMLCanvasElement.prototype.getContext = () => ({
  drawImage() {},
  fillRect() {},
  fillText() {},
  measureText(text) { return { width: String(text).length * 8 }; },
  set fillStyle(value) {},
  set font(value) {},
  set textAlign(value) {},
  set textBaseline(value) {}
});
window.HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
  callback(new window.Blob(["imagen-con-marca"], { type: type || "image/jpeg" }));
};

window.eval(fs.readFileSync(path.join(root, "vendor/proj4.js"), "utf8"));
window.eval(fs.readFileSync(path.join(root, "vendor/jszip.min.js"), "utf8"));
const keySource = fs.readFileSync(path.join(root, "key-data.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

window.eval(`${keySource}
${appSource}
globalThis.__smoke = (async () => {
  const options = [...document.querySelectorAll("[data-open-record]")]
    .map((button) => button.dataset.openRecord);
  if (options.join(",") !== "caudal,macro,observaciones,cierre") {
    throw new Error("Menú (+) inesperado: " + options.join(","));
  }

  const expectedObservationTypes = [
    "", "Ecosistema", "Formación hidrogeológica", "Especie indicadora",
    "Impacto ambiental", "Otro"
  ];
  const observationTypes = [...document.getElementById("obsForm").elements.tipo.options]
    .map((option) => option.value);
  if (JSON.stringify(observationTypes) !== JSON.stringify(expectedObservationTypes)) {
    throw new Error("Categorías OB incompletas");
  }

  function lockManualCoordinates(form) {
    form.elements.coordMode.value = "manual";
    form.elements.coordMode.dispatchEvent(new Event("change"));
    form.elements.este.value = "491227.85";
    form.elements.norte.value = "1098003.55";
    form.elements.altitud.value = "2250";
    form.elements.incertidumbreX.value = "5";
    form.elements.incertidumbreY.value = "5";
    form.elements.incertidumbreZ.value = "8";
    ["este", "norte", "altitud", "incertidumbreX", "incertidumbreY", "incertidumbreZ"]
      .forEach((name) => form.elements[name].dispatchEvent(new Event("input")));
    const lockButton = form.querySelector(".gps-lock-button");
    if (lockButton.disabled) throw new Error("No se habilitó el bloqueo ≤10 m");
    lockButton.click();
    if (form.elements.coordLocked.value !== "si") {
      throw new Error("No se bloquearon las coordenadas");
    }
  }

  const obsForm = document.getElementById("obsForm");
  if (obsForm.elements.codigo.value !== "001-OB") {
    throw new Error("Vista previa OB incorrecta: " + obsForm.elements.codigo.value);
  }
  obsForm.elements.tipo.value = "Ecosistema";
  obsForm.elements.detalle.value = "Bosque pluvial montano";
  lockManualCoordinates(obsForm);
  const photo = new File(["foto"], "prueba.jpg", {
    type: "image/jpeg",
    lastModified: Date.parse("2026-07-23T12:00:00-06:00")
  });
  queueFiles(obsForm, [photo]);
  const observation = await addRecordFromForm(
    obsForm, state.observations, "observation", "obs"
  );
  const storedPhotos = await getPhotos(observation.id);
  if (observation.codigo !== "001-OB" || storedPhotos.length !== 1) {
    throw new Error("No se guardó 001-OB con su fotografía");
  }
  if (!storedPhotos[0].watermarked || storedPhotos[0].coordinateSnapshot.este !== "491227.85") {
    throw new Error("La fotografía no conservó marca de agua y coordenadas");
  }

  const macroForm = document.getElementById("macroForm");
  prepareRecordForm(macroForm, "macro");
  if (macroForm.elements.codigo.value !== "002-MI") {
    throw new Error("Consecutivo MI incorrecto");
  }
  lockManualCoordinates(macroForm);
  const macro = await addRecordFromForm(macroForm, state.macroSamples, "macro", "macro");

  const sectionForm = document.getElementById("sectionForm");
  prepareRecordForm(sectionForm, "flow");
  sectionForm.elements.anchoTotal.value = "2";
  lockManualCoordinates(sectionForm);
  const flow = await addRecordFromForm(
    sectionForm, state.flowSections, "flow", "flow", { verticals: [] }
  );
  if (macro.codigo !== "002-MI" || flow.codigo !== "003-PM") {
    throw new Error("El consecutivo compartido no respeta el orden de guardado");
  }

  const gpsForm = document.getElementById("obsForm");
  const samples = [
    { east: 500000, north: 1100000, latitude: 9.95, longitude: -84, accuracy: 8, altitude: 2200, altitudeAccuracy: 9, timestamp: 1 },
    { east: 500002, north: 1100001, latitude: 9.95001, longitude: -83.99999, accuracy: 7, altitude: 2201, altitudeAccuracy: 8, timestamp: 2 },
    { east: 500001, north: 1099999, latitude: 9.94999, longitude: -84.00001, accuracy: 6, altitude: 2200, altitudeAccuracy: 7, timestamp: 3 }
  ];
  gpsForm.elements.coordMode.value = "gps";
  const quality = applyAveragedGps(gpsForm, samples);
  if (quality.horizontalUncertainty > 10 || quality.verticalUncertainty > 10) {
    throw new Error("El promedio GPS no alcanzó la incertidumbre prevista");
  }

  const codes = [
    ...state.observations, ...state.macroSamples, ...state.flowSections
  ].map((record) => record.codigo);
  if (new Set(codes).size !== codes.length) throw new Error("Hay códigos duplicados");

  return {
    codes,
    observationTypes,
    photoWatermarked: storedPhotos[0].watermarked,
    horizontalUncertainty: quality.horizontalUncertainty,
    verticalUncertainty: quality.verticalUncertainty
  };
})();`);

console.log(JSON.stringify(await window.__smoke));
