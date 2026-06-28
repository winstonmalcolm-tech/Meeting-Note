import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { getToken } from '../services/api'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',          component: HomeView },
    { path: '/login',     component: () => import('../views/LoginView.vue') },
    { path: '/signup',    component: () => import('../views/SignupView.vue') },
    { path: '/dashboard', component: () => import('../views/DashboardView.vue'), meta: { requiresAuth: true } }
  ],
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  }
})

router.beforeEach((to, _from, next) => {
  if (to.meta.requiresAuth && !getToken()) {
    next({ path: '/login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})

export default router
