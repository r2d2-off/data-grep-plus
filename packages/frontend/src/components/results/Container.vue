<script setup lang="ts">
import { useGrepStore } from "@/stores";
import None from "./None.vue";
import Results from "./Results.vue";
import Searching from "./Searching.vue";
import Welcome from "./Welcome.vue";

const store = useGrepStore();
</script>

<template>
  <Results
    v-if="
      store.searchResults && store.searchResults.count > 0
    "
  />
  <Welcome v-else-if="!store.pattern.trim()" />
  <Searching v-else-if="store.isSearching" />
  <None v-else />
</template>
