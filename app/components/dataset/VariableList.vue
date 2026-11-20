<template>
  <section>
    <h3 class="text-h6">Variables</h3>
    <details v-for="group in groups" :key="group.category">
      <summary class="variable-group">
        <v-chip size="small" label color="primary">{{ group.category }}</v-chip>
        {{ " "
        }}<span class="variable-count">{{
          variableCount(group.variables.length)
        }}</span>
      </summary>
      <ul class="variable-titles">
        <li v-for="variable in group.variables" :key="variable.id">
          {{ variable.title }}
        </li>
      </ul>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Variable } from "@/types/metadata";

const props = defineProps<{
  variables?: Variable[] | null;
}>();

// Variables without a category go under this one, last.
const UNCATEGORIZED = "Other";

// Grouped by category, in the order the variables arrive (sorted by `order`).
// Every group starts closed.
const groups = computed(() => {
  const byCategory = new Map<string, Variable[]>();
  for (const variable of props.variables ?? []) {
    const category = variable.category || UNCATEGORIZED;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(variable);
  }
  const uncategorized = byCategory.get(UNCATEGORIZED);
  if (uncategorized) {
    byCategory.delete(UNCATEGORIZED);
    byCategory.set(UNCATEGORIZED, uncategorized);
  }
  return [...byCategory].map(([category, variables]) => ({
    category,
    variables,
  }));
});

function variableCount(count: number) {
  return count === 1 ? "1 variable" : `${count} variables`;
}
</script>

<style scoped>
.variable-group {
  min-height: 44px;
  padding: 8px 16px;
  cursor: pointer;
}

.variable-group > * {
  margin-inline-start: 8px;
}

.variable-count {
  display: inline-block;
}

.variable-group :deep(.v-chip) {
  height: auto;
  min-height: 24px;
  max-width: 100%;
  vertical-align: middle;
}

.variable-group :deep(.v-chip__content) {
  white-space: normal;
  overflow-wrap: anywhere;
}

.variable-group:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.variable-titles {
  padding: 4px 24px 12px 48px;
  overflow-wrap: anywhere;
}

.variable-titles li {
  padding-block: 4px;
}
</style>
