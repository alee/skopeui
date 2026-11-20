<template>
  <v-row
    class="text-center"
    align-content="center"
    justify="center"
    style="height: 100%; width: 100%"
  >
    <v-col>
      <v-progress-circular
        aria-label="Loading"
        :size="100"
        :width="5"
        color="tint"
        indeterminate
      />
    </v-col>
  </v-row>
</template>
