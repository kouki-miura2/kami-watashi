import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '../stores/auth.ts'
import { resolveNavigation } from './guard.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => resolveNavigation(to, useAuthStore()))
