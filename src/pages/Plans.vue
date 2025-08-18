<script setup>
defineOptions({ name: "PlansPage" });

import { ref, onMounted } from "vue";
import PlanSelect from "../components/PlanSelect.vue";
import GanttPlaceholder from "../components/GanttPlaceholder.vue";
import GanttPlotly from "../components/GanttPlotly.vue";
import * as api from "../services/api";

const loading = ref(true);
const plans = ref([]);
const selected = ref("");
const ganttLoading = ref(false);
const ganttItems = ref([]);

onMounted(async () => {
  try {
    const list = await api.getRecentPlans();
    plans.value = Array.isArray(list) ? list : [];
  } catch {
    plans.value = [];
  } finally {
    loading.value = false;
  }
});

async function onChange(id) {
  selected.value = id;
  ganttItems.value = [];
  if (!id) return;
  ganttLoading.value = true;
  try {
    const data = await api.getPlanGantt(id);
    ganttItems.value = Array.isArray(data) ? data : [];
  } finally {
    ganttLoading.value = false;
  }
}
</script>

<template>
  <div style="display:grid; grid-template-columns: 360px 1fr; gap: 20px;">
    <div>
      <PlanSelect :options="plans" :loading="loading" @change="onChange" />
      <div class="muted" style="margin-top:8px; font-size:12px;">
        Son 10 plan listelenir. Bir plan seçtiğinde Gantt grafiği sağda yüklenir.
      </div>
    </div>

    <GanttPlaceholder :loading="ganttLoading" emptyText="Seçilen plana ait Gantt burada görünecek." height="680">
      <template #toolbar>
        <div class="toolbar-left">
          <strong>Plan Gantt</strong>
          <span v-if="selected" class="muted" style="margin-left:8px; font-weight:600;">
            {{ plans.find(p => p.id === selected)?.label || '' }}
          </span>
        </div>
        <div class="toolbar-right"></div>
      </template>

      <GanttPlotly v-if="ganttItems.length" :items="ganttItems" :height="660" />
    </GanttPlaceholder>
  </div>
</template>

<style scoped>
.muted { color: #6b7280; }
</style>
