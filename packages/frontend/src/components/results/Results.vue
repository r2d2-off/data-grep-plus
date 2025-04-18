<script setup lang="ts">
import { useSDK } from "@/plugins/sdk";
import { useGrepStore } from "@/stores";
import { copyToClipboard } from "@/utils/clipboard";
import Button from "primevue/button";
import Card from "primevue/card";
import VirtualScroller from "primevue/virtualscroller";
import { ref } from "vue";

const store = useGrepStore();
const sdk = useSDK();
const isStoppingSearch = ref(false);

const exportToFile = () => {
  if (!store.uniqueMatches) return;

  const blob = new Blob([store.uniqueMatches.join("\n")], {
    type: "text/plain",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "grep-matches.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const stopSearch = async () => {
  isStoppingSearch.value = true;
  try {
    await store.stopGrepSearch();
  } catch (error) {
    console.error("Failed to stop grep:", error);
  } finally {
    isStoppingSearch.value = false;
  }
};
</script>

<template>
  <Card
    class="h-full"
    :pt="{
      body: { class: 'p-4 h-full' },
      content: { class: 'p-0 h-full' },
    }"
  >
    <template #content>
      <div class="flex flex-col h-full">
        <div class="flex justify-between items-center mb-4">
          <span class="text-xl font-semibold">
            <i class="fas fa-list mr-2"></i>
            <template v-if="store.searchResults">
              Matches ({{ store.uniqueMatchesCount }} matches)
            </template>
            <template v-else-if="store.isSearching"> Searching... </template>
          </span>
          <div class="text-sm text-gray-500 flex items-center gap-2">
            <template v-if="store.isSearching">
              <div class="shimmer">Searching {{ store.progress }}%</div>
            </template>
            <template
              v-else-if="store.searchResults && store.matchGroup !== null"
            >
              Extracting group {{ store.matchGroup }}
            </template>
          </div>
        </div>
        <div class="flex flex-col gap-4 h-full">
          <VirtualScroller
            v-if="store.uniqueMatches?.length"
            :items="store.uniqueMatches"
            :itemSize="24"
            class="w-full h-full border border-gray-700"
            scrollHeight="100%"
          >
            <template #item="{ item }">
              <div class="p-1 bg-zinc-900/30 transition-colors select-text">
                {{ item }}
              </div>
            </template>
            <template #content="{ items, loading }">
              <div v-if="!items.length && !loading" class="p-4 text-gray-400">
                No matches found...
              </div>
            </template>
          </VirtualScroller>
          <div v-else class="p-4 text-gray-400">No matches found...</div>

          <div class="flex justify-start gap-2">
            <Button
              label="Copy All Matches"
              icon="fas fa-copy"
              class="p-button-outlined"
              @click="
                copyToClipboard(sdk, store.searchResults?.join('\n') || '')
              "
              :disabled="!store.searchResults"
            />
            <Button
              label="Export"
              icon="fas fa-download"
              class="p-button-outlined"
              @click="exportToFile"
              :disabled="!store.searchResults"
            />
            <Button
              v-if="store.isSearching"
              severity="danger"
              size="small"
              label="Stop"
              icon="fas fa-stop"
              :loading="isStoppingSearch"
              @click="stopSearch"
            />
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
