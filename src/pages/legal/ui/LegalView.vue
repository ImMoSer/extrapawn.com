<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NTabs, NTabPane, NH1, NH2, NP, NText, NDivider, NAlert } from 'naive-ui'

const { t, te, tm, locale } = useI18n()
const route = useRoute()
const router = useRouter()

const activeTab = ref('imprint')

// Mapping of hash to tab name
const tabMap: Record<string, string> = {
  '#imprint': 'imprint',
  '#privacy': 'privacy',
  '#terms': 'terms',
}

const syncTabWithHash = () => {
  const hash = window.location.hash
  if (hash && tabMap[hash]) {
    activeTab.value = tabMap[hash]
  }
}

onMounted(() => {
  syncTabWithHash()
})

// Update hash when tab changes
watch(activeTab, (newTab) => {
  const hash = Object.keys(tabMap).find((key) => tabMap[key] === newTab)
  if (hash && window.location.hash !== hash) {
    router.replace({ hash })
  }
})

// Also listen for external hash changes (e.g. back button)
watch(
  () => route.hash,
  () => {
    syncTabWithHash()
  },
)

const formatAddress = (text: string) => {
  return text.split('\n')
}

// Order definitions for content sections
const orderedPrivacyKeys = [
  'intro',
  'logfiles',
  'hosting',
  'lichess',
  'payment',
  'storage',
  'fonts',
  'rights',
]

const orderedTermsKeys = [
  'intro',
  'subject',
  'contract',
  'termination',
  'data',
  'liability',
  'changes',
  'law',
  'final',
]

const showPrecedenceNotice = computed(() => {
  return locale.value !== 'de' && te('legal.precedence')
})
</script>

<template>
  <div class="legal-page-container">
    <n-card class="legal-card" :bordered="false">
      <n-h1 align-text class="legal-title">{{ t('legal.title') }}</n-h1>

      <!-- Language Precedence Notice -->
      <n-alert v-if="showPrecedenceNotice" type="info" class="precedence-alert" :bordered="false">
        {{ t('legal.precedence') }}
      </n-alert>

      <n-tabs
        v-model:value="activeTab"
        type="line"
        animated
        justify-content="space-evenly"
        class="legal-tabs"
      >
        <!-- IMPRESSUM -->
        <n-tab-pane name="imprint" :tab="t('legal.tabs.imprint')">
          <div class="legal-content">
            <n-h2>{{ t('legal.imprint.title') }}</n-h2>
            <n-text depth="3">{{ t('legal.imprint.subtitle') }}</n-text>

            <n-p class="address-block">
              <strong>{{ t('legal.imprint.name') }}</strong
              ><br />
              <template
                v-for="(line, index) in formatAddress(t('legal.imprint.address'))"
                :key="index"
              >
                {{ line }}<br v-if="index < formatAddress(t('legal.imprint.address')).length - 1" />
              </template>
            </n-p>

            <n-h2>{{ t('legal.imprint.contact') }}</n-h2>
            <n-p>
              {{ t('legal.imprint.email') }}<br />
              {{ t('legal.imprint.phone') }}
            </n-p>

            <n-p
              ><strong>{{ t('legal.imprint.vatId') }}</strong></n-p
            >

            <n-divider />

            <n-h2>{{ t('legal.imprint.dispute') }}</n-h2>
            <n-p>
              {{ t('legal.imprint.disputeText') }}
              <a
                :href="t('legal.imprint.disputeLink')"
                target="_blank"
                rel="noopener noreferrer"
                class="legal-link"
              >
                {{ t('legal.imprint.disputeLink') }}
              </a>
            </n-p>
            <n-p>{{ t('legal.imprint.disputeRefusal') }}</n-p>

            <n-divider />

            <n-h2>{{ t('legal.imprint.legalNotice') }}</n-h2>
            <n-p
              ><strong>{{ t('legal.imprint.liabilityTitle') }}</strong></n-p
            >
            <n-p>{{ t('legal.imprint.liabilityContent') }}</n-p>

            <n-p
              ><strong>{{ t('legal.imprint.copyrightTitle') }}</strong></n-p
            >
            <n-p>{{ t('legal.imprint.copyrightContent') }}</n-p>
          </div>
        </n-tab-pane>

        <!-- PRIVACY -->
        <n-tab-pane name="privacy" :tab="t('legal.tabs.privacy')">
          <div class="legal-content">
            <n-h1 style="font-size: 1.8rem; margin-bottom: 20px">{{
              t('legal.privacy.title')
            }}</n-h1>

            <div v-for="key in orderedPrivacyKeys" :key="key" class="legal-section">
              <n-h2>{{ t(`legal.privacy.sections.${key}Title`) }}</n-h2>
              <n-p
                v-for="(para, index) in tm(`legal.privacy.sections.${key}Paragraphs`)"
                :key="index"
              >
                <span style="white-space: pre-wrap">{{ para }}</span>
              </n-p>
              <!-- Dynamic link for payment section -->
              <n-p v-if="key === 'payment' && te('legal.privacy.sections.paymentLink')">
                <a
                  :href="t('legal.privacy.sections.paymentLink')"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="legal-link"
                >
                  {{ t('legal.privacy.sections.paymentLink') }}
                </a>
              </n-p>
            </div>
          </div>
        </n-tab-pane>

        <!-- TERMS (AGB) -->
        <n-tab-pane name="terms" :tab="t('legal.tabs.terms')">
          <div class="legal-content">
            <n-h1 style="font-size: 1.8rem; margin-bottom: 20px">{{ t('legal.terms.title') }}</n-h1>

            <div v-for="key in orderedTermsKeys" :key="key" class="legal-section">
              <n-h2>{{ t(`legal.terms.sections.${key}Title`) }}</n-h2>
              <n-p
                v-for="(para, index) in tm(`legal.terms.sections.${key}Paragraphs`)"
                :key="index"
              >
                <span style="white-space: pre-wrap">{{ para }}</span>
              </n-p>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </div>
