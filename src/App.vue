<script setup>
import { RouterLink, RouterView, useRoute } from "vue-router";
import { dbStore } from "./stores/dbStore";

const route = useRoute();
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-oval">
        <div class="brand">Weave</div>

        <nav class="nav">
          <RouterLink to="/" class="nav-link" :class="{ active: route.path==='/' }">
            🖥️ Main Page
          </RouterLink>

          <RouterLink to="/orders/new" class="nav-link" :class="{ active: route.path.startsWith('/orders') }">
            🧾 Create Order
          </RouterLink>

          <RouterLink to="/plans" class="nav-link" :class="{ active: route.path.startsWith('/plans') }">
            📜 Recent Plans
          </RouterLink>

          <RouterLink to="/settings" class="nav-link" :class="{ active: route.path.startsWith('/settings') }">
            ⚙️ Settings
            <span class="chip">{{ dbStore.db }}</span>
          </RouterLink>
        </nav>
      </div>
    </aside>

    <section class="content">
      <div class="topbar">
        <div class="topbar-title">
          {{
            route.name === 'home'
              ? 'Home Page'
              : route.name === 'plans'
                ? 'Recent Plans'
                : route.name === 'new-order'
                  ? 'Create Order'
                  : route.name === 'settings'
                    ? 'Settings'
                    : ''
          }}
        </div>
        <div class="topbar-actions">
          <span class="hello">Welcome!</span>
        </div>
      </div>

      <main class="page">
        <RouterView v-slot="{ Component }">
          <KeepAlive include="HomePage,PlansPage,NewOrderPage">
            <component :is="Component" />
          </KeepAlive>
        </RouterView>
      </main>
    </section>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.sidebar {
  background: #354767;
  border-right: 1px solid #e6e8ee;
  padding: 18px 14px;
}

.sidebar-oval {
  background: #ffffff;
  border: 1px solid #e6e8ee;
  border-radius: 20px;
  padding: 14px;
}

.brand {
  font-weight: 900;
  font-size: 18px;
  margin-bottom: 12px;
}

.nav {
  display: grid;
  gap: 6px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  text-decoration: none;
  color: #111827;
  border: 1px solid transparent;
}

.nav-link:hover {
  background: #f3f4f6;
  border-color: #e6e8ee;
}

.nav-link.active {
  background: #354767;
  border-color: #c7d2fe;
}

.chip {
  margin-left: 8px;
  font-size: 11px;
  background: rgba(53, 71, 103, 0.08);
  border: 1px solid #e6e8ee;
  padding: 2px 6px;
  border-radius: 8px;
}

.content {
  display: grid;
  grid-template-rows: auto 1fr;
}

.topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid #e6e8ee;
  background: #354767;
}

.topbar-title {
  font-weight: 800;
}

.topbar-actions .hello {
  font-size: 12px;
  color: #e6e8ee;
}

.page {
  padding: 18px;
}
</style>
