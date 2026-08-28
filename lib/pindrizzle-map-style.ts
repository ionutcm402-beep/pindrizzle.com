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
  background: "#d6e0e4",
  land: "#dce5e8",
  residential: "#d8e3e6",
  commercial: "#d3dfe3",
  industrial: "#cedbe0",
  park: "#c9ddda",
  woodland: "#c5dad6",
  building: "#c0ced4",
  buildingOutline: "#b3c3ca",
  water: "#62c5cf",
  waterLine: "#3aaebd",
  path: "#edf3f5",
  roadMinor: "#d9ecef",
  roadMajor: "#91d6dc",
  roadPrimary: "#4db8c6",
  roadCasing: "#aebfc6",
  boundary: "#8fa5b0",
  label: "#486675",
  labelStrong: "#1b3c50",
  labelMuted: "#6f8793",
  labelHalo: "#eaf1f3",
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
      paint: { "fill-color": MAP.woodland, "fill-opacity": 0.78 },
    },
    {
      id: "pd-landuse-residential",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: ["==", "class", "residential"],
      paint: { "fill-color": MAP.residential, "fill-opacity": 0.82 },
    },
    {
      id: "pd-landuse-commercial",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: ["in", "class", "commercial", "retail", "school", "hospital"],
      paint: { "fill-color": MAP.commercial, "fill-opacity": 0.74 },
    },
    {
      id: "pd-landuse-industrial",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: ["==", "class", "industrial"],
      paint: { "fill-color": MAP.industrial, "fill-opacity": 0.72 },
    },
    {
      id: "pd-parks",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "park",
      paint: { "fill-color": MAP.park, "fill-opacity": 0.84 },
    },
    {
      id: "pd-water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": MAP.water, "fill-opacity": 0.92 },
    },
    {
      id: "pd-waterway",
      type: "line",
      source: "openmaptiles",
      "source-layer": "waterway",
      paint: {
        "line-color": MAP.waterLine,
        "line-opacity": 0.78,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 13, 1.25, 17, 2.4],
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
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.3, 15, 0.76],
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
        "line-opacity": 0.8,
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
        "line-opacity": 0.54,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.4, 11, 2.6, 15, 7.4, 18, 16],
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
        "line-opacity": 0.9,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.7, 13, 1.5, 17, 5.2],
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
        "line-opacity": 0.9,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.8, 11, 1.6, 15, 5.7, 18, 12],
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
        "line-opacity": 0.94,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.9, 10, 2.2, 14, 6.2, 18, 14],
      },
    },
    {
      id: "pd-boundaries",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      paint: {
        "line-color": MAP.boundary,
        "line-opacity": 0.34,
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
        "text-color": "#1c7785",
        "text-halo-color": MAP.labelHalo,
        "text-halo-width": 1.2,
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
        "text-halo-width": 1.35,
        "text-halo-blur": 0.3,
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
        "text-halo-width": 1.4,
        "text-halo-blur": 0.35,
      },
    },
  ],
};

export async function loadPindrizzleMapStyle(): Promise<MapStyle> {
  /* Return a fresh object because MapLibre mutates style objects internally. */
  return JSON.parse(JSON.stringify(style)) as MapStyle;
}
