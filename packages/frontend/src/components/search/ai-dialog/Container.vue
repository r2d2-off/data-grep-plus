<script setup lang="ts">
import { useAIStore } from "@/stores";
import Dialog from "primevue/dialog";
import { computed } from "vue";
import AIDialog from "./AIDialog.vue";
import MissingKey from "./MissingKey.vue";

const aiStore = useAIStore();
const apiKey = computed(() => aiStore.getApiKey());
</script>

<template>
  <Dialog
    v-model:visible="aiStore.dialogVisible"
    modal
    header="Generate script with AI"
    :style="{ width: '500px' }"
    @hide="aiStore.closeDialog"
  >
    <div class="flex flex-col gap-4">
      <MissingKey v-if="!apiKey" />
      <AIDialog v-else />
    </div>
  </Dialog>
</template>
