<script setup>
defineOptions({ name: "NewOrderPage" });
import OrderForm from "../components/OrderForm.vue";
import * as api from "../services/api";

async function handleSubmit(dto) {
  try {
    await api.createOrder(dto);
    alert("Veriniz başarıyla sisteme kaydedildi.");
  } catch {
    alert("");
  }
}
</script>

<template>
  <div class="container">
    <h2 style="margin:0 0 14px 0;">İş Emri Gir</h2>
    <OrderForm @submit="handleSubmit"/>
  </div>
</template>
