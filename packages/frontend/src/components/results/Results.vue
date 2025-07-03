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
import VirtualScroller from "primevue/virtualscroller";
import RequestViewer from "./RequestViewer.vue";
import ResponseViewer from "./ResponseViewer.vue";
import { computed, ref, watch, reactive } from "vue";
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
  () => sortedResults.value,
  (rows) => {
    if (rows.length > 0 && !store.selectedMatch) {
      store.selectMatch(rows[0] as GrepMatch);
    } else if (rows.length === 0) {
      store.selectMatch(null);
    }
  },
  { immediate: true }
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
  console.debug("Row clicked", row);
  if (store.selectedMatch === row) {
    store.selectMatch(null);
  } else {
    store.selectMatch(row);
  }
};

const columnWidths = reactive({
  source: 96,
  host: 160,
  url: 300,
  status: 64,
  size: 64,
  time: 144,
});

type ColKey = keyof typeof columnWidths;
const resizing = ref<null | { col: ColKey; startX: number; startWidth: number }>(null);

const onMouseMove = (e: MouseEvent) => {
  if (!resizing.value) return;
  const delta = e.clientX - resizing.value.startX;
  const newWidth = Math.max(50, resizing.value.startWidth + delta);
  columnWidths[resizing.value.col] = newWidth;
};

const stopResize = () => {
  if (!resizing.value) return;
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", stopResize);
  resizing.value = null;
};

const startResize = (col: ColKey, e: MouseEvent) => {
  resizing.value = { col, startX: e.clientX, startWidth: columnWidths[col] };
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", stopResize);
};

const rowMinWidth = computed(() =>
  columnWidths.source +
  columnWidths.host +
  columnWidths.url +
  columnWidths.status +
  columnWidths.size +
  columnWidths.time
);
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
        <div class="flex-1 flex flex-col">
          <div class="border border-gray-700 flex-1 flex flex-col overflow-hidden">
            <div
              class="flex bg-zinc-800 text-xs font-semibold border-b border-gray-700 sticky top-0 z-10"
              :style="{ minWidth: rowMinWidth + 'px', width: '100%' }"
            >
                <div
                  class="px-2 relative select-none truncate border-r border-gray-700"
                  :style="{ width: columnWidths.source + 'px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }"
                >
                  Source
                  <span
                    class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize"
                    @mousedown="startResize('source', $event)"
                  ></span>
                </div>
                <div
                  class="px-2 relative select-none truncate border-r border-gray-700"
                  :style="{ width: columnWidths.host + 'px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }"
                >
                  Host
                  <span
                    class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize"
                    @mousedown="startResize('host', $event)"
                  ></span>
                </div>
                <div
                  class="px-2 relative select-none truncate border-r border-gray-700"
                  :style="{ width: columnWidths.url + 'px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }"
                >
                  URL
                  <span
                    class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize"
                    @mousedown="startResize('url', $event)"
                  ></span>
                </div>
                <div
                  class="px-2 relative select-none text-right truncate border-r border-gray-700"
                  :style="{ width: columnWidths.status + 'px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }"
                >
                  Status
                  <span
                    class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize"
                    @mousedown="startResize('status', $event)"
                  ></span>
                </div>
                <div
                  class="px-2 relative select-none text-right truncate border-r border-gray-700"
                  :style="{ width: columnWidths.size + 'px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }"
                >
                  Size
                  <span
                    class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize"
                    @mousedown="startResize('size', $event)"
                  ></span>
                </div>
                <div
                  class="px-2 relative select-none truncate"
                  :style="{ width: columnWidths.time + 'px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }"
                >
                  Time
                  <span
                    class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize"
                    @mousedown="startResize('time', $event)"
                  ></span>
              </div>
            </div>
            <div class="flex-1 overflow-auto">
              <VirtualScroller
                :items="sortedResults"
                  :itemSize="32"
                  class="min-w-max"
                  scrollHeight="100%"
                  :style="{ minWidth: rowMinWidth + 'px', width: '100%' }"
                >
                  <template #item="{ item, index }">
                    <div
                      class="flex text-xs border-b border-gray-700 cursor-pointer"
                      :class="[
                        index % 2 === 0 ? 'bg-zinc-800' : 'bg-zinc-700',
                        store.selectedMatch === item ? 'bg-blue-700 text-white' : 'hover:bg-zinc-600'
                      ]"
                      :style="{ minWidth: rowMinWidth + 'px', width: '100%' }"
                      @click="selectRow(item)"
                    >
                      <div class="px-2 truncate border-r border-gray-700" :style="{ width: columnWidths.source + 'px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }" :title="item.sourceType || 'Proxy'">
                        {{ item.sourceType || 'Proxy' }}
                      </div>
                      <div class="px-2 truncate border-r border-gray-700" :style="{ width: columnWidths.host + 'px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }" :title="item.host">
                        {{ item.host }}
                      </div>
                      <div class="px-2 truncate border-r border-gray-700" :style="{ width: columnWidths.url + 'px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }" :title="item.url">
                        {{ item.url }}
                      </div>
                      <div class="px-2 border-r border-gray-700" :style="{ width: columnWidths.status + 'px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }" :title="item.status ?? ''">
                        {{ item.status ?? '' }}
                      </div>
                      <div class="px-2 border-r border-gray-700 text-right" :style="{ width: columnWidths.size + 'px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }" :title="String(item.size)">
                        {{ item.size }}
                      </div>
                      <div class="px-2 truncate" :style="{ width: columnWidths.time + 'px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }" :title="item.time">
                        {{ item.time }}
                      </div>
                    </div>
                  </template>
                  <template #content="{ items, loading }">
                    <div v-if="!items.length && !loading" class="p-4 text-gray-400">
                      No matches found...
                    </div>
                  </template>
                </VirtualScroller>
              </div>
            </div>
          </div>
          <div
            v-if="store.selectedMatch"
            class="mt-2 flex border border-gray-700"
            style="height: 40vh; min-height: 300px;"
          >
            <div class="flex-1 overflow-auto">
              <RequestViewer :match="store.selectedMatch" :pattern="store.pattern" />
            </div>
            <div class="flex-1 overflow-auto">
              <ResponseViewer :match="store.selectedMatch" :pattern="store.pattern" />
            </div>
          </div>
        </div>
      </template>
  </Card>
</template>
