<script setup>
const props = defineProps({
  emptyText: { type: String, default: "⌛" },
  loading:   { type: Boolean, default: false },
  height:    { type: [Number, String], default: 640 }, // px veya '70vh'
  dense:     { type: Boolean, default: true },
});
</script>

<template>
  <div class="card gantt" :class="{ dense }" :style="{ height: typeof height==='number' ? height + 'px' : height }">
    <div class="gantt-toolbar">
      <slot name="toolbar">
        <div class="toolbar-left"><strong>Gantt</strong></div>
        <div class="toolbar-right">
          <button class="tbtn">Fit</button>
          <button class="tbtn">+</button>
          <button class="tbtn">−</button>
          <button class="tbtn">Export</button>
        </div>
      </slot>
    </div>

    <div class="gantt-canvas">
      <template v-if="loading">
        <div class="skeleton" style="height:100%; width:100%; border-radius:16px"></div>
      </template>

      <template v-else>
        <slot>
          <div class="empty">{{ emptyText }}</div>
        </slot>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;

.gantt { display:grid; grid-template-rows:auto 1fr; padding:12px; }
.gantt.dense{ padding:8px; }
.gantt-toolbar{
  display:flex; align-items:center; justify-content:space-between;
  padding:6px 8px; border:1px solid $border; border-radius:12px; background:#fff;
}
.toolbar-right{ display:inline-flex; gap:6px; }
.tbtn{
  appearance:none; border:1px solid $border; background:#fff;
  border-radius:10px; padding:6px 10px; font-weight:600; cursor:pointer;
}
.tbtn:hover{ box-shadow:0 6px 14px rgba(0,0,0,.06); transform:translateY(-1px); }
.gantt-canvas{
  margin-top:10px; border-radius:24px; background:#fff; padding:8px;
  display:flex; align-items:stretch; justify-content:stretch;
}
.empty{ color:$muted; font-size:22px; font-weight:700; text-align:center; margin:auto; }
</style>
