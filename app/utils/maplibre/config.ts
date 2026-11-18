import { MAP_COLORS, MAP_OPACITIES } from "@/utils/colors";

// What to do with each tool, keyed by geoman's mode name. Every drawing tool
// works by clicking, not by dragging. Shown on the tool's tooltip and next to
// the pointer while the tool is active.
const DRAW_INSTRUCTIONS: Record<string, string> = {
  marker: "Click the map to place the point.",
  circle: "Click the center, then click again to set the radius.",
  rectangle: "Click one corner, then click the opposite corner.",
  polygon: "Click each corner, then click the first one again to finish.",
};
const EDIT_INSTRUCTIONS: Record<string, string> = {
  drag: "Drag the shape to move it.",
  change: "Drag a corner to change the shape.",
  rotate: "Drag a corner to rotate the shape.",
  delete: "Click the shape to remove it.",
};
export const TOOL_INSTRUCTIONS = { ...DRAW_INSTRUCTIONS, ...EDIT_INSTRUCTIONS };
// Shown in the map's header on select area.
export const DRAW_CALLOUT =
  "Choose a shape to draw your study area, or upload a GeoJSON file.";
export const EDIT_CALLOUT =
  "Draw a new shape to replace this one, or use the tools below to drag, change, rotate or delete it.";

// A study area is a polygon, rectangle, circle or point; hide geoman's other
// drawing tools. Cutting a hole in the one shape isn't useful. Snapping stays
// on without its button: it lets a polygon close on a click near its first
// corner.
export function createGeomanOptions() {
  return {
    controls: {
      draw: {
        marker: { title: `Point: ${DRAW_INSTRUCTIONS.marker}` },
        circle: { title: `Circle: ${DRAW_INSTRUCTIONS.circle}` },
        rectangle: { title: `Rectangle: ${DRAW_INSTRUCTIONS.rectangle}` },
        polygon: { title: `Polygon: ${DRAW_INSTRUCTIONS.polygon}` },
        circle_marker: { uiEnabled: false },
        text_marker: { uiEnabled: false },
        ellipse: { uiEnabled: false },
        line: { uiEnabled: false },
      },
      edit: {
        drag: { title: `Drag: ${EDIT_INSTRUCTIONS.drag}` },
        change: { title: `Change: ${EDIT_INSTRUCTIONS.change}` },
        rotate: { title: `Rotate: ${EDIT_INSTRUCTIONS.rotate}` },
        delete: { title: `Delete: ${EDIT_INSTRUCTIONS.delete}` },
        cut: { uiEnabled: false },
      },
      helper: {
        snapping: { uiEnabled: false, active: true },
        zoom_to_features: { title: "Zoom to shape" },
      },
    },
    layerStyles: geomanStudyAreaStyles(),
  };
}

// geoman draws the shape being drawn or edited itself, in its own blue and
// orange; give it the study area's colors, with the outline of a shape still
// being drawn in its own. Each entry replaces those values of geoman's layer
// of that type and keeps the rest.
function geomanStudyAreaStyles() {
  const shape = (outline: string) => [
    {
      type: "fill",
      paint: {
        "fill-color": MAP_COLORS.studyArea,
        "fill-opacity": MAP_OPACITIES.studyAreaDrawing,
      },
    },
    { type: "line", paint: { "line-color": outline } },
  ];
  return Object.fromEntries(
    ["polygon", "rectangle", "circle"].map((name) => [
      name,
      {
        gm_main: shape(MAP_COLORS.studyArea),
        gm_temporary: shape(MAP_COLORS.drawing),
      },
    ]),
  );
}

export const FILL_LAYER_ID = "dataset-region-fill";
export const STUDY_AREA_SOURCE_ID = "study-area-display";
export const STUDY_AREA_FILL_LAYER_ID = "study-area-display-fill";
export const STUDY_AREA_HALO_LAYER_ID = "study-area-display-halo";
export const STUDY_AREA_LINE_LAYER_ID = "study-area-display-outline";
export const STUDY_AREA_POINT_LAYER_ID = "study-area-display-point";
// Fitting a point's zero-size bbox would zoom all the way in; at zoom 10 one of
// paleocar_v3's 30" cells is a few pixels across.
export const MAX_FIT_ZOOM = 10;
