import type { RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable without a credential (welcome, joining). Signed-in devices are sent home instead. */
    public?: boolean
    /** One of the bottom navigation's tabs: shows the bottom navigation. */
    tab?: boolean
    /** Owners only (invite, member removal, withdrawal). */
    ownerOnly?: boolean
    /** Hides the app bar (the welcome screen shows the app's name itself). */
    noAppBar?: boolean
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { tab: true },
  },
  {
    path: '/histories',
    name: 'histories',
    component: () => import('../views/HistoriesView.vue'),
    meta: { tab: true },
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('../views/StatsView.vue'),
    meta: { tab: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { tab: true },
  },
  {
    path: '/slots/:slot/prints',
    name: 'prints',
    component: () => import('../views/PrintListView.vue'),
  },
  {
    path: '/prints/new',
    name: 'print-new',
    component: () => import('../views/PrintNewView.vue'),
  },
  // After `/prints/new`, so `new` isn't taken for a print id.
  {
    path: '/prints/:id',
    name: 'print',
    component: () => import('../views/PrintDetailView.vue'),
  },
  {
    path: '/prints/:id/edit',
    name: 'print-edit',
    component: () => import('../views/PrintEditView.vue'),
  },
  {
    path: '/settings/bulk-delete',
    name: 'bulk-delete',
    component: () => import('../views/BulkDeleteView.vue'),
  },
  {
    path: '/settings/children',
    name: 'children',
    component: () => import('../views/ChildrenView.vue'),
  },
  {
    path: '/settings/topics',
    name: 'topics',
    component: () => import('../views/TopicsView.vue'),
  },
  {
    path: '/settings/invite',
    name: 'invite',
    component: () => import('../views/InviteView.vue'),
    meta: { ownerOnly: true },
  },
  {
    path: '/terms',
    name: 'terms',
    component: () => import('../views/TermsView.vue'),
  },
  {
    path: '/welcome',
    name: 'welcome',
    component: () => import('../views/WelcomeView.vue'),
    meta: { public: true, noAppBar: true },
  },
  {
    path: '/join',
    name: 'join',
    component: () => import('../views/JoinView.vue'),
    meta: { public: true },
  },
  {
    path: '/removed',
    name: 'removed',
    component: () => import('../views/RemovedView.vue'),
    meta: { public: true },
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
]
