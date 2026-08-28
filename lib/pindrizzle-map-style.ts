/*
 * Canonical Pindrizzle MapLibre style.
 *
 * This is deliberately owned by the app rather than recolouring a stock style at
 * runtime. OpenFreeMap supplies OpenMapTiles-schema vector data; Pindrizzle owns
 * every visible layer, colour, label and road decision below.
 */

const OPEN_FREE_MAP_SOURCE = "https://tiles.openfreemap.org/planet";
const OPEN_FREE_MAP_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

const MAP = {
  background: "#aebdc5",
  land: "#b8c6cc",
  residential: "#b4c3c9",
  commercial: "#aebec5",
  industrial: "#a3b4bc",
  park: "#9abbb7",
  woodland: "#91b2ad",
  building: "#93a7b0",
  buildingOutline: "#7d939e",
  water: "#2db8c6",
  waterLine: "#118fa4",
  path: "#dce8ec",
  roadMinor: "#c6e4e6",
  roadMajor: "#67cbd2",
  roadPrimary: "#1e9fb3",
  roadCasing: "#6a8390",
  boundary: "#536d7b",
  label: "#294d60",
  labelStrong: "#082b49",
  labelMuted: "#587481",
  labelHalo: "#dce8eb",
} as const;

type MapStyle = {
  version: 8;
  name: string;
  sources: Record<string, unknown>;
  glyphs: string;
  layers: Array<Record<string, unknown>>;
};

const nameExpression = ["coalesce", ["get", "name:latin"], ["get", "name"]];

const style: MapStyle = {
  version: 8,
  name: "Pindrizzle Local",
  sources: {
    openmaptiles: {
      type: "vector",
      url: OPEN_FREE_MAP_SOURCE,
    },
  },
  glyphs: OPEN_FREE_MAP_GLYPHS,
  layers: [
    {
      id: "pd-background",
      type: "background",
      paint: { "background-color": MAP.background },
    },
    {
      id: "pd-landcover-wood",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["in", "class", "wood", "grass", "farmland"],
      paint: { "fill-color": MAP.woodland, "fill-opacity": 0.9 },
    },
    {
      id: "pd-landuse-residential",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: ["==", "class", "residential"],
      paint: { "fill-color": MAP.residential, "fill-opacity": 0.94 },
    },
    {
      id: "pd-landuse-commercial",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: ["in", "class", "commercial", "retail", "school", "hospital"],
      paint: { "fill-color": MAP.commercial, "fill-opacity": 0.9 },
    },
    {
      id: "pd-landuse-industrial",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: ["==", "class", "industrial"],
      paint: { "fill-color": MAP.industrial, "fill-opacity": 0.9 },
    },
    {
      id: "pd-parks",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "park",
      paint: { "fill-color": MAP.park, "fill-opacity": 0.94 },
    },
    {
      id: "pd-water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": MAP.water, "fill-opacity": 0.98 },
    },
    {
      id: "pd-waterway",
      type: "line",
      source: "openmaptiles",
      "source-layer": "waterway",
      paint: {
        "line-color": MAP.waterLine,
        "line-opacity": 0.94,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 13, 1.4, 17, 2.7],
      },
    },
    {
      id: "pd-buildings",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 12,
      paint: {
        "fill-color": MAP.building,
        "fill-outline-color": MAP.buildingOutline,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.42, 15, 0.88],
      },
    },
    {
      id: "pd-paths",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: ["in", "class", "path", "track", "service"],
      paint: {
        "line-color": MAP.path,
        "line-opacity": 0.9,
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.7, 17, 2.4],
      },
    },
    {
      id: "pd-road-casing",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary", "minor"],
      paint: {
        "line-color": MAP.roadCasing,
        "line-opacity": 0.72,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.5, 11, 2.8, 15, 7.7, 18, 16.4],
      },
    },
    {
      id: "pd-road-minor",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: ["in", "class", "minor", "service", "residential"],
      paint: {
        "line-color": MAP.roadMinor,
        "line-opacity": 0.96,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 13, 1.6, 17, 5.3],
      },
    },
    {
      id: "pd-road-major",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: ["in", "class", "secondary", "tertiary"],
      paint: {
        "line-color": MAP.roadMajor,
        "line-opacity": 0.98,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.9, 11, 1.8, 15, 5.9, 18, 12.3],
      },
    },
    {
      id: "pd-road-primary",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      filter: ["in", "class", "motorway", "trunk", "primary"],
      paint: {
        "line-color": MAP.roadPrimary,
        "line-opacity": 1,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 10, 2.4, 14, 6.5, 18, 14.4],
      },
    },
    {
      id: "pd-boundaries",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      paint: {
        "line-color": MAP.boundary,
        "line-opacity": 0.5,
        "line-dasharray": [2, 2],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 12, 1],
      },
    },
    {
      id: "pd-water-labels",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "water_name",
      minzoom: 9,
      layout: {
        "text-field": nameExpression,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10, 15, 12],
        "text-letter-spacing": 0.02,
      },
      paint: {
        "text-color": "#0d6374",
        "text-halo-color": MAP.labelHalo,
        "text-halo-width": 1.35,
        "text-halo-blur": 0.15,
      },
    },
    {
      id: "pd-road-labels",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom: 11.5,
      layout: {
        "symbol-placement": "line",
        "text-field": nameExpression,
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11.5, 9, 16, 11],
        "text-letter-spacing": 0.015,
        "text-max-angle": 30,
      },
      paint: {
        "text-color": MAP.label,
        "text-halo-color": MAP.labelHalo,
        "text-halo-width": 1.5,
        "text-halo-blur": 0.2,
      },
    },
    {
      id: "pd-place-labels",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 5,
      filter: ["in", "class", "city", "town", "village", "suburb", "neighbourhood"],
      layout: {
        "text-field": nameExpression,
        "text-font": ["Noto Sans Regular"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          10,
          11,
          12,
          15,
          14,
        ],
        "text-letter-spacing": 0.015,
        "text-max-width": 9,
      },
      paint: {
        "text-color": MAP.labelStrong,
        "text-halo-color": MAP.labelHalo,
        "text-halo-width": 1.55,
        "text-halo-blur": 0.2,
      },
    },
  ],
};

export async function loadPindrizzleMapStyle(): Promise<MapStyle> {
  /* Return a fresh object because MapLibre mutates style objects internally. */
  return JSON.parse(JSON.stringify(style)) as MapStyle;
}
