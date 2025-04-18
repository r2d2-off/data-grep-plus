import { defineStore } from "pinia";
import { ref } from "vue";
import { useGrepStore } from "./grepStore";

interface PredefinedPattern {
  name: string;
  pattern: string;
  description: string;
}

export const usePatternsStore = defineStore("patterns", () => {
  const grepStore = useGrepStore();

  const dialogVisible = ref(false);
  const scrollPosition = ref(0);

  const predefinedPatterns: PredefinedPattern[] = [
    {
      name: "Email",
      pattern: "[\\w.-]+@[\\w.-]+\\.\\w+",
      description: "Matches email addresses"
    },
    {
      name: "URL",
      pattern: "https?://[\\w.-]+(?:\\.[a-zA-Z]{2,})+[\\w/.-]*",
      description: "Matches HTTP/HTTPS URLs"
    },
    {
      name: "IP Address",
      pattern: "(?:[0-9]{1,3}\\.){3}[0-9]{1,3}",
      description: "Matches IPv4 addresses"
    },
    {
      name: "JSON Object",
      pattern: "\\{[^}]*\\}",
      description: "Matches simple JSON objects"
    },
    {
      name: "AWS Keys",
      pattern: "AKIA[0-9A-Z]{16}",
      description: "Matches AWS access key IDs"
    },
    {
      name: "JWT Tokens",
      pattern: "eyJ[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*",
      description: "Matches JWT tokens"
    }
  ];

  function openDialog() {
    dialogVisible.value = true;
  }

  function closeDialog() {
    dialogVisible.value = false;
    scrollPosition.value = 0;
  }

  function applyPattern(pattern: PredefinedPattern) {
    grepStore.pattern = pattern.pattern;
    closeDialog();
  }

  function updateScrollPosition(position: number) {
    scrollPosition.value = position;
  }

  return {
    dialogVisible,
    predefinedPatterns,
    scrollPosition,
    openDialog,
    closeDialog,
    applyPattern,
    updateScrollPosition
  };
});
