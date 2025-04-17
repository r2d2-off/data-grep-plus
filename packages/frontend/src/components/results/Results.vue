<script setup lang="ts">
import { useSDK } from "@/plugins/sdk";
import { useGrepStore } from "@/stores";
import { copyToClipboard } from "@/utils/clipboard";
import Button from "primevue/button";
import Card from "primevue/card";
import Textarea from "primevue/textarea";

const store = useGrepStore();
const sdk = useSDK();

const exportToFile = () => {
  if (!store.matchesText) return;

  const blob = new Blob([store.matchesText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "grep-matches.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
              Matches ({{ store.searchResults.count }} requests,
              {{ store.uniqueMatchesCount }} matches)
            </template>
          </span>
          <div v-if="store.searchResults" class="text-sm text-gray-500">
            <template v-if="store.matchGroup !== null">
              Extracting group {{ store.matchGroup }}
            </template>
          </div>
        </div>
        <div class="flex flex-col gap-4 h-full">
          <Textarea
            :value="store.matchesText"
            readonly
            class="w-full h-full font-mono text-sm"
            placeholder="No matches found..."
          />
          <div class="flex justify-start gap-2">
            <Button
              label="Copy All Matches"
              icon="fas fa-copy"
              class="p-button-outlined"
              @click="copyToClipboard(sdk, store.matchesText)"
              :disabled="!store.matchesText"
            />
            <Button
              label="Export"
              icon="fas fa-download"
              class="p-button-outlined"
              @click="exportToFile"
              :disabled="!store.matchesText"
            />
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
