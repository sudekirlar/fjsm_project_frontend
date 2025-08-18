<script setup>
defineOptions({ name: "HomePage" });

import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from "vue";
import InfoCard from "../components/InfoCard.vue";
import PrimaryButton from "../components/PrimaryButton.vue";
import GanttPlaceholder from "../components/GanttPlaceholder.vue";
import GanttPlotly from "../components/GanttPlotly.vue";
import * as api from "../services/api";

const DURATION_CONFIG = {
  "kesme": {
    "K#1": 35, "K#2": 35, "K#3": 35, "K#4": 35, "K#5": 35,
    "K#6": 35, "K#7": 35, "K#8": 35, "K#9": 35, "K#10": 35,
    "K#11": 35, "K#12": 35, "K#13": 35, "K#14": 35, "K#15": 35,
    "K#16": 35, "K#17": 35, "K#18": 35, "K#19": 35, "K#20": 35
  },
  "oyma": {
    "O#1": 10, "O#2": 20, "O#3": 4, "O#4": 5, "O#5": 3,
    "O#6": 20, "O#7": 10, "O#8": 5, "O#9": 10
  },
  "bükme": {
    "B#1": 10, "B#2": 20, "B#3": 6, "B#4": 5, "B#5": 3, "B#6": 20
  },
  "yanak_açma": {
    "Y#1": 10, "Y#2": 20, "Y#3": 8, "Y#4": 5, "Y#5": 3, "Y#6": 20
  }
};

const loading = ref(true);
const solverLoading = ref(false);
const polling = ref(false);
let pollTimer = null;

const runId = ref("");
const ganttItems = ref([]);

const metrics = reactive({status: "", makespan: "", plan_state: "", solve_duration_sec: ""});


const selectedTask = ref(null);
const currentBase = ref(null);
const form = reactive({machine: "", start_hhmm: "", dur_min: null});
const ui = reactive({msg: "", ok: false, touched: false});


function minToHHMM(min) {
  const H = Math.floor(min / 60), M = min % 60;
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
}

