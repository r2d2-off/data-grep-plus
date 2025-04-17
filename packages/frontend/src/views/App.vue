<script setup lang="ts">
import { ResultsContainer } from "@/components/results";
import { SearchContainer } from "@/components/search";
import Splitter from "primevue/splitter";
import SplitterPanel from "primevue/splitterpanel";
</script>

<template>
  <Splitter class="h-full" layout="vertical">
    <SplitterPanel :size="30" :minSize="20">
      <SearchContainer />
    </SplitterPanel>

    <SplitterPanel :size="70" :minSize="50">
      <ResultsContainer />
    </SplitterPanel>
  </Splitter>
</template>
