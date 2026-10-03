<script setup lang="ts">
import { computed } from 'vue'

import SubPageBar from '../components/SubPageBar.vue'
import { useBack } from '../composables/useBack.ts'
import { type LegalDocumentKind, legalDocuments } from '../legal/documents.ts'
import { formatDateString } from '../lib/print-format.ts'

// The terms of use and privacy policy, readable signed in or out: in a new tab from the agreement
// step (registering, joining, a revision — leaving it would lose the step), in the app from settings.
const props = defineProps<{ kind: LegalDocumentKind }>()

const back = useBack({ name: 'settings' })
const doc = computed(() => legalDocuments[props.kind])
</script>

<template>
  <SubPageBar :title="doc.title" icon="back" @navigate="back" />
  <div class="legal px-4 pt-2 pb-8 text-body-2">
    <p class="text-caption text-medium-emphasis">{{ formatDateString(doc.revisedOn) }} 制定</p>
    <p>{{ doc.intro }}</p>
    <section v-for="section in doc.sections" :key="section.heading">
      <h2 class="legal__heading">{{ section.heading }}</h2>
      <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
      <ul v-if="section.items" class="legal__items">
        <li v-for="item in section.items" :key="item">{{ item }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.legal,
.legal section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  line-height: 1.8;
}

.legal p,
.legal__items {
  margin: 0;
}

.legal__heading {
  margin-top: 8px;
  font-size: 0.9375rem;
  font-weight: 700;
}

.legal__items {
  padding-left: 1.4em;
}
</style>