function hhmmToMin(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(x => parseInt(x || "0", 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function baseOfTaskName(name) {
  const base = String(name || "").split(/[_\s-]+/)[0].toLowerCase();
  return base.startsWith("yanak") ? "yanak_açma" : base;
}

function typeLetterOf(base) {
  const map = {kesme: "K", oyma: "O", "bükme": "B", "yanak_açma": "Y"};
  return map[base] || (base?.[0] || "").toUpperCase();
}

const MACHINE_COUNTS = {K: 20, O: 9, B: 6, Y: 6};
const selectedTypeLetter = computed(() => typeLetterOf(currentBase.value || baseOfTaskName(selectedTask.value?.task)));
const candidateMachines = computed(() => {
  const letter = (selectedTypeLetter.value || "").toUpperCase();
  const count = MACHINE_COUNTS[letter] || 0;
  return Array.from({length: count}, (_, i) => `${letter}#${i + 1}`);
});

const durationOptions = computed(() => {
  const base = currentBase.value;
  const machine = form.machine;
  if (!base || !machine) return [];
  const perBase = DURATION_CONFIG?.[base] || {};
  let v = perBase[machine];
  if (Array.isArray(v)) return v;
  if (typeof v === "number") return [v];
  return [];
});

function hasOverlap(machine, startMin, durMin, selfTid) {
  const endMin = startMin + durMin;
  return ganttItems.value.some(it => {
    if (it.resource !== machine) return false;
    if (it.task_instance_id === selfTid) return false;
    const s = it.start, e = it.finish;
    return !(endMin <= s || startMin >= e);
  });
}

function baseOrder(order_id_or_base, taskName) {
  if (typeof order_id_or_base === "number" && order_id_or_base >= 0) return order_id_or_base;
  const base = baseOfTaskName(taskName);
  const omap = {kesme: 1, oyma: 2, "bükme": 3, "yanak_açma": 4};
  return omap[base] ?? 999;
}

function validate() {
  ui.touched = true;
  ui.ok = false;
  ui.msg = "";

  const t = selectedTask.value;
  if (!t) {
    ui.msg = "Taşıdığınız yer kurala uygun değildir. (Seçim yok)";
    return;
  }
  if (!form.machine || !form.start_hhmm || !form.dur_min) {
    ui.msg = "Taşıdığınız yer kurala uygun değildir. (Boş alan)";
    return;
  }

  const expected = (selectedTypeLetter.value || "").toUpperCase();
  const chosen = (form.machine[0] || "").toUpperCase();
  if (expected !== chosen) {
    ui.msg = "Taşıdığınız yer kurala uygun değildir. (Makine tipi uyumsuz)";
    return;
  }

  const startMin = hhmmToMin(form.start_hhmm);
  const durMin = parseInt(form.dur_min, 10) || 0;
  if (durMin <= 0) {
    ui.msg = "Taşıdığınız yer kurala uygun değildir. (Geçersiz süre)";
    return;
  }
  if (hasOverlap(form.machine, startMin, durMin, t.task_instance_id)) {
    ui.msg = "Taşıdığınız yer kurala uygun değildir. (Çakışma var)";
    return;
  }

  const myOrder = baseOrder(t.order_id, t.task);
  const myEnd = startMin + durMin;

  const preds = ganttItems.value.filter(x => x.job_id === t.job_id && baseOrder(x.order_id, x.task) < myOrder);
  const maxPredEnd = preds.length ? Math.max(...preds.map(x => x.finish)) : -Infinity;
  if (maxPredEnd > startMin) {
    ui.msg = "Taşıdığınız yer kurala uygun değildir. (Önceki faz bitişini beklemeli)";
    return;
  }

  const succs = ganttItems.value.filter(x => x.job_id === t.job_id && baseOrder(x.order_id, x.task) > myOrder);
  const minSuccStart = succs.length ? Math.min(...succs.map(x => x.start)) : Infinity;
  if (minSuccStart < myEnd) {
    ui.msg = "Taşıdığınız yer kurala uygun değildir. (Sonraki faza taşma var)";
    return;
  }

  ui.ok = true;
  ui.msg = "Taşıdığınız yer uyumlu, solver çalışıyor.";
}

async function confirmAndResolve() {
  validate();
  if (!ui.ok) return;
  const lock = {
    task_instance_id: selectedTask.value.task_instance_id,
    machine: form.machine,
    start_min: hhmmToMin(form.start_hhmm),
  };
  solverLoading.value = true;
  try {
    const {run_id} = await api.startSolverWithLocks([lock]);
    runId.value = run_id;
    startPolling(run_id);
  } catch (e) {
    console.error(e);
    solverLoading.value = false;
  }
}

async function onTaskSelected(p) {
  selectedTask.value = p;
  currentBase.value = p.task_base || baseOfTaskName(p.task);

  form.machine = p.machine;
  form.start_hhmm = minToHHMM(p.start_min);
  form.dur_min = null;

  ui.msg = "";
  ui.ok = false;
  ui.touched = false;

  const opts = durationOptions.value;
  if (opts.length === 1) form.dur_min = opts[0];
}

watch(() => form.machine, () => {
  const opts = durationOptions.value;
  if (!form.machine) form.dur_min = null;
  else if (opts.length === 1) form.dur_min = opts[0];
  else if (!opts.includes(form.dur_min)) form.dur_min = null;
  validate();
});
watch(() => form.start_hhmm, () => validate());
watch(() => form.dur_min, () => validate());

onMounted(async () => {
  metrics.status = "";
  metrics.makespan = "";
  metrics.plan_state = "";
  metrics.solve_duration_sec = "";
  loading.value = false;
});
onBeforeUnmount(() => stopPolling());

async function startSolver() {
  solverLoading.value = true;
  ganttItems.value = [];
  runId.value = "";
  try {
    const {run_id} = await api.startSolver();
    runId.value = run_id;
    startPolling(run_id);
  } catch (e) {
    console.error("startSolver failed:", e);
    solverLoading.value = false;
  }
}

function startPolling(rid) {
  stopPolling();
  polling.value = true;
  let tick = 0;
  pollTimer = setInterval(async () => {
    tick++;
    const status = await api.getSolverStatus(rid);
    if (!status) return;
    metrics.plan_state = status.state || "";
    metrics.makespan = status.makespan ?? metrics.makespan;
    metrics.status = (status.status || "").toLowerCase();

    if (status.created_at && status.completed_at) {
      try {
        const t = (new Date(status.completed_at) - new Date(status.created_at)) / 1000;
        metrics.solve_duration_sec = Math.max(0, Math.round(t)).toString();
      } catch {
      }
    }

    if (status.state === "COMPLETED") {
      stopPolling();
      await loadGantt(rid);
      solverLoading.value = false;
    } else if (status.state === "FAILED") {
      stopPolling();
      solverLoading.value = false;
    } else if (tick === 6 || tick === 12) {
      stopPolling();
      const delay = tick === 6 ? 2000 : 3000;
      pollTimer = setInterval(async () => {
        const st = await api.getSolverStatus(rid);
        if (!st) return;
        metrics.plan_state = st.state || "";
        metrics.makespan = st.makespan ?? metrics.makespan;
        metrics.status = (st.status || "").toLowerCase();
        if (st.state === "COMPLETED") {
          stopPolling();
          await loadGantt(rid);
          solverLoading.value = false;
        } else if (st.state === "FAILED") {
          stopPolling();
          solverLoading.value = false;
        }
      }, delay);
    }
  }, 1000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  polling.value = false;
}

async function loadGantt(rid) {
  try {
    const data = await api.getPlanGantt(rid);
    ganttItems.value = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("getPlanGantt failed:", e);
    ganttItems.value = [];
  }
}
</script>

<template>
  <div class="home">
    <div class="kpi-grid kpi-compact">
      <InfoCard title="Çözüm Durumu"
                :value="metrics.status ? metrics.status.toUpperCase() : (polling ? 'RUNNING' : '')"
                :subtitle="metrics.solve_duration_sec ? `Süre: ${metrics.solve_duration_sec}s` : (polling ? 'Çözülüyor…' : '')"
                :status="metrics.status" :loading="loading" icon="status"/>
      <InfoCard title="Makespan" :value="metrics.makespan ? `${metrics.makespan} dk` : (polling ? '—' : '')"
                :loading="loading" icon="time"/>
      <InfoCard title="Plan Durumu" :value="metrics.plan_state || (polling ? 'RUNNING' : '')" :loading="loading"
                icon="plan"/>
    </div>

    <div class="home-grid">
      <GanttPlaceholder height="680" :dense="true">
        <template #toolbar>
          <div class="toolbar-left"><strong>Gantt Chart</strong></div>
          <div class="toolbar-right">
            <PrimaryButton label="Solver'ı Başlat" :loading="solverLoading" :disabled="solverLoading"
                           @click="startSolver"/>
          </div>
        </template>

        <GanttPlotly v-if="ganttItems.length" :items="ganttItems" :height="660" @task-selected="onTaskSelected"/>
      </GanttPlaceholder>

      <aside class="right-note">
        <div class="card panel">
          <div class="panel-title">Düzenleme Paneli</div>

          <template v-if="!selectedTask">
            <div class="muted">Yer değiştirmek istediğiniz işi seçebilirsiniz.</div>
          </template>

          <template v-else>
            <div class="muted mb8">
              Görevi Düzenle: <strong>{{ selectedTask.task }}</strong> (Job {{ selectedTask.job_id }})
            </div>

            <div class="field">
              <label>Mevcut Makine</label>
              <div class="readonly">{{ selectedTask.machine }}</div>
            </div>

            <div class="field">
              <label>Yeni Makine</label>
              <select v-model="form.machine" @change="validate" :disabled="solverLoading">
                <option value="" disabled>Seçiniz</option>
                <option v-for="m in candidateMachines" :key="m" :value="m">{{ m }}</option>
              </select>
              <small class="muted">Makine değişimi yapabilirsiniz.</small>
            </div>

            <div class="field">
              <label>Mevcut Başlangıç</label>
              <div class="readonly">
                {{
                  String(Math.floor(selectedTask.start_min / 60)).padStart(2, '0')
                }}:{{ String(selectedTask.start_min % 60).padStart(2, '0') }}
              </div>
            </div>

            <div class="field">
              <label>Yeni Başlangıç</label>
              <input type="time" v-model="form.start_hhmm" @input="validate" :disabled="solverLoading"/>
            </div>

            <div class="field">
              <label>Duration (dk)</label>
              <select v-model.number="form.dur_min" @change="validate" :disabled="solverLoading">
                <option value="" disabled>Seçiniz</option>
                <option v-for="d in durationOptions" :key="d" :value="d">{{ d }}</option>
              </select>
              <small class="muted">Süreler, otomatik seçtiğiniz makineye göre gelmektedir.</small>
            </div>

            <div class="msg" :class="ui.ok ? 'ok' : 'err'">{{ ui.touched ? ui.msg : '' }}</div>

            <div class="actions">
              <button class="tbtn" @click="confirmAndResolve" :disabled="!ui.ok || solverLoading">
                Değişiklikleri Onayla ve Yeniden Çöz
              </button>
            </div>
          </template>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.kpi-compact :deep(.info-card) {
  padding: 16px !important;
}

.kpi-compact :deep(.ic-value) {
  font-size: 26px !important;
}

.home-grid {
  display: grid;
  grid-template-columns:1fr 320px;
  gap: 18px;
  margin-top: 16px;
}

@media (max-width: 1200px) {
  .home-grid {
    grid-template-columns:1fr;
  }
}

.panel {
  padding: 14px;
  border-radius: 28px;
}

.panel-title {
  font-weight: 800;
  margin-bottom: 6px;
}

.muted {
  font-size: 12px;
  line-height: 1.5;
  color: #666;
}

.mb8 {
  margin-bottom: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.field label {
  font-size: 12px;
  font-weight: 700;
  color: #333;
}

.field .readonly {
  background: #f7f8fb;
  border: 1px solid #e6e8ee;
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
}

select, input[type="time"] {
  appearance: none;
  border: 1px solid #e6e8ee;
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
}

.tbtn {
  appearance: none;
  border: 1px solid #e6e8ee;
  background: #fff;
  border-radius: 10px;
  padding: 6px 10px;
  font-weight: 600;
  cursor: pointer;
}

.tbtn:disabled {
  opacity: .5;
  cursor: default;
}

.actions {
  display: flex;
  gap: 8px;
}

.msg {
  margin: 8px 0;
  font-size: 12px;
}

.msg.ok {
  color: #0a7c2f;
}

.msg.err {
  color: #b00020;
}
</style>
