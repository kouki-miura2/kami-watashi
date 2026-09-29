<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ConfirmDialog from './components/ConfirmDialog.vue'
import { useLaunchQuery } from './composables/useLaunchQuery.ts'
import { useConnectivityStore } from './stores/connectivity.ts'
import { useNotificationStore } from './stores/notification.ts'

const route = useRoute()
const router = useRouter()
const connectivity = useConnectivityStore()
const notification = useNotificationStore()

// `/launch` on startup and on every return to the foreground (while signed in). A member who
// hasn't agreed to the current terms is sent to agree again.
const launch = useLaunchQuery()
watch(
  () => launch.data.value?.termsAgreed,
  (agreed) => {
    if (agreed === false) void router.replace({ name: 'terms' })
  },
)

const tabs = [
  { name: 'home', text: 'プリント', icon: 'mdi-file-document-outline' },
  { name: 'histories', text: '履歴', icon: 'mdi-history' },
  { name: 'stats', text: '集計', icon: 'mdi-chart-bar' },
  { name: 'settings', text: '設定', icon: 'mdi-cog-outline' },
]
</script>

<template>
  <v-app>
    <v-main>
      <v-sheet
        v-if="!connectivity.online"
        color="primary"
        rounded="lg"
        class="d-flex align-center ga-2 mx-3 mt-2 px-4 py-3"
      >
        <v-icon icon="mdi-cloud-off-outline" size="20" />
        <span class="text-body-2 font-weight-bold">オフラインです</span>
        <v-spacer />
        <span class="text-caption opacity-70">再接続を待っています…</span>
      </v-sheet>
      <!-- Offline: every operation is disabled, and the (possibly stale) screen is dimmed. -->
      <div
        class="fill-height"
        :class="{ offline: !connectivity.online }"
        :inert="!connectivity.online"
      >
        <router-view />
      </div>
    </v-main>
    <v-bottom-navigation
      v-if="route.meta.tab"
      grow
      :class="{ offline: !connectivity.online }"
      :inert="!connectivity.online"
    >
      <v-btn v-for="tab in tabs" :key="tab.name" :to="{ name: tab.name }" exact>
        <v-icon :icon="tab.icon" />
        <span>{{ tab.text }}</span>
      </v-btn>
    </v-bottom-navigation>
    <ConfirmDialog />
    <v-snackbar v-model="notification.visible">{{ notification.message }}</v-snackbar>
  </v-app>
</template>

<style scoped>
.offline {
  opacity: 0.4;
}
</style>
