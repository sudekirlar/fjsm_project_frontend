<script setup>
import {ref, watch} from "vue";

const emits = defineEmits(["change"]); // Change sinyali tanımlıyoruz.
defineProps({
  options: {type: Array, default: () => []},
  loading: {type: Boolean, default: false},
});

const selected = ref("");
watch(selected, (v) => emits("change", v)); // Kullanıcı listeden bir plan seçerse bu değişimi sinyalliyoruz.
</script>

<template>
  <div class="card" style="padding:18px; display:grid; gap:10px;">
    <label style="font-weight:700">Select to View Recent Plans</label>
    <select v-model="selected" :disabled="loading" style="padding:10px; border-radius:10px; border:1px solid #e6e8ee;">
      <option value="" disabled>Select a Plan...</option>
      <option v-for="o in options" :key="o.id" :value="o.id">{{ o.label }}</option>
    </select>
    <div class="muted" v-if="!options.length && !loading">No plans available yet.</div>
    <div class="skeleton" v-if="loading" style="height:12px; width:60%; border-radius:8px;"></div>
  </div>
</template>
