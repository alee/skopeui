# MapLibre controllers

`MapLibre.client.vue` owns Vue state, route/store bindings, file actions, CSS,
and worker setup. It creates one set of controllers per mounted component:

- `scene.ts` owns the MapLibre instance, basemap controls, viewport and dataset
  extent. Its load callback starts the other controllers.
- `raster.ts` owns the two raster slots, source-specific errors, render
  subscriptions and legend. It acknowledges a timestep only after the visible
  frame has rendered.
- `studyArea.ts` owns Geoman, the read-only overlay, drawing hints and geometry
  synchronization. Persistence is supplied through `useStudyArea` callbacks;
  programmatic synchronization cannot save or clear the selection.

Controllers receive getters and callbacks rather than importing stores or
routing. `scene.dispose()` disposes the drawing and raster controllers before
removing the map. Each controller removes its listeners and cancels pending
work; asynchronous Geoman setup must finish without reviving a disposed map.
Drawing configuration is built separately for each instance because plugins
may mutate their options.

`config.ts` supplies styles and tool configuration; `geometry.ts` holds shared
GeoJSON normalization. Tile URLs remain under the API gateway, and rendering
ranges and palettes remain API-owned.

`make test` runs controller TypeScript checks and component integration tests
for raster acknowledgements, cancellation, drawing synchronization, and teardown.
