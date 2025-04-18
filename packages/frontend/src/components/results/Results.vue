<script setup lang="ts">
import { useSDK } from "@/plugins/sdk";
import { useGrepRepository } from "@/repositories/grep";
import { useGrepStore } from "@/stores";
import { copyToClipboard } from "@/utils/clipboard";
import { formatTime } from "@/utils/time";
import Button from "primevue/button";
import Card from "primevue/card";
import VirtualScroller from "primevue/virtualscroller";
import { computed, ref } from "vue";

const store = useGrepStore();
const isStoppingSearch = ref(false);
const isExporting = ref(false);
const isCopying = ref(false);
const sdk = useSDK();

const { downloadResults, stopGrep } = useGrepRepository();

const hasResults = computed(
  () => store.results.searchResults && store.results.searchResults?.length > 0
);

const copyAllMatches = async () => {
  if (!hasResults.value) return;

  isCopying.value = true;
  try {
    const data = await downloadResults();
    if (!data || data.length === 0) return;

    copyToClipboard(sdk, data.join("\n"));
  } catch (error) {
    console.error("Error copying matches:", error);
    sdk.window.showToast("Error copying matches", { variant: "error" });
  } finally {
    isCopying.value = false;
  }
};

const exportToFile = async () => {
  if (!hasResults.value) return;

  isExporting.value = true;
  try {
    const data = await downloadResults();
    if (!data || data.length === 0) return;

    const blob = new Blob([data.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grep-matches-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting results:", error);
    sdk.window.showToast("Error exporting results", { variant: "error" });
  } finally {
    isExporting.value = false;
  }
};

const stopSearch = async () => {
  isStoppingSearch.value = true;
  try {
    await stopGrep();
  } catch (error) {
    console.error("Failed to stop grep:", error);
    sdk.window.showToast("Failed to stop search", { variant: "error" });
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
            <template v-if="store.results.searchResults">
              Matches ({{ store.results.uniqueMatchesCount }} matches)
            </template>
            <template v-else-if="store.status.isSearching"> Searching... </template>
          </span>
          <div class="text-sm text-gray-500 flex items-center gap-2">
            <template v-if="store.status.isSearching">
              <div class="shimmer">Searching {{ store.status.progress }}%</div>
            </template>
            <template
              v-else-if="store.results.searchResults && !store.results.cancelled"
            >
              Scan finished in {{ formatTime(store.results.searchTime) }}
            </template>
            <template v-else-if="store.results.cancelled">
              Scan cancelled
            </template>
          </div>
        </div>
        <div class="flex flex-col gap-4 h-full">
          <VirtualScroller
            v-if="store.results.searchResults?.length"
            :items="store.results.searchResults"
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
              @click="copyAllMatches"
              :loading="isCopying"
              :disabled="!hasResults"
            />
            <Button
              label="Export"
              icon="fas fa-download"
              class="p-button-outlined"
              @click="exportToFile"
              :loading="isExporting"
              :disabled="!hasResults"
            />
            <Button
              v-if="store.status.isSearching"
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
