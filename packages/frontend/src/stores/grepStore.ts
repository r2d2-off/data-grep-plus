import { useSDK } from "@/plugins/sdk";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const useGrepStore = defineStore("grep", () => {
  const sdk = useSDK();

  const pattern = ref("");
  const includeRequests = ref(true);
  const includeResponses = ref(true);
  const maxResults = ref<number | null>(null);
  const isSearching = ref(false);
  const matchGroup = ref<number | null>(null);
  const onlyInScope = ref(true);
  const progress = ref(0);

  const searchResults = ref<string[] | null>(null);

  const searchGrepRequests = async () => {
    if (!pattern.value.trim()) {
      sdk.window.showToast("Please enter a search pattern", {
        variant: "error",
      });
      return;
    }

    searchResults.value = null;
    isSearching.value = true;
    progress.value = 0;

    try {
      const { error, data } = await sdk.backend.grepRequests(pattern.value, {
        includeRequests: includeRequests.value,
        includeResponses: includeResponses.value,
        maxResults: maxResults.value ?? null,
        matchGroup: matchGroup.value ?? null,
        onlyInScope: onlyInScope.value,
      });

      if (error) {
        if (error === "Grep operation was stopped") {
          return;
        }

        sdk.window.showToast(error, {
          variant: "error",
        });
        return;
      }

      if (!data) {
        sdk.window.showToast("No results found", {
          variant: "info",
        });
        return;
      }

      searchResults.value = data;

      if (data.length === 0) {
        sdk.window.showToast("No matches found for the pattern", {
          variant: "info",
        });
      } else {
        sdk.window.showToast(`Found ${data.length} matching results`, {
          variant: "success",
        });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sdk.window.showToast("Failed to search requests: " + errorMessage, {
        variant: "error",
      });
    } finally {
      isSearching.value = false;
    }
  };

  const stopGrepSearch = async () => {
    try {
      await sdk.backend.stopGrep();
      sdk.window.showToast("Search stopped successfully", {
        variant: "info",
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sdk.window.showToast("Failed to stop search: " + errorMessage, {
        variant: "error",
      });
    } finally {
      isSearching.value = false;
    }
  };

  const matchesText = computed((): string => {
    if (!searchResults.value) return "";

    const matches = searchResults.value.map((match) => match);

    return matches.join("\n");
  });

  const uniqueMatchesCount = computed((): number => {
    if (!searchResults.value) return 0;
    return searchResults.value.length;
  });

  sdk.backend.onEvent("caidogrep:progress", (value: number) => {
    progress.value = value;
  });

  sdk.backend.onEvent("caidogrep:matches", (matches: Set<string>) => {
    searchResults.value = [
      ...(searchResults.value || []),
      ...Array.from(matches),
    ];
  });

  return {
    pattern,
    includeRequests,
    includeResponses,
    maxResults,
    isSearching,
    matchGroup,
    onlyInScope,
    searchResults,
    matchesText,
    uniqueMatchesCount,
    searchGrepRequests,
    stopGrepSearch,
    progress,
  };
});
