<script setup lang="ts">
import Card from "primevue/card";
</script>

<template>
  <Card
    class="h-full"
    :pt="{
      body: { class: 'flex flex-col items-center justify-center h-full' },
    }"
  >
    <template #content>
      <div class="flex flex-col items-center justify-center h-full gap-4">
        <i class="fas fa-search text-gray-400 text-3xl"></i>
        <div class="text-gray-400 text-md">
          Enter a pattern and search to see results
        </div>
      </div>
    </template>
  </Card>
</template>
