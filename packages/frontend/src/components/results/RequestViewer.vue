<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { GrepMatch } from 'shared';

const props = defineProps<{ match: GrepMatch | null; pattern: string }>();
const searchTerm = ref(props.pattern);
const preRef = ref<HTMLElement | null>(null);

watch(
  () => props.pattern,
  (v) => {
    if (!searchTerm.value) searchTerm.value = v;
  }
);

watch(
  () => props.match,
  async () => {
    await nextTick();
    if (preRef.value) {
      const mark = preRef.value.querySelector('mark');
      if (mark) mark.scrollIntoView();
    }
  }
);

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const highlight = (content: string) => {
  if (!content) return '';
  if (!searchTerm.value) return escapeHtml(content);
  const regex = new RegExp(searchTerm.value, 'gi');
  return escapeHtml(content).replace(regex, (m) => `<mark class="bg-yellow-300 text-black">${escapeHtml(m)}</mark>`);
};
</script>
<template>
  <div class="flex flex-col h-full border border-gray-700">
    <div class="p-1 border-b border-gray-700">
      <input v-model="searchTerm" class="w-full text-xs p-1" placeholder="Search..." />
    </div>
    <pre ref="preRef" class="overflow-auto flex-1 text-xs font-mono p-2" v-html="match ? highlight(match.request) : ''"></pre>
  </div>
</template>