</template>

<style scoped>
.legal-page-container {
  max-width: 900px;
  margin: 40px auto;
  padding: 0 20px;
}

.legal-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border) !important;
  border-radius: var(--panel-border-radius);
  color: var(--color-text-default);
  min-height: auto;
}

.legal-title {
  color: var(--color-accent-primary);
  text-align: center;
  margin-bottom: 30px;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.precedence-alert {
  margin-bottom: 30px;
  background: rgba(0, 242, 255, 0.05);
  color: var(--color-text-muted);
  font-style: italic;
  font-size: 0.95rem;
  line-height: 1.5;
}

.legal-tabs :deep(.n-tabs-tab) {
  font-weight: 600;
  font-size: 1.1rem;
}

.legal-content {
  padding: 20px 10px;
  line-height: 1.6;
}

.legal-section {
  margin-bottom: 40px;
}

.address-block {
  background: rgba(255, 255, 255, 0.05);
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid var(--color-accent-primary);
  margin-top: 10px;
}

.legal-link {
  color: var(--color-accent-primary);
  text-decoration: underline;
  word-break: break-all;
  transition: opacity 0.2s;
}

.legal-link:hover {
  opacity: 0.8;
}

:deep(.n-h2) {
  color: var(--color-accent-primary);
  font-size: 1.3rem;
  margin-top: 25px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(0, 242, 255, 0.1);
  padding-bottom: 5px;
}

:deep(.n-p) {
  margin-bottom: 15px;
  color: var(--color-text-muted);
}

@media (max-width: 600px) {
  .legal-page-container {
    margin: 10px auto;
    padding: 0 10px;
  }

  .legal-tabs :deep(.n-tabs-tab) {
    font-size: 0.9rem;
    padding: 0 8px;
  }
}
</style>
