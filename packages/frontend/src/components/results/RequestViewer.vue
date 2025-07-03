<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted } from 'vue';
import type { GrepMatch } from 'shared';

const props = defineProps<{ match: GrepMatch | null; pattern: string }>();
const searchTerm = ref(props.pattern);
const activeTab = ref<'pretty' | 'raw'>('pretty');
const preRef = ref<HTMLElement | null>(null);
const matches = ref<HTMLElement[]>([]);
const currentIndex = ref(0);
let currentLineEl: HTMLElement | null = null;

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
    updateMatches();
  }
);

watch(activeTab, updateMatches);

const escapeHtml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const highlight = (content: string) => {
  if (!content) return '';
  if (!searchTerm.value) return escapeHtml(content);
  const regex = new RegExp(searchTerm.value, 'gi');
  return escapeHtml(content).replace(regex, (m) => `<mark class="bg-yellow-300 text-black">${escapeHtml(m)}</mark>`);
};

const content = computed(() => props.match ? props.match.request : '');

const highlightedLines = computed(() => {
  return highlight(content.value).split('\n');
});

const updateMatches = async () => {
  await nextTick();
  if (preRef.value) {
    matches.value = Array.from(preRef.value.querySelectorAll('mark')) as HTMLElement[];
    currentIndex.value = 0;
    scrollToCurrent(false);
  }
};

const scrollToCurrent = (smooth = true) => {
  const el = matches.value[currentIndex.value];
  if (!el) return;
  const lineEl = el.closest('.code-line') as HTMLElement | null;
  if (lineEl) {
    if (currentLineEl) currentLineEl.classList.remove('bg-yellow-100');
    currentLineEl = lineEl;
    currentLineEl.classList.add('bg-yellow-100');
  }
  el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
};

const nextMatch = () => {
  if (!matches.value.length) return;
  currentIndex.value = (currentIndex.value + 1) % matches.value.length;
  scrollToCurrent();
};

const prevMatch = () => {
  if (!matches.value.length) return;
  currentIndex.value = (currentIndex.value - 1 + matches.value.length) % matches.value.length;
  scrollToCurrent();
};

watch(searchTerm, updateMatches);
onMounted(updateMatches);
</script>
<template>
  <div class="flex flex-col h-full border border-gray-700 overflow-hidden">
    <div class="border-b border-gray-700 text-xs flex">
      <button
        class="px-2 py-1"
        :class="{ 'bg-zinc-800 font-semibold': activeTab === 'pretty' }"
        @click="activeTab = 'pretty'"
      >
        Pretty
      </button>
      <button
        class="px-2 py-1"
        :class="{ 'bg-zinc-800 font-semibold': activeTab === 'raw' }"
        @click="activeTab = 'raw'"
      >
        Raw
      </button>
    </div>
    <div
      ref="preRef"
      class="flex-1 overflow-auto text-xs font-mono p-2"
      :class="activeTab === 'raw' ? 'whitespace-pre' : 'whitespace-pre-wrap'"
    >
      <div v-for="(line, i) in highlightedLines" :key="i" class="flex code-line">
        <div class="w-10 pr-2 select-none text-right text-gray-500">{{ i + 1 }}</div>
        <div class="flex-1" v-html="line"></div>
      </div>
    </div>
    <div class="p-1 border-t border-gray-700 flex items-center gap-1 text-xs">
      <input v-model="searchTerm" class="p-1 flex-1" placeholder="Search..." />
      <button class="p-1 border border-gray-700" @click="prevMatch">&lt;</button>
      <button class="p-1 border border-gray-700" @click="nextMatch">&gt;</button>
    </div>
  </div>
</template>

<style scoped>
.code-line {
  display: flex;
}
</style>
