<script setup lang="ts">
import { useAIStore, useGrepStore, usePatternsStore } from "@/stores";
import Button from "primevue/button";
import Divider from "primevue/divider";
import Options from "./Options.vue";
import Search from "./Search.vue";
import { AIDialogContainer } from "./ai-dialog";
import { PatternsDialogContainer } from "./patterns";

const grepStore = useGrepStore();
const aiStore = useAIStore();
const patternsStore = usePatternsStore();
</script>

<template>
  <div class="flex flex-col gap-6">
    <Search />

    <Divider
      :pt="{
        root: {
          class:
            'my-1 text-gray-400 flex relative mx-0 py-0 px-5 w-full before:block before:absolute before:left-0 before:top-1/2 before:w-full before:border-solid before:border-t before:border-surface-200 before:dark:border-surface-600',
        },
      }"
      >Options</Divider
    >
    <Options />

    <div class="flex justify-start mt-2 gap-2">
      <Button
        label="Search"
        icon="fas fa-search"
        class="p-button-primary"
        @click="grepStore.searchGrepRequests"
        :loading="grepStore.isSearching"
        :disabled="!grepStore.pattern.trim()"
      />
      <Button
        :loading="aiStore.isProcessing"
        label="Ask AI"
        icon="fas fa-robot"
        class="p-button-secondary"
        @click="aiStore.openDialog"
      />
      <Button
        label="Predefined Patterns"
        icon="fas fa-list"
        class="p-button-secondary"
        @click="patternsStore.openDialog"
      />
    </div>

    <AIDialogContainer />
    <PatternsDialogContainer />
  </div>
</template>
