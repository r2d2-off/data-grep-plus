<script setup lang="ts">
import { usePatternsStore } from "@/stores";
import Button from "primevue/button";
import ProgressSpinner from "primevue/progressspinner";
import ConfirmDialog from "primevue/confirmdialog";
import { useConfirm } from "primevue/useconfirm";
import CustomRegexDialog from "./CustomRegexDialog.vue";

const patternsStore = usePatternsStore();
const confirm = useConfirm();

function handleDeleteCustomPattern(id: string, name: string) {
  confirm.require({
    message: `Are you sure you want to delete the custom pattern "${name}"?`,
    header: "Delete Custom Pattern",
    icon: "fas fa-exclamation-triangle",
    rejectClass: "p-button-text p-button-text",
    acceptClass: "p-button-danger",
    accept: () => {
      patternsStore.deleteCustomPattern(id);
    },
  });
}

function getCustomPatternById(name: string) {
  return patternsStore.customPatterns.find((p) => p.name === name);
}

function isCustomPattern(name: string) {
  return patternsStore.customPatterns.some((p) => p.name === name);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex justify-between items-center">
      <p class="text-gray-300">Select a pattern to use in your search:</p>
      <Button
        label="Create Custom"
        icon="fas fa-plus"
        class="p-button-sm p-button-outlined"
        @click="patternsStore.openCustomRegexDialog()"
      />
    </div>

    <div v-if="patternsStore.isLoading" class="flex justify-center py-8">
      <ProgressSpinner style="width: 50px; height: 50px" />
    </div>

    <div v-else class="grid grid-cols-1 gap-4">
      <div
        v-for="pattern in patternsStore.allPatterns"
        :key="pattern.name"
        class="p-4 border rounded-lg hover:bg-zinc-900/50 transition-colors"
        :class="
          isCustomPattern(pattern.name)
            ? 'border-blue-700/50 bg-blue-900/10'
            : 'border-gray-700'
        "
      >
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="text-lg font-medium">{{ pattern.name }}</h3>
              <span
                v-if="isCustomPattern(pattern.name)"
                class="text-xs bg-blue-600 text-white px-2 py-1 rounded"
              >
                Custom
              </span>
            </div>
            <p class="text-sm text-gray-400">{{ pattern.description }}</p>
            <code
              class="mt-2 block text-xs text-gray-300 bg-gray-600 p-2 rounded w-fit"
            >
              {{ pattern.pattern }}
            </code>
            <div
              v-if="pattern.matchGroups && pattern.matchGroups.length > 0"
              class="mt-2"
            >
              <span class="text-xs text-gray-400">Match Groups: </span>
              <span class="text-xs text-blue-400">{{
                pattern.matchGroups.join(", ")
              }}</span>
            </div>
          </div>
          <div class="flex gap-2">
            <Button
              v-if="isCustomPattern(pattern.name)"
              icon="fas fa-edit"
              class="p-button-sm p-button-outlined p-button-secondary"
              @click="
                patternsStore.openCustomRegexDialog(
                  getCustomPatternById(pattern.name)
                )
              "
              tooltip="Edit this pattern"
            />
            <Button
              v-if="isCustomPattern(pattern.name)"
              icon="fas fa-trash"
              class="p-button-sm p-button-outlined p-button-danger"
              @click="
                handleDeleteCustomPattern(
                  getCustomPatternById(pattern.name)?.id || '',
                  pattern.name
                )
              "
              tooltip="Delete this pattern"
            />
            <Button
              icon="fas fa-check"
              class="p-button-sm p-button-outlined"
              @click="patternsStore.applyPattern(pattern)"
              tooltip="Apply this pattern"
            />
          </div>
        </div>
      </div>
    </div>

    <CustomRegexDialog />
    <ConfirmDialog />
  </div>
</template>
