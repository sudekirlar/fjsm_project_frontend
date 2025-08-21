<script setup>
defineOptions({ name: "HomePage" }); // Component'imiz HomePage olarak tanımlıyoruz.

import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from "vue";
import InfoCard from "../components/InfoCard.vue";
import PrimaryButton from "../components/PrimaryButton.vue";
import GanttPlaceholder from "../components/GanttPlaceholder.vue";
import GanttPlotly from "../components/GanttPlotly.vue";
import * as api from "../services/api";

const DURATION_CONFIG = { // Geliştirilebilecek ikincil yer. Veritabanına taşınmalı!
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

const loading = ref(true); // Sayfa ilk açılış için.
const solverLoading = ref(false); // Çözücü çalışırken butonları kilitlemek için.
const polling = ref(false); // Arka planda durum sorgulama açık mı?
let pollTimer = null; // Ne kadar sürede bir sorguluyoruz?

const runId = ref(""); // Solver'ın kimliği.
const ganttItems = ref([]); // Gantt'ın itemleri.

const metrics = reactive({status: "", makespan: "", plan_state: "", solve_duration_sec: ""}); // KPI kartlar için.


const selectedTask = ref(null); // Gantt'ta seçilen barın bilgisi.
const currentBase = ref(null); // Seçilen görevin türü.
const form = reactive({machine: "", start_hhmm: "", dur_min: null}); // Kullanıcının etkileşeceği form kısmı.
const ui = reactive({msg: "", ok: false, touched: false}); // Kullanıcı tıkladı mı bayrağı.


function minToHHMM(min) { // Dakikayı saat:dakika formatına dönüştürmek için utility'ler.
  const H = Math.floor(min / 60), M = min % 60;
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
}

function hhmmToMin(hhmm) { // Dakikayı saat:dakika formatına dönüştürmek için utility'ler.
  const [h, m] = String(hhmm || "0:0").split(":").map(x => parseInt(x || "0", 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function baseOfTaskName(name) { // Görev adı için, yanak ile başlıyorsa yanak_açma'dır.
  const base = String(name || "").split(/[_\s-]+/)[0].toLowerCase();
  return base.startsWith("yanak") ? "yanak_açma" : base;
}

function typeLetterOf(base) { // Base'i tek harfe çevirir.
  const map = {kesme: "K", oyma: "O", "bükme": "B", "yanak_açma": "Y"};
  return map[base] || (base?.[0] || "").toUpperCase();
}

const MACHINE_COUNTS = {K: 20, O: 9, B: 6, Y: 6};
const selectedTypeLetter = computed(() => typeLetterOf(currentBase.value || baseOfTaskName(selectedTask.value?.task))); // Baş harfi al.
const candidateMachines = computed(() => { // Kesme ise kesme makineleri görünsün diye.
  const letter = (selectedTypeLetter.value || "").toUpperCase();
  const count = MACHINE_COUNTS[letter] || 0;
  return Array.from({length: count}, (_, i) => `${letter}#${i + 1}`);
});

const durationOptions = computed(() => { // Seçilen makinedeki süreyi otomatik veriyorum.
  const base = currentBase.value;
  const machine = form.machine;
  if (!base || !machine) return [];
  const perBase = DURATION_CONFIG?.[base] || {};
  let v = perBase[machine];
  if (Array.isArray(v)) return v;
  if (typeof v === "number") return [v];
  return [];
});

function hasOverlap(machine, startMin, durMin, selfTid) { // Overlap kontrolü.
  const endMin = startMin + durMin;
  return ganttItems.value.some(it => {
    if (it.resource !== machine) return false;
    if (it.task_instance_id === selfTid) return false;
    const s = it.start, e = it.finish;
    return !(endMin <= s || startMin >= e);
  });
}

function baseOrder(order_id_or_base, taskName) { // Fazı ve benim iş kısıtım olan sırayı dikkate al.
  if (typeof order_id_or_base === "number" && order_id_or_base >= 0) return order_id_or_base;
  const base = baseOfTaskName(taskName);
  const omap = {kesme: 1, oyma: 2, "bükme": 3, "yanak_açma": 4};
  return omap[base] ?? 999;
}

function validate() { // Kullanıcının düzenlediği yeri kontrol ediyoruz.
  ui.touched = true;
  ui.ok = false;
  ui.msg = "";
  // Form kurallarını kontrol ediyoruz.
  const t = selectedTask.value;
  if (!t) { // Kısıt 1: Görev seçilmemiş veya form eksikse hata.
    ui.msg = "The target position violates the rules. (No selection made)";
    return;
  }
  if (!form.machine || !form.start_hhmm || !form.dur_min) { // Kısıt 2: Başka bir işle çakışıyorsa hata.
    ui.msg = "The target position violates the rules. (Empty area)";
    return;
  }

  const expected = (selectedTypeLetter.value || "").toUpperCase();
  const chosen = (form.machine[0] || "").toUpperCase();
  if (expected !== chosen) { // Kısıt 3: Makine sınıfı uyumlu olmalı işle.
    ui.msg = "The target position violates the rules. (Incompatible machine type)";
    return;
  }

  const startMin = hhmmToMin(form.start_hhmm);
  const durMin = parseInt(form.dur_min, 10) || 0;
  if (durMin <= 0) {  // Kısıt 4: Süremiz doğru mu verildi?
    ui.msg = "The target position violates the rules. (Invalid duration)";
    return;
  }
  if (hasOverlap(form.machine, startMin, durMin, t.task_instance_id)) { // Kısıt 5: Aynı makinede çakışma var mı?
    ui.msg = "The target position violates the rules. (There is an overlapping)";
    return;
  }

  const myOrder = baseOrder(t.order_id, t.task);
  const myEnd = startMin + durMin;

  const preds = ganttItems.value.filter(x => x.job_id === t.job_id && baseOrder(x.order_id, x.task) < myOrder);
  const maxPredEnd = preds.length ? Math.max(...preds.map(x => x.finish)) : -Infinity;
  if (maxPredEnd > startMin) {  // Kısıt 6: Önceki faz bitmeden başlayamazsın.
    ui.msg = "The target position violates the rules. (Must wait for the previous phase to complete)";
    return;
  }

  const succs = ganttItems.value.filter(x => x.job_id === t.job_id && baseOrder(x.order_id, x.task) > myOrder);
  const minSuccStart = succs.length ? Math.min(...succs.map(x => x.start)) : Infinity;
  if (minSuccStart < myEnd) { // Kısıt 7: Sonraki faz ile de üst üste binemez.
    ui.msg = "The target position violates the rules. (It overlaps with the next phase)";
    return;
  }

  ui.ok = true; // Tüm kontrolleri geçerse yeşil ışığı yakalım.
  ui.msg = "The new position is valid. The solver is running.";
}

async function confirmAndResolve() {
  validate(); // Valid ise lock'umuzu da alalım ve bu şekilde gönderelim solver'a.
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
    startPolling(run_id); // run_id alındıktan sonra bu run_id için polling'e başla, sor bakalım bitmiş mi?
  } catch (e) {
    console.error(e);
    solverLoading.value = false;
  }
}

async function onTaskSelected(p) { // Kullanıcı üzerine bastığında önden bir formu doldur.
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

watch(() => form.machine, () => { // Formu izle ve doğrulamasını yap. Validasyon kullanıcı her bir şey yaptığında çalışsın.
  const opts = durationOptions.value;
  if (!form.machine) form.dur_min = null;
  else if (opts.length === 1) form.dur_min = opts[0];
  else if (!opts.includes(form.dur_min)) form.dur_min = null;
  validate();
});
watch(() => form.start_hhmm, () => validate());
watch(() => form.dur_min, () => validate());

onMounted(async () => { // Açılışta metrikleri sıfırla.
  metrics.status = "";
  metrics.makespan = "";
  metrics.plan_state = "";
  metrics.solve_duration_sec = "";
  loading.value = false;
});
onBeforeUnmount(() => stopPolling()); // Sayfadan çıkarken polling dursun.

async function startSolver() { // Eski grafik temizlensin, yeni run başlasın, polling’e girilsin.
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

function startPolling(rid) { // Durumu sürekli sorgulamak için dürtüyoruz. Maksat KPI'ları güncellemek.
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
      const delay = tick === 6 ? 2000 : 3000; // 6. ve 12. saniyede esneklik için aralığı düşürmek iyi bir pratikmiş
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
      <InfoCard title="Solution Status"
                :value="metrics.status ? metrics.status.toUpperCase() : (polling ? 'RUNNING' : '')"
                :subtitle="metrics.solve_duration_sec ? `Duration: ${metrics.solve_duration_sec}s` : (polling ? 'Solving…' : '')"
                :status="metrics.status" :loading="loading" icon="status"/>
      <InfoCard title="Makespan" :value="metrics.makespan ? `${metrics.makespan} dk` : (polling ? '—' : '')"
                :loading="loading" icon="time"/>
      <InfoCard title="Plan Status" :value="metrics.plan_state || (polling ? 'RUNNING' : '')" :loading="loading"
                icon="plan"/>
    </div>

    <div class="home-grid">
      <GanttPlaceholder height="680" :dense="true">
        <template #toolbar>
          <div class="toolbar-left"><strong>Gantt Chart</strong></div>
          <div class="toolbar-right">
            <PrimaryButton label="Run Solver" :loading="solverLoading" :disabled="solverLoading"
                           @click="startSolver"/>
          </div>
        </template>

        <GanttPlotly v-if="ganttItems.length" :items="ganttItems" :height="660" @task-selected="onTaskSelected"/>
      </GanttPlaceholder>

      <aside class="right-note">
        <div class="card panel">
          <div class="panel-title">Task Edit Panel</div>

          <template v-if="!selectedTask">
            <div class="muted">You may select the task you want to move.</div>
          </template>

          <template v-else>
            <div class="muted mb8">
              Edit Task: <strong>{{ selectedTask.task }}</strong> (Job {{ selectedTask.job_id }})
            </div>

            <div class="field">
              <label>Current Machine</label>
              <div class="readonly">{{ selectedTask.machine }}</div>
            </div>

            <div class="field">
              <label>New Machine</label>
              <select v-model="form.machine" @change="validate" :disabled="solverLoading">
                <option value="" disabled>Select</option>
                <option v-for="m in candidateMachines" :key="m" :value="m">{{ m }}</option>
              </select>
              <small class="muted">You may change the machine.</small>
            </div>

            <div class="field">
              <label>Current Start</label>
              <div class="readonly">
                {{
                  String(Math.floor(selectedTask.start_min / 60)).padStart(2, '0')
                }}:{{ String(selectedTask.start_min % 60).padStart(2, '0') }}
              </div>
            </div>

            <div class="field">
              <label>New Start</label>
              <input type="time" v-model="form.start_hhmm" @input="validate" :disabled="solverLoading"/>
            </div>

            <div class="field">
              <label>Duration</label>
              <select v-model.number="form.dur_min" @change="validate" :disabled="solverLoading">
                <option value="" disabled>Select</option>
                <option v-for="d in durationOptions" :key="d" :value="d">{{ d }}</option>
              </select>
              <small class="muted">Durations are determined based on the automatically selected machine.</small>
            </div>

            <div class="msg" :class="ui.ok ? 'ok' : 'err'">{{ ui.touched ? ui.msg : '' }}</div>

            <div class="actions">
              <button class="tbtn" @click="confirmAndResolve" :disabled="!ui.ok || solverLoading">
                Confirm Changes and Re-Solve
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
