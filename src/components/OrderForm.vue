<script setup>
import { reactive, computed, watch } from "vue";

const emits = defineEmits(["submit"]); // Form tamamlandı sinyali

const JOB_TYPE_OPTIONS = [ // label kullanıcıya görünür.
  { label: "cutting", value: "kesme" },
  { label: "carving", value: "oyma" },
  { label: "bending", value: "bükme" },
  { label: "angle in angle out", value: "yanak_açma" },
];

const MACHINES = { // Makine tanımları, bunu veritabanına alarak genel yönetmek en iyi pratik olacaktır. İleriye notumdur. (Geliştirilebilecekler listesi)
  kesme: Array.from({ length: 20 }, (_, i) => `K#${i + 1}`),
  oyma: Array.from({ length: 9 },  (_, i) => `O#${i + 1}`),
  bükme: Array.from({ length: 6 },  (_, i) => `B#${i + 1}`),
  yanak_açma: Array.from({ length: 6 },  (_, i) => `Y#${i + 1}`),
};

const DEFAULT_DEADLINE = 10000;

const form = reactive({
  packageId: "",
  jobId: "",
  jobType: "",
  mode: "single",
  count: "",
  phase: "",
  eligible: [],
});


const intRe = /^\d+$/; // Sadece rakamları algılayan bir regex. Tam sayı kontrolü için.

const errors = reactive({ // Hata mesajları için obje tanımlıyoruz.
  packageId: "",
  jobId: "",
  jobType: "",
  count: "",
  phase: "",
});

const isValid = computed(() => { // Kısıt 1: Package ID tam sayı olmalı.
  if (!form.packageId) errors.packageId = "Required";
  else if (!intRe.test(form.packageId)) errors.packageId = "Please enter an integer only.";
  else errors.packageId = "";

  if (!form.jobId) errors.jobId = "Required"; // Kısıt 2: Job ID tam sayı olmalı.
  else if (!intRe.test(form.jobId)) errors.jobId = "Please enter an integer only.";
  else errors.jobId = "";

  errors.jobType = form.jobType ? "" : "Required"; // Kısıt 3: Job Type seçilmeli.

  if (form.mode === "split") { // Kısıt 4: Eğer split seçilmişse count seçilmeli ve tam sayı olmalı.
    const n = Number(form.count);
    if (!form.count) errors.count = "Required";
    else if (!intRe.test(form.count) || n < 1) errors.count = "Please enter a valid number (≥1).";
    else errors.count = "";
  } else {
    errors.count = "";
  }

  if (!form.phase) errors.phase = "Required"; // Kısıt 5: Order girilmeli ve tam sayı olmalı.
  else if (!intRe.test(form.phase) || Number(form.phase) < 1) errors.phase = "Please enter a valid number (≥1).";
  else errors.phase = "";

  return !errors.packageId && !errors.jobId && !errors.jobType && !errors.count && !errors.phase; // Eğer hiç hata yoksa True döner.
});

const submitting = reactive({ v: false }); // Şartlar sağlanana kadar butonumuza basılamaz.

watch(() => form.jobType, () => { form.eligible = []; }); // İş türü değiştiğinde eligible_machines'i seçilen türe göre güncelliyoruz.

const eligibleOptions = computed(() => {
  if (!form.jobType) return [];
  if (form.jobType === "kesme") return MACHINES.kesme;
  if (form.jobType === "oyma") return MACHINES.oyma;
  if (form.jobType === "bükme") return MACHINES.bükme;
  if (form.jobType === "yanak_açma") return MACHINES.yanak_açma;
  return [];
});

