<script setup>
defineProps({
  label: { type: String, required: true },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});
defineEmits(["click"]); // Biri düğmeye bastığında sinyallemek için tanımlamamız.
</script>

<template>
  <button
    class="btn-primary"
    :disabled="disabled || loading"
    @click="$emit('click')"
  >
    <span v-if="loading">⌛ Loading…</span>
    <span v-else>{{ label }}</span>
  </button>
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.btn-primary { @include gradient-button; font-size: 16px; }
</style>
