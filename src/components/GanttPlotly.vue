<script setup>
import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick } from "vue";
import Plotly from "plotly.js-dist-min";

const emit = defineEmits(["task-selected"]); // Bir kullanıcı çubuktaki bir göreve tıklarsa sinyalliyoruz.
const props = defineProps({
  items: { type: Array, default: () => [] }, // Çizilecek barları temsil eden listemiz.
  height: { type: Number, default: 620 } // Grafiğin yüksekliği, varsayılan 620.
});

const el = ref(null); // Grafiğin yerleşeceği DOM alanı için referans veriyoruz.
const T0 = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0)); // 0 noktasını veriyoruz.
const minToISO = (min) => new Date(T0.getTime() + min * 60000).toISOString(); // Dakikayı milisaniyeye çevirip T0'a ekliyoruz. (Tarih ekseni için)
const minToHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`; // 95 dk yerine 1:35 yazdırıyoruz.

const GROUPS = ["K","O","B","Y"]; // Makinelerin y ekseninde yerleşim sırası. (Aşağıdan yukarıya verdim.)
const groupOf = (m) => String(m ?? "").trim().toUpperCase()[0] || "~"; // Makinenin ilk harfi gruplama için referanstı, bu ilk harfi alıyoruz.
const rank = (ch) => (GROUPS.includes(ch) ? GROUPS.indexOf(ch) : GROUPS.length + ch.charCodeAt(0)); // Eğer makinem tanımlıysa indeksler, değilse bilinmeyenleri en yukarıya vermek için yüksek indeks veriyoruz.

const lanesAll = computed(() => { // Makineler ekseni için
  const uniq = Array.from(new Set(props.items.map(i => i.resource))); // set ile tekrarlananlardan kurtuluyoruz.
  uniq.sort((a, b) => { // Grup önceliğiyle sıralıyoruz.
    const ra = rank(groupOf(a)), rb = rank(groupOf(b));
    if (ra !== rb) return ra - rb;
    return String(a).localeCompare(String(b), "tr"); // Aynı gruptakileri Türkçeye göre sıralıyoruz.
  });
  return uniq;
});

function colorForJob(jobId){
  const n = typeof jobId === "number" ? jobId : parseInt(String(jobId).replace(/\D/g,"")||"0",10);
  const hue = (n * 137) % 360; // job_id içindeki sayıyı alıp altın açı 137 derece ile dairede dolaşarak HSL renk seçiyoruz.
  return `hsl(${hue} 65% 55%)`;
}
function shortLabel(task, jobId){
  const first = String(task??"").split(/[_\s-]+/)[0]?.[0]?.toLowerCase() || "";
  const jid = typeof jobId === "number" ? String(jobId) : String(jobId??"").replace(/\D/g,"");
  return `${first}${jid}`; // bükme_2 yerine b2 yazdırmak için.
}

function buildMainTrace(){
  const x=[], base=[], y=[], text=[], customdata=[], colors=[];
  for (const it of props.items){
    const durMin = it.finish - it.start;
    x.push(durMin * 60000); // x ekseninde tarih yerine saat:dakika formatında vermek için.
    base.push(minToISO(it.start));
    y.push(it.resource);
    text.push(shortLabel(it.task, it.job_id));
    colors.push(colorForJob(it.job_id));
    customdata.push({ // Barın kartı.
      task: it.task,
      job_id: it.job_id,
      machine: it.resource,
      start_min: it.start,
      finish_min: it.finish,
      start_hhmm: minToHHMM(it.start),
      finish_hhmm: minToHHMM(it.finish),
      dur_min: durMin,
      task_instance_id: it.task_instance_id,
      order_id: it.order_id ?? -1,
      task_base: it.task_base ?? null
    });
  }
  return {
    type: "bar",
    orientation: "h",
    x, base, y, text, customdata,
    textposition: "inside", insidetextanchor: "middle",
    cliponaxis: false,
    hovertemplate:
      "<b>%{customdata.task}</b><br>" +
      "Machine: %{customdata.machine}<br>" +
      "Job: %{customdata.job_id}<br>" +
      "Start: %{customdata.start_hhmm} (%{customdata.start_min} dk)<br>" +
      "End: %{customdata.finish_hhmm} (%{customdata.finish_min} dk)<br>" +
      "Duration: %{customdata.dur_min} dk<extra></extra>",
    marker: { color: colors, line: { width: 1 } }
  };
}
function layoutBase(){
  const cats = lanesAll.value; // Plotly'nin üst araç çubuğu.
  return {
    height: Math.max(props.height, cats.length*30 + 100),
    margin: {l:150, r:20, t:40, b:60},
    barmode: "stack",
    showlegend: false,
    xaxis: { type:"date", title:"Time", tickformat:"%H:%M", dtick: 30*60*1000, gridcolor:"#e6e8ee" },
    yaxis: { type:"category", title:"Machines", categoryorder:"array", categoryarray: cats, automargin:true },
    uirevision: "gantt-static",
    dragmode: "pan"
  };
}

let resizeObserver; // Boyut değişince grafiği güncellemek için tutuyoruz.
async function draw(){
  if(!el.value) return;
  await Plotly.newPlot(el.value, [ buildMainTrace() ], layoutBase(), { responsive:true, displayModeBar:true, scrollZoom:true }); // Grafiği sıfırdan yaratır.
  el.value.on("plotly_click", (evt) => {
    const p = evt?.points?.[0]; if(!p) return; // task seçme mantığı, tıklananı alıyoruz.
    emit("task-selected", { ...(p.customdata||{}), label: p.text, pointIndex: p.pointIndex }); // Ve tıklananı gönderiyoruz.
  });
}
function refreshData(){ if(!el.value) return; Plotly.react(el.value, [ buildMainTrace() ], layoutBase()); } // Var olan grafiği yeniden kullanarak layout'u güncelliyoruz.

onMounted(async () => { // Component DOM'a yerleşince
  await nextTick(); // DOM'un hazır olmasını bekle.
  await draw(); // Grafiği çiz.
  resizeObserver = new ResizeObserver(() => refreshData()); // Kapsayıcı boyut değişirse resizeObserver ile refreshData'yı çağır.
  resizeObserver.observe(el.value);
});
onBeforeUnmount(() => { // Component kaldırılırken
  if (resizeObserver) resizeObserver.disconnect(); // Observer'ı kapat.
  if (el.value) Plotly.purge(el.value); // Grafiği temizle ki bellek sızıntısı olmasın.
});
watch([() => props.items, () => props.height], () => refreshData(), {deep: true}); // items veya height değişirse grafiği yeniden çiz.
</script>

<template>
  <div ref="el"></div>
</template>
