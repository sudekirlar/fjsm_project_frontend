<script setup>
import {ref, watch} from "vue";

const emits = defineEmits(["change"]);
defineProps({
  options: {type: Array, default: () => []},
  loading: {type: Boolean, default: false},
});

const selected = ref("");
watch(selected, (v) => emits("change", v));
</script>

<template>
  <div class="card" style="padding:18px; display:grid; gap:10px;">
    <label style="font-weight:700">Son Planları Görüntülemek için seçin:</label>
    <select v-model="selected" :disabled="loading" style="padding:10px; border-radius:10px; border:1px solid #e6e8ee;">
      <option value="" disabled>Plan seçin…</option>
      <option v-for="o in options" :key="o.id" :value="o.id">{{ o.label }}</option>
    </select>
    <div class="muted" v-if="!options.length && !loading">Henüz plan yok.</div>
    <div class="skeleton" v-if="loading" style="height:12px; width:60%; border-radius:8px;"></div>
  </div>
</template>
