const BASE_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const MAP = {
  background: "#d9e2e6",
  land: "#dfe7e9",
  landAlt: "#d6e2e3",
  park: "#cfdfdc",
  building: "#c6d2d7",
  buildingOutline: "#b7c7ce",
  water: "#65c5cf",
  waterLine: "#3aaebd",
  roadLocal: "#eef4f5",
  roadMinor: "#d6eaed",
  roadMajor: "#85d1d7",
  roadPrimary: "#4db7c5",
  roadCasing: "#b5c8cf",
  boundary: "#94a9b4",
  label: "#344f5e",
  labelStrong: "#1d3d50",
  labelHalo: "#eef4f5",
} as const;

type StyleLayer = {
  id?: string;
  type?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  [key: string]: unknown;
};

type MapStyle = {
  name?: string;
  layers?: StyleLayer[];
  [key: string]: unknown;
};

function layerName(layer: StyleLayer) {
  return `${String(layer.id || "")} ${String(layer["source-layer"] || "")}`.toLowerCase();
}

function contains(name: string, terms: string[]) {
  return terms.some((term) => name.includes(term));
}

function paint(layer: StyleLayer, key: string, value: unknown) {
  layer.paint = { ...(layer.paint || {}), [key]: value };
}

function layout(layer: StyleLayer, key: string, value: unknown) {
  layer.layout = { ...(layer.layout || {}), [key]: value };
}

function brandLayer(layer: StyleLayer) {
  const name = layerName(layer);

  if (layer.type === "background") {
    paint(layer, "background-color", MAP.background);
    return layer;
  }

  if (layer.type === "fill") {
    if (contains(name, ["water", "ocean", "lake", "river"])) {
      paint(layer, "fill-color", MAP.water);
      paint(layer, "fill-opacity", 1);
    } else if (contains(name, ["building"])) {
      paint(layer, "fill-color", MAP.building);
      paint(layer, "fill-outline-color", MAP.buildingOutline);
      paint(layer, "fill-opacity", 0.86);
    } else if (contains(name, ["park", "wood", "forest", "grass", "garden", "green", "landcover"])) {
      paint(layer, "fill-color", MAP.park);
      paint(layer, "fill-opacity", 0.9);
    } else if (contains(name, ["industrial", "commercial", "school", "hospital", "landuse"])) {
      paint(layer, "fill-color", MAP.landAlt);
      paint(layer, "fill-opacity", 0.78);
    } else {
      paint(layer, "fill-color", MAP.land);
    }
    return layer;
  }

  if (layer.type === "line") {
    if (contains(name, ["waterway", "river", "stream", "canal"])) {
      paint(layer, "line-color", MAP.waterLine);
      paint(layer, "line-opacity", 0.72);
    } else if (contains(name, ["motorway", "trunk", "primary", "highway"])) {
      paint(layer, "line-color", MAP.roadPrimary);
      paint(layer, "line-opacity", 0.88);
    } else if (contains(name, ["secondary", "tertiary", "major road", "road_major"])) {
      paint(layer, "line-color", MAP.roadMajor);
      paint(layer, "line-opacity", 0.86);
    } else if (contains(name, ["road", "street", "bridge", "tunnel", "transportation"])) {
      paint(layer, "line-color", contains(name, ["casing", "outline"]) ? MAP.roadCasing : MAP.roadMinor);
      paint(layer, "line-opacity", 0.78);
    } else if (contains(name, ["boundary", "admin"])) {
      paint(layer, "line-color", MAP.boundary);
      paint(layer, "line-opacity", 0.38);
    } else {
      paint(layer, "line-color", MAP.roadLocal);
      paint(layer, "line-opacity", 0.55);
    }
    return layer;
  }

  if (layer.type === "symbol") {
    /* Pindrizzle is a utility map, not a POI directory. Keep labels quiet. */
    if (contains(name, ["poi", "transit", "airport", "railway station", "bus", "shop label"])) {
      layout(layer, "visibility", "none");
      return layer;
    }

    paint(layer, "text-color", contains(name, ["place", "city", "town", "road", "street"]) ? MAP.labelStrong : MAP.label);
    paint(layer, "text-halo-color", MAP.labelHalo);
    paint(layer, "text-halo-width", 1.2);
    paint(layer, "text-halo-blur", 0.35);
    return layer;
  }

  return layer;
}

export async function loadPindrizzleMapStyle(): Promise<MapStyle | string> {
  try {
    const response = await fetch(BASE_STYLE_URL, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Map style HTTP ${response.status}`);
    const style = (await response.json()) as MapStyle;
    style.name = "Pindrizzle Local";
    style.layers = (style.layers || []).map((layer) => brandLayer({ ...layer, paint: layer.paint ? { ...layer.paint } : undefined, layout: layer.layout ? { ...layer.layout } : undefined }));
    return style;
  } catch (error) {
    console.warn("Pindrizzle map style could not be prepared; using clean OpenFreeMap fallback.", error);
    return BASE_STYLE_URL;
  }
}
