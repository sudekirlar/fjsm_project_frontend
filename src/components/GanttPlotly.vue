<script setup>
import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick } from "vue";
import Plotly from "plotly.js-dist-min";

const emit = defineEmits(["task-selected"]);
const props = defineProps({
  items: { type: Array, default: () => [] },
  height: { type: Number, default: 620 }
});

const el = ref(null);
const T0 = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0));
const minToISO = (min) => new Date(T0.getTime() + min * 60000).toISOString();
const minToHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const GROUPS = ["K","O","B","Y"];
const groupOf = (m) => String(m ?? "").trim().toUpperCase()[0] || "~";
const rank = (ch) => (GROUPS.includes(ch) ? GROUPS.indexOf(ch) : GROUPS.length + ch.charCodeAt(0));

const lanesAll = computed(() => {
  const uniq = Array.from(new Set(props.items.map(i => i.resource)));
  uniq.sort((a, b) => {
    const ra = rank(groupOf(a)), rb = rank(groupOf(b));
    if (ra !== rb) return ra - rb;
    return String(a).localeCompare(String(b), "tr");
  });
  return uniq;
});

function colorForJob(jobId){
  const n = typeof jobId === "number" ? jobId : parseInt(String(jobId).replace(/\D/g,"")||"0",10);
  const hue = (n * 137) % 360;
  return `hsl(${hue} 65% 55%)`;
}
function shortLabel(task, jobId){
  const first = String(task??"").split(/[_\s-]+/)[0]?.[0]?.toLowerCase() || "";
  const jid = typeof jobId === "number" ? String(jobId) : String(jobId??"").replace(/\D/g,"");
  return `${first}${jid}`;
}

function buildMainTrace(){
  const x=[], base=[], y=[], text=[], customdata=[], colors=[];
  for (const it of props.items){
    const durMin = it.finish - it.start;
    x.push(durMin * 60000);
    base.push(minToISO(it.start));
    y.push(it.resource);
    text.push(shortLabel(it.task, it.job_id));
    colors.push(colorForJob(it.job_id));
    customdata.push({
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
      "Makine: %{customdata.machine}<br>" +
      "Job: %{customdata.job_id}<br>" +
      "Başlangıç: %{customdata.start_hhmm} (%{customdata.start_min} dk)<br>" +
      "Bitiş: %{customdata.finish_hhmm} (%{customdata.finish_min} dk)<br>" +
      "Süre: %{customdata.dur_min} dk<extra></extra>",
    marker: { color: colors, line: { width: 1 } }
  };
}
function layoutBase(){
  const cats = lanesAll.value;
  return {
    height: Math.max(props.height, cats.length*30 + 100),
    margin: {l:150, r:20, t:40, b:60},
    barmode: "stack",
    showlegend: false,
    xaxis: { type:"date", title:"Zaman", tickformat:"%H:%M", dtick: 30*60*1000, gridcolor:"#e6e8ee" },
    yaxis: { type:"category", title:"Makineler", categoryorder:"array", categoryarray: cats, automargin:true },
    uirevision: "gantt-static",
    dragmode: "pan"
  };
}

let resizeObserver;
async function draw(){
  if(!el.value) return;
  await Plotly.newPlot(el.value, [ buildMainTrace() ], layoutBase(), { responsive:true, displayModeBar:true, scrollZoom:true });
  el.value.on("plotly_click", (evt) => {
    const p = evt?.points?.[0]; if(!p) return;
    emit("task-selected", { ...(p.customdata||{}), label: p.text, pointIndex: p.pointIndex });
  });
}
function refreshData(){ if(!el.value) return; Plotly.react(el.value, [ buildMainTrace() ], layoutBase()); }

onMounted(async () => {
  await nextTick();
  await draw();
  resizeObserver = new ResizeObserver(() => refreshData());
  resizeObserver.observe(el.value);
});
onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect();
  if (el.value) Plotly.purge(el.value);
});
watch([() => props.items, () => props.height], () => refreshData(), {deep: true});
</script>

<template>
  <div ref="el"></div>
</template>