function onSubmit() {
  if (!isValid.value) return;

  submitting.v = true;

  const payload = { // Gönderim için atamalarımızı yapıyoruz.
    package_id: Number(form.packageId),
    job_id: Number(form.jobId),
    job_type: form.jobType,
    mode: form.mode,
    count: form.mode === "split" ? Number(form.count) : null,
    phase: Number(form.phase),
    eligible_machines: Array.isArray(form.eligible) ? form.eligible : [],
    deadline: DEFAULT_DEADLINE,
  };

  emits("submit", payload); // Form verisini sinyalliyoruz.

  setTimeout(() => { // Küçük bir gecikmeyle formu sıfırlıyoruz ve resetliyoruz.
    submitting.v = false;
    form.packageId = "";
    form.jobId = "";
    form.jobType = "";
    form.mode = "single";
    form.count = "";
    form.phase = "";
    form.eligible = [];
  }, 200);
}
</script>

<template>
  <form class="card form" @submit.prevent="onSubmit">
    <div class="form-grid">
      <div class="field">
        <label for="packageId">Package ID</label>
        <input id="packageId" v-model.trim="form.packageId" placeholder="Ex: 1"/>
        <p v-if="errors.packageId" class="err">{{ errors.packageId }}</p>
      </div>

      <div class="field">
        <label for="jobId">Job ID</label>
        <input id="jobId" v-model.trim="form.jobId" placeholder="Örn: 10"/>
        <p v-if="errors.jobId" class="err">{{ errors.jobId }}</p>
      </div>

      <div class="field">
        <label for="jobType">Job Type</label>
        <select id="jobType" v-model="form.jobType">
          <option value="" disabled>Select...</option>
          <option v-for="opt in JOB_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <p v-if="errors.jobType" class="err">{{ errors.jobType }}</p>
      </div>

      <div class="field">
        <label>Mod</label>
        <div class="row">
          <label class="radio">
            <input type="radio" value="single" v-model="form.mode"/>
            <span>Single</span>
          </label>
          <label class="radio">
            <input type="radio" value="split" v-model="form.mode"/>
            <span>Split</span>
          </label>

          <div v-if="form.mode==='split'" class="count-wrap">
            <label for="count" class="count-label">Count</label>
            <input id="count" v-model.trim="form.count" class="count-input" placeholder="Örn: 3"/>
          </div>
        </div>
        <p v-if="errors.count" class="err">{{ errors.count }}</p>
      </div>

      <div class="field">
        <label for="phase">Order</label>
        <input id="phase" v-model.trim="form.phase" placeholder="Örn: 1"/>
        <p v-if="errors.phase" class="err">{{ errors.phase }}</p>
      </div>

      <div class="field field-span2">
        <label for="eligible">Preferred Machines</label>
        <select id="eligible" v-model="form.eligible" multiple size="6">
          <option v-for="m in eligibleOptions" :key="m" :value="m">{{ m }}</option>
        </select>
        <small class="hint">
          The machine list will be updated based on the selected task type. If no selection is made, the solver will assign suitable machines automatically.
        </small>
      </div>
    </div>

    <div class="actions">
      <button class="btn" :disabled="submitting.v || !isValid">
        {{ submitting.v ? "Saving…" : "Save" }}
      </button>
    </div>
  </form>
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.form {
  padding: 22px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 18px;
}

.field {
  display: grid;
  gap: 8px;
}

.field-span2 {
  grid-column: span 2;
}

label {
  font-weight: 700;
}

input, select {
  padding: 12px;
  border: 1px solid $border;
  border-radius: $radius-md;
  outline: none;
  background: #fff;
}

input:focus, select:focus {
  border-color: $primary-1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

select[multiple] {
  min-height: 120px;
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.radio {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid $border;
  padding: 10px 12px;
  border-radius: 10px;
}

.count-wrap {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-label {
  font-weight: 700;
}

.count-input {
  width: 120px;
  padding: 10px 12px;
  border: 1px solid $border;
  border-radius: $radius-md;
}

.hint {
  color: $muted;
  font-size: 12px;
}

.err {
  color: $danger;
  font-size: 12px;
  font-weight: 600;
}

.actions {
  margin-top: 18px;
}

.btn {
  @include gradient-button;
  min-width: 160px;
}

@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .field-span2 {
    grid-column: span 1;
  }
  .count-wrap {
    margin-left: 0;
  }
}
</style>
