<script setup>
import { computed } from "vue";

const props = defineProps({
  title:   { type: String,  required: true },
  value:   { type: [String, Number], default: "" },
  subtitle:{ type: String,  default: "" },
  status:  { type: String,  default: "" },
  loading: { type: Boolean, default: false },
  icon:    { type: String,  default: "status" },
});

const statusClass = computed(() => {
  const s = (props.status || "").toLowerCase();
  if (s === "optimal")   return "success";
  if (s === "feasible")  return "warning";
  if (s === "infeasible")return "danger";
  return "";
});
</script>

<template>
  <div class="card info-card" :class="{ loading }" role="status" aria-live="polite">
    <div class="ic-head">
      <div class="ic-left">
        <div class="ic-title">{{ title }}</div>

        <div v-if="subtitle && !loading" class="ic-sub muted">{{ subtitle }}</div>
        <div v-else-if="loading" class="ic-skel skeleton" style="height:10px; width:46%; border-radius:8px;"></div>
      </div>

      <div class="ic-right">
        <div class="ic-iconchip" :data-variant="icon">
          <span v-if="icon==='status'">📊</span>
          <span v-else-if="icon==='time'">⏱️</span>
          <span v-else>📦</span>
        </div>

        <div v-if="statusClass" class="badge" :class="statusClass">
          {{ status?.toUpperCase() }}
        </div>
      </div>
    </div>

    <div class="ic-value" v-if="!loading">{{ value }}</div>
    <div class="ic-skel skeleton" v-else style="height:28px; border-radius:8px;"></div>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;

.info-card {
  padding: 18px;
  display: grid;
  gap: 10px;
}

.ic-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ic-left { display: grid; gap: 6px; }

.ic-title {
  font-weight: 800;
  color: $text;
  letter-spacing: .2px;
}

.ic-sub   { font-size: 13px; }
.ic-skel  { }

.ic-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.ic-iconchip {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: #f2f4ff;
  border: 1px solid $border;
  font-size: 18px;
}
.ic-iconchip[data-variant="time"] { background:#fff6f2; }
.ic-iconchip[data-variant="plan"] { background:#f2fff7; }

.ic-value {
  font-size: 28px;
  font-weight: 800;
  color: $text;
  margin-top: 2px;
}

.badge.success { background: rgba($success, .12); color: $success; }
.badge.warning { background: rgba($warning, .12); color: $warning; }
.badge.danger  { background: rgba($danger,  .12); color: $danger; }
</style>
