<script setup>
import { dbStore } from "../stores/dbStore";

const options = [
  { value: "PG", label: "PostgreSQL" },
  { value: "MONGO", label: "MongoDB" },
];

function onChange(e) {
  dbStore.setDb(e.target.value);
}
</script>

<template>
  <div class="container">
    <h2 style="margin:0 0 14px 0;">Ayarlar</h2>

    <div class="card" style="padding:18px; display:grid; gap:12px;">
      <div class="title">You may select your database:</div>
      <div class="row">
        <select :value="dbStore.db" @change="onChange"
                style="padding:10px; border-radius:10px; border:1px solid #e6e8ee; min-width:220px;">
          <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <span class="muted">Selection: <strong>{{ dbStore.db === 'PG' ? 'PostgreSQL' : 'MongoDB' }}</strong></span>
      </div>

      <div class="hint muted">
        After this selection, the <strong>Run Solver</strong>, <strong>Recent Plans</strong> and
        <strong>Create Order</strong> actions will automatically use the chosen database.
      </div>
    </div>
  </div>
</template>

<style scoped>
.title { font-weight: 800; }
.row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.muted { color:#6b7280; font-size:12px; }
.hint { margin-top:6px; }
</style>
