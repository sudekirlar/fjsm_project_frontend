import { reactive } from "vue";

export const dbStore = reactive({
  db: (localStorage.getItem("fjsm_db") || "PG").toUpperCase(),
  setDb(v) {
    const val = String(v || "PG").toUpperCase();
    this.db = val === "MONGO" ? "MONGO" : "PG";
    localStorage.setItem("fjsm_db", this.db);
  },
});
