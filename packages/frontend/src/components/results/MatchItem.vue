<script setup lang="ts">
import { ref } from 'vue';
import { useGrepStore } from "@/stores";
import type { GrepMatch } from "shared";

const props = defineProps<{ match: GrepMatch }>();
const expanded = ref(false);
const store = useGrepStore();

const toggle = () => {
  expanded.value = !expanded.value;
};

const escapeHtml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const highlight = (content: string) => {
  const regex = new RegExp(store.pattern, "gi");
  return escapeHtml(content).replace(regex, (m) => `<mark class="bg-yellow-300 text-black">${escapeHtml(m)}</mark>`);
};
</script>

<template>
  <div class="border-b border-gray-700">
    <div class="flex justify-between items-center p-2 bg-zinc-900 cursor-pointer" @click="toggle">
      <div class="text-sm break-all">
        {{ match.url }} - {{ match.location }}
      </div>
      <i :class="expanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
    </div>
    <div v-if="expanded" class="p-2 space-y-4 bg-zinc-900/50">
      <div>
        <div class="font-semibold mb-1 text-xs">Request</div>
        <pre class="overflow-x-auto text-xs" v-html="highlight(match.request)"></pre>
      </div>
      <div v-if="match.response">
        <div class="font-semibold mb-1 text-xs">Response</div>
        <pre class="overflow-x-auto text-xs" v-html="highlight(match.response!)"></pre>
      </div>
    </div>
  </div>
</template>
