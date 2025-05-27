import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useGrepStore } from "./grepStore";
import { useCustomRegexRepository } from "@/repositories/customRegex";
import type { CustomRegex } from "shared";

interface PredefinedPattern {
  name: string;
  pattern: string;
  description: string;
  matchGroups?: number[];
}

export const usePatternsStore = defineStore("patterns", () => {
  const grepStore = useGrepStore();
  const customRegexRepo = useCustomRegexRepository();

  const dialogVisible = ref(false);
  const scrollPosition = ref(0);
  const customPatterns = ref<(CustomRegex & { id: string })[]>([]);
  const isLoading = ref(false);
  const editingPattern = ref<(CustomRegex & { id: string }) | null>(null);
  const showCustomRegexDialog = ref(false);

  const predefinedPatterns: PredefinedPattern[] = [
    {
      name: "Email",
      pattern: "[\\w.-]+@[\\w.-]+\\.\\w+",
      description: "Matches email addresses",
    },
    {
      name: "URL",
      pattern: "https?://[\\w.-]+(?:\\.[a-zA-Z]{2,})+[\\w/.-]*",
      description: "Matches HTTP/HTTPS URLs",
    },
    {
      name: "IP Address",
      pattern: "(?:[0-9]{1,3}\\.){3}[0-9]{1,3}",
      description: "Matches IPv4 addresses",
    },
    {
      name: "JSON Object",
      pattern: "\\{[^}]*\\}",
      description: "Matches simple JSON objects",
    },
    {
      name: "AWS Keys",
      pattern: "AKIA[0-9A-Z]{16}",
      description: "Matches AWS access key IDs",
    },
    {
      name: "JWT Tokens",
      pattern: "eyJ[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*",
      description: "Matches JWT tokens",
    },
    {
      name: "Strings",
      pattern: "'(.*?)'|\"(.*?)\"|`(.*?)`",
      description: "Matches strings",
      matchGroups: [1, 2, 3],
    },
  ];

  const allPatterns = computed(() => [
    ...predefinedPatterns,
    ...customPatterns.value.map((cp) => ({
      name: cp.name,
      pattern: cp.regex,
      description: cp.description,
      matchGroups: cp.matchGroups,
    })),
  ]);

  async function loadCustomPatterns() {
    isLoading.value = true;
    try {
      const patterns = await customRegexRepo.listCustomRegexes();
      customPatterns.value = patterns.map((p) => ({
        id: p.id,
        ...p.regex,
      }));
    } catch (error) {
      console.error("Failed to load custom patterns:", error);
    } finally {
      isLoading.value = false;
    }
  }

  async function saveCustomPattern(id: string, pattern: CustomRegex) {
    const success = await customRegexRepo.upsertCustomRegex(id, pattern);
    if (success) {
      await loadCustomPatterns();
      closeCustomRegexDialog();
    }
    return success;
  }

  async function deleteCustomPattern(id: string) {
    const success = await customRegexRepo.deleteCustomRegex(id);
    if (success) {
      await loadCustomPatterns();
    }
    return success;
  }

  function openDialog() {
    dialogVisible.value = true;
    loadCustomPatterns();
  }

  function closeDialog() {
    dialogVisible.value = false;
    scrollPosition.value = 0;
  }

  function openCustomRegexDialog(pattern?: CustomRegex & { id: string }) {
    editingPattern.value = pattern || null;
    showCustomRegexDialog.value = true;
  }

  function closeCustomRegexDialog() {
    showCustomRegexDialog.value = false;
    editingPattern.value = null;
  }

  function applyPattern(pattern: PredefinedPattern) {
    grepStore.pattern = pattern.pattern;
    grepStore.options.matchGroups = pattern.matchGroups || null;
    closeDialog();
  }

  function updateScrollPosition(position: number) {
    scrollPosition.value = position;
  }

  return {
    dialogVisible,
    predefinedPatterns,
    customPatterns,
    allPatterns,
    scrollPosition,
    isLoading,
    editingPattern,
    showCustomRegexDialog,
    openDialog,
    closeDialog,
    openCustomRegexDialog,
    closeCustomRegexDialog,
    applyPattern,
    updateScrollPosition,
    loadCustomPatterns,
    saveCustomPattern,
    deleteCustomPattern,
  };
});
