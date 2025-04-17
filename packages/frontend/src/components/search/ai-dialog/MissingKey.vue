<script setup lang="ts">
import { useSDK } from "@/plugins/sdk";
import { useAIStore } from "@/stores";
import { copyToClipboard } from "@/utils/clipboard";
import Button from "primevue/button";

const aiStore = useAIStore();
const sdk = useSDK();

const goToEnvironment = () => {
  aiStore.closeDialog();
};
</script>

<template>
  <div>
    <p class="mb-2">You need to set up your OpenAI API key first.</p>
    <p class="mb-2">
      Go to Environment and create
      <code
        class="bg-gray-700 px-1 py-0.5 rounded cursor-pointer"
        @click="copyToClipboard(sdk, 'OPENAI_API_KEY')"
        >OPENAI_API_KEY</code
      >
      variable with your OpenAI API key.
    </p>
    <Button
      label="Go to Environment"
      icon="fas fa-cog"
      class="p-button-secondary mt-2"
      @click="goToEnvironment"
    />
  </div>
</template>
