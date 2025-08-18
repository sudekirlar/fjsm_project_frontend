<script setup>
defineProps({
  title: { type: String, required: true },
  content: { type: String, required: true },
});
</script>

<template>
  <div class="card sidenote">
    <div class="title">{{ title }}</div>
    <div class="text muted" v-html="content" />
  </div>
</template>

<style scoped lang="scss">
.sidenote { padding: 18px; }
.title { font-weight: 800; margin-bottom: 8px; }
.text { line-height: 1.6; }
</style>
