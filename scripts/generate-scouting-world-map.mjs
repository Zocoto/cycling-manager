import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NATURAL_EARTH_SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = process.argv[2];
const outputPath = path.join(projectRoot, "public", "images", "scouting-world-map.svg");

const geoJson = sourcePath
  ? JSON.parse(await readFile(path.resolve(projectRoot, sourcePath), "utf8"))
  : await fetch(NATURAL_EARTH_SOURCE).then((response) => {
      if (!response.ok) throw new Error(`Natural Earth download failed (${response.status})`);
      return response.json();
    });

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;
const MAX_X = 2.706629983696075;
const MAX_Y = 1.3173627591574133;

function project([longitude, latitude]) {
  const lambda = (longitude * Math.PI) / 180;
  const phi = (latitude * Math.PI) / 180;
  const l = Math.asin(M * Math.sin(phi));
  const l2 = l * l;
  const l6 = l2 * l2 * l2;
  const x =
    (lambda * Math.cos(l)) /
    (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)));
  const y = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2));

  return [((x + MAX_X) / (2 * MAX_X)) * 1000, ((MAX_Y - y) / (2 * MAX_Y)) * 500];
}

function point([x, y]) {
  return `${x.toFixed(1)} ${y.toFixed(1)}`;
}

function ringPath(ring) {
  return ring.map((coordinate, index) => `${index ? "L" : "M"}${point(project(coordinate))}`).join("") + "Z";
}

function geometryPath(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => polygon.map(ringPath)).join("");
}

function graticulePath() {
  const lines = [];

  for (let longitude = -150; longitude <= 150; longitude += 30) {
    const coordinates = [];
    for (let latitude = -90; latitude <= 90; latitude += 2) coordinates.push([longitude, latitude]);
    lines.push(coordinates);
  }

  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const coordinates = [];
    for (let longitude = -180; longitude <= 180; longitude += 2) coordinates.push([longitude, latitude]);
    lines.push(coordinates);
  }

  return lines
    .map((line) => line.map((coordinate, index) => `${index ? "L" : "M"}${point(project(coordinate))}`).join(""))
    .join("");
}

const countriesPath = geoJson.features.map((feature) => geometryPath(feature.geometry)).join("");
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated from Natural Earth 1:110m Admin 0 countries (public domain). -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" preserveAspectRatio="none">
  <defs><path id="countries" d="${countriesPath}"/></defs>
  <path d="${graticulePath()}" fill="none" stroke="#D6DFD2" stroke-opacity=".09" stroke-width=".65" vector-effect="non-scaling-stroke"/>
  <use href="#countries" fill="#9BE0CA" fill-opacity=".2" fill-rule="evenodd" stroke="#9BE0CA" stroke-opacity=".14" stroke-width="2.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  <use href="#countries" fill="#9BE0CA" fill-opacity=".15" fill-rule="evenodd" stroke="#B9E9DB" stroke-opacity=".34" stroke-width=".55" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  <path d="M0 250H1000" fill="none" stroke="#72D4B7" stroke-opacity=".14" stroke-width=".9" vector-effect="non-scaling-stroke"/>
</svg>
`;

await writeFile(outputPath, svg, "utf8");
console.log(`Generated ${path.relative(projectRoot, outputPath)} from ${geoJson.features.length} Natural Earth features.`);
