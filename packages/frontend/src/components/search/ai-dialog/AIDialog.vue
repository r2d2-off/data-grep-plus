<script setup lang="ts">
import { useAIStore } from "@/stores";
import Button from "primevue/button";
import Textarea from "primevue/textarea";

const aiStore = useAIStore();
</script>

<template>
  <Textarea
    v-model="aiStore.prompt"
    autoResize
    :rows="10"
    placeholder="Prompt"
    class="w-full"
    :style="{
      fontSize: '14px',
      background: 'var(--c-gray-800)',
    }"
  />
  <div class="flex justify-end">
    <Button
      label="Ask AI"
      icon="fas fa-robot"
      class="p-button-primary"
      :loading="aiStore.isProcessing"
      @click="aiStore.processAIPrompt"
    />
  </div>
</template>
