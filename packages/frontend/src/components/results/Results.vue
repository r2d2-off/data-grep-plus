<script setup lang="ts">
import { useSDK } from "@/plugins/sdk";
import { useGrepRepository } from "@/repositories/grep";
import { useGrepStore } from "@/stores";
import { copyToClipboard } from "@/utils/clipboard";
import { formatTime } from "@/utils/time";
import { extractHost, extractStatusCode, extractDate } from "@/utils/http";
import Button from "primevue/button";
import Card from "primevue/card";
import Dropdown from "primevue/dropdown";
import Splitter from "primevue/splitter";
import SplitterPanel from "primevue/splitterpanel";
import VirtualScroller from "primevue/virtualscroller";
import RequestViewer from "./RequestViewer.vue";
import ResponseViewer from "./ResponseViewer.vue";
import { computed, ref, watch } from "vue";
import type { GrepMatch } from "shared";

const store = useGrepStore();
const isStoppingSearch = ref(false);
const isExporting = ref(false);
const isCopying = ref(false);
const hostFilter = ref("");
const urlFilter = ref("");
const sortKey = ref("host");
const sortDir = ref<"asc" | "desc">("asc");
const sdk = useSDK();

const { downloadResults, stopGrep } = useGrepRepository();

const processed = computed(() => {
  const items = (store.results.searchResults || []).filter((i) => typeof i !== "string") as GrepMatch[];
  return items.map((m) => ({
    ...m,
    host: extractHost(m.request),
    status: extractStatusCode(m.response),
    size: m.response ? m.response.length : 0,
    time: extractDate(m.request) || extractDate(m.response || "") || "",
  }));
});

const filtered = computed(() => {
  let arr = processed.value;
  if (hostFilter.value) {
    arr = arr.filter((r) => r.host.toLowerCase().includes(hostFilter.value.toLowerCase()));
  }
  if (urlFilter.value) {
    arr = arr.filter((r) => r.url.toLowerCase().includes(urlFilter.value.toLowerCase()));
  }
  return arr;
});

const sortedResults = computed(() => {
  const arr = [...filtered.value];
  arr.sort((a, b) => {
    const av = (a as any)[sortKey.value] || "";
    const bv = (b as any)[sortKey.value] || "";
    if (av < bv) return sortDir.value === "asc" ? -1 : 1;
    if (av > bv) return sortDir.value === "asc" ? 1 : -1;
    return 0;
  });
  return arr;
});

watch(
  () => store.results.searchResults,
  (val) => {
    if (val && val.length > 0 && typeof val[0] !== "string") {
      store.selectMatch(val[0] as GrepMatch);
    }
  }
);

const hasResults = computed(() => sortedResults.value.length > 0);

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

const selectRow = (row: GrepMatch) => {
  store.selectMatch(row);
};
</script>

<template>
  <Card class="h-full" :pt="{ body: { class: 'p-4 h-full' }, content: { class: 'p-0 h-full' } }">
    <template #content>
      <div class="flex flex-col h-full">
        <div class="flex justify-between items-center mb-4">
          <span class="text-xl font-semibold">
            <i class="fas fa-list mr-2"></i>
            <template v-if="store.results.searchResults">
              Matches ({{ store.results.uniqueMatchesCount }} matches)
            </template>
            <template v-else-if="store.status.isSearching">Searching...</template>
          </span>
          <div class="text-sm text-gray-500 flex items-center gap-2">
            <template v-if="store.status.isSearching">
              <div class="shimmer">Searching {{ store.status.progress }}%</div>
            </template>
            <template v-else-if="store.results.searchResults && !store.results.cancelled">
              Scan finished in {{ formatTime(store.results.searchTime) }}
            </template>
            <template v-else-if="store.results.cancelled">Scan cancelled</template>
          </div>
        </div>
        <div class="flex justify-between items-center mb-2">
          <div class="flex items-center gap-2">
            <Button label="Copy All Matches" icon="fas fa-copy" class="p-button-outlined" @click="copyAllMatches" :loading="isCopying" :disabled="!hasResults" />
            <Button label="Export" icon="fas fa-download" class="p-button-outlined" @click="exportToFile" :loading="isExporting" :disabled="!hasResults" />
            <Button v-if="store.status.isSearching" severity="danger" size="small" label="Stop" icon="fas fa-stop" :loading="isStoppingSearch" @click="stopSearch" />
          </div>
          <div class="flex items-center gap-2">
            <input v-model="hostFilter" placeholder="Filter host" class="text-xs p-1 border border-gray-700" />
            <input v-model="urlFilter" placeholder="Filter URL" class="text-xs p-1 border border-gray-700" />
            <Dropdown class="text-xs w-32" :options="[{label:'Host',value:'host'},{label:'URL',value:'url'},{label:'Status',value:'status'},{label:'Size',value:'size'}]" v-model="sortKey" optionLabel="label" optionValue="value" />
            <Dropdown class="text-xs w-20" :options="[{label:'Asc',value:'asc'},{label:'Desc',value:'desc'}]" v-model="sortDir" optionLabel="label" optionValue="value" />
          </div>
        </div>
        <Splitter layout="vertical" class="h-full">
          <SplitterPanel :size="40" :minSize="20">
            <div class="border border-gray-700 h-full flex flex-col">
              <div class="flex bg-zinc-800 text-xs font-semibold border-b border-gray-700">
                <div class="w-24 px-2">Source</div>
                <div class="w-40 px-2">Host</div>
                <div class="flex-1 px-2">URL</div>
                <div class="w-16 px-2">Status</div>
                <div class="w-16 px-2">Size</div>
                <div class="w-36 px-2">Time</div>
              </div>
              <VirtualScroller :items="sortedResults" :itemSize="32" class="h-full" scrollHeight="100%">
                <template #item="{ item }">
                  <div class="flex text-xs border-b border-gray-700 hover:bg-zinc-900 cursor-pointer" @click="selectRow(item)">
                    <div class="w-24 px-2 truncate">{{ item.sourceType || 'Proxy' }}</div>
                    <div class="w-40 px-2 truncate">{{ item.host }}</div>
                    <div class="flex-1 px-2 truncate">{{ item.url }}</div>
                    <div class="w-16 px-2">{{ item.status ?? '' }}</div>
                    <div class="w-16 px-2">{{ item.size }}</div>
                    <div class="w-36 px-2 truncate">{{ item.time }}</div>
                  </div>
                </template>
                <template #content="{ items, loading }">
                  <div v-if="!items.length && !loading" class="p-4 text-gray-400">No matches found...</div>
                </template>
              </VirtualScroller>
            </div>
          </SplitterPanel>
          <SplitterPanel :size="60" :minSize="40">
            <Splitter>
              <SplitterPanel>
                <RequestViewer :match="store.selectedMatch" :pattern="store.pattern" />
              </SplitterPanel>
              <SplitterPanel>
                <ResponseViewer :match="store.selectedMatch" :pattern="store.pattern" />
              </SplitterPanel>
            </Splitter>
          </SplitterPanel>
        </Splitter>
      </div>
    </template>
  </Card>
</template>
