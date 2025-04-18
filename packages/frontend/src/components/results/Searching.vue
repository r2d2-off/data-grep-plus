<script setup lang="ts">
import { useSDK } from "@/plugins/sdk";
import { useGrepStore } from "@/stores";
import Button from "primevue/button";
import Card from "primevue/card";
import { ref } from "vue";

const store = useGrepStore();
const sdk = useSDK();
const isStoppingSearch = ref(false);

const stopSearch = async () => {
  isStoppingSearch.value = true;
  try {
    await store.stopGrepSearch();
  } catch (error) {
    console.error("Failed to stop grep:", error);
    sdk.window.showToast("Failed to stop grep: " + error, {
      variant: "error",
    });
  } finally {
    isStoppingSearch.value = false;
  }
};
</script>

<template>
  <Card
    class="h-full"
    :pt="{
      body: { class: 'flex flex-col items-center justify-center h-full' },
    }"
  >
    <template #content>
      <div class="flex flex-col items-center justify-center h-full gap-4">
        <i class="fas fa-spinner fa-spin text-gray-400 text-3xl"></i>

        <div class="flex flex-col items-center gap-4">
          <div class="text-gray-400 text-md shimmer">
            Searching {{ store.progress }}%
          </div>
          <Button
            severity="danger"
            size="small"
            label="Stop"
            icon="fas fa-stop"
            :loading="isStoppingSearch"
            @click="stopSearch"
          />
        </div>
      </div>
    </template>
  </Card>
</template>
