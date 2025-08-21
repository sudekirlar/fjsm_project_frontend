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
    const list = await api.getRecentPlans(); // Son planları çek.
    plans.value = Array.isArray(list) ? list : []; // Listeye koy. Yoksa boş liste yap.
  } catch {
    plans.value = [];
  } finally {
    loading.value = false;
  }
});

async function onChange(id) { // PlanSelect bir ID gönderdiğinde
  selected.value = id; // selected'ı güncelle.
  ganttItems.value = []; // eski Gantt'ı temizle.
  if (!id) return; // Boş seçim ise dur.
  ganttLoading.value = true; // Değilse o planı çekelim.
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
        The last 10 plans are listed. When you select a plan, its Gantt chart will be loaded on the right.
      </div>
    </div>

    <GanttPlaceholder :loading="ganttLoading" emptyText="The Gantt chart for the selected plan will be displayed here." height="680">
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
