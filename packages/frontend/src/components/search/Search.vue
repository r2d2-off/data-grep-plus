<script setup lang="ts">
import { useGrepStore } from "@/stores";
import InputText from "primevue/inputtext";

const grepStore = useGrepStore();
</script>

<template>
  <div class="mt-2.5">
    <label class="block mb-2.5 font-medium">Search Pattern (regex)</label>
    <InputText
      v-model="grepStore.pattern"
      class="w-full h-10"
      placeholder="Enter a regex pattern to search for"
      v-tooltip.bottom="'Enter a regular expression to search for'"
    />
  </div>
</template>
