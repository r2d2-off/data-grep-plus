import { defineStore } from "pinia";
import { ref } from "vue";

export const useGuideStore = defineStore("guide", () => {
  const dialogVisible = ref(false);

  function openDialog() {
    dialogVisible.value = true;
  }

  function closeDialog() {
    dialogVisible.value = false;
  }

  return {
    dialogVisible,
    openDialog,
    closeDialog,
  };
});
