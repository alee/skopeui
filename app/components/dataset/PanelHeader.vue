<template>
  <div class="panel-header">
    <slot />
  </div>
</template>

<!--
  The bar at the top of the map and plot cards. Both use it, so side by side
  their headers have the same height and look, and their bodies start level.
-->
<style scoped>
.panel-header {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: var(--panel-header-align, center);
  justify-content: space-between;
  gap: 8px 12px;
  /* Side-by-side panels can also reserve the fields' validation space. */
  min-height: var(--panel-header-min-height, 64px);
  padding: 8px 16px;
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
