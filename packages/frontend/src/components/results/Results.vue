<script setup lang="ts">
import { useSDK } from "@/plugins/sdk";
import { useGrepRepository } from "@/repositories/grep";
import { useGrepStore } from "@/stores";
import { copyToClipboard } from "@/utils/clipboard";
import { formatTime } from "@/utils/time";
import Button from "primevue/button";
import Card from "primevue/card";
import Dropdown from "primevue/dropdown";
import VirtualScroller from "primevue/virtualscroller";
import MatchItem from "./MatchItem.vue";
import { computed, ref } from "vue";

const store = useGrepStore();
const isStoppingSearch = ref(false);
const isExporting = ref(false);
const isCopying = ref(false);
const sdk = useSDK();

type SortType =
  | "none"
  | "url-asc"
  | "url-desc"
  | "location-asc"
  | "location-desc";
const currentSort = ref<SortType>("none");

const sortOptions = [
  { label: "No sorting", value: "none", icon: "fas fa-list" },
  { label: "URL A-Z", value: "url-asc", icon: "fas fa-sort-alpha-down" },
  { label: "URL Z-A", value: "url-desc", icon: "fas fa-sort-alpha-up" },
  { label: "Location A-Z", value: "location-asc", icon: "fas fa-sort-alpha-down" },
  { label: "Location Z-A", value: "location-desc", icon: "fas fa-sort-alpha-up" },
];

const { downloadResults, stopGrep } = useGrepRepository();

const hasResults = computed(
  () => store.results.searchResults && store.results.searchResults?.length > 0
);

const sortedResults = computed(() => {
  if (!store.results.searchResults) return [];

  const results = [...store.results.searchResults];

  switch (currentSort.value) {
    case "url-asc":
      return results.sort((a, b) => a.url.localeCompare(b.url));
    case "url-desc":
      return results.sort((a, b) => b.url.localeCompare(a.url));
    case "location-asc":
      return results.sort((a, b) => a.location.localeCompare(b.location));
    case "location-desc":
      return results.sort((a, b) => b.location.localeCompare(a.location));
    default:
      return results;
  }
});

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
            <template v-else-if="store.status.isSearching">
              Searching...
            </template>
          </span>
          <div class="text-sm text-gray-500 flex items-center gap-2">
            <template v-if="store.status.isSearching">
              <div class="shimmer">Searching {{ store.status.progress }}%</div>
            </template>
            <template
              v-else-if="
                store.results.searchResults && !store.results.cancelled
              "
            >
              Scan finished in {{ formatTime(store.results.searchTime) }}
            </template>
            <template v-else-if="store.results.cancelled">
              Scan cancelled
            </template>
          </div>
        </div>
        <div class="flex flex-col gap-4 h-full">
          <div class="flex justify-end items-center">
            <div class="text-xs text-gray-500">
              {{ sortedResults.length }} items
            </div>
          </div>
          <VirtualScroller
            v-if="store.results.searchResults?.length"
            :items="sortedResults"
            :itemSize="80"
            class="w-full h-full border border-gray-700 transition-all duration-200"
            scrollHeight="100%"
            :key="currentSort"
          >
            <template #item="{ item }">
              <MatchItem :match="item" />
            </template>
            <template #content="{ items, loading }">
              <div v-if="!items.length && !loading" class="p-4 text-gray-400">
                No matches found...
              </div>
            </template>
          </VirtualScroller>
          <div v-else class="p-4 text-gray-400">No matches found...</div>

          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
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
            <div class="flex items-center gap-1">
              <span class="text-sm text-gray-400 mr-2">Sort:</span>
              <Dropdown
                :options="sortOptions"
                v-model="currentSort"
                optionLabel="label"
                optionValue="value"
                class="w-64"
                placeholder="Select sorting..."
              >
                <template #value="{ value }">
                  <div v-if="value" class="flex items-center gap-2">
                    <i
                      :class="
                        sortOptions.find((opt) => opt.value === value)?.icon
                      "
                      class="text-sm"
                    ></i>
                    <span>{{
                      sortOptions.find((opt) => opt.value === value)?.label
                    }}</span>
                  </div>
                  <span v-else>Select sorting...</span>
                </template>
                <template #option="{ option }">
                  <div class="flex items-center gap-2">
                    <i :class="option.icon" class="text-sm"></i>
                    <span>{{ option.label }}</span>
                  </div>
                </template>
              </Dropdown>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
