import { createRouter, createWebHistory } from "vue-router";
import Home from "./pages/Home.vue";
import NewOrder from "./pages/NewOrder.vue";
import Plans from "./pages/Plans.vue";
import Settings from "./pages/Settings.vue";

const routes = [
  { path: "/", name: "home", component: Home },
  { path: "/orders/new", name: "new-order", component: NewOrder },
  { path: "/plans", name: "plans", component: Plans },
  { path: "/settings", name: "settings", component: Settings },
];

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});
