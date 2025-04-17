<script setup lang="ts">
import { usePatternsStore } from "@/stores";
import Button from "primevue/button";

const patternsStore = usePatternsStore();
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-gray-300">
      Select a predefined pattern to use in your search:
    </p>

    <div class="grid grid-cols-1 gap-4">
      <div
        v-for="pattern in patternsStore.predefinedPatterns"
        :key="pattern.name"
        class="p-4 border border-gray-700 rounded-lg hover:bg-zinc-900/50 transition-colors"
      >
        <div class="flex justify-between items-start">
          <div>
            <h3 class="text-lg font-medium">{{ pattern.name }}</h3>
            <p class="text-sm text-gray-400">{{ pattern.description }}</p>
            <code
              class="mt-2 block text-xs text-gray-300 bg-gray-600 p-2 rounded"
              >{{ pattern.pattern }}</code
            >
          </div>
          <Button
            icon="fas fa-check"
            class="p-button-sm p-button-outlined"
            @click="patternsStore.applyPattern(pattern)"
            tooltip="Apply this pattern"
          />
        </div>
      </div>
    </div>
  </div>
</template>
