<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NTabs, NTabPane, NH1, NH2, NP, NText, NDivider, NAlert } from 'naive-ui'

const { t, te, tm, locale } = useI18n()
const route = useRoute()
const router = useRouter()

const activeTab = ref('imprint')

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

watch(activeTab, (newTab) => {
  const hash = Object.keys(tabMap).find((key) => tabMap[key] === newTab)
  if (hash && window.location.hash !== hash) {
    router.replace({ hash })
  }
})

watch(
  () => route.hash,
  () => {
    syncTabWithHash()
  },
)

const formatAddress = (text: string) => {
  return text.split('\n')
}

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
  <div class="mx-auto my-2.5 max-w-[900px] px-2.5 sm:my-10 sm:px-5">
    <n-card class="glass text-text-primary" :bordered="false">
      <n-h1 align-text class="!mb-7.5 text-center font-display tracking-[2px] !text-neon-cyan uppercase">
        {{ t('legal.title') }}
      </n-h1>

      <!-- Language Precedence Notice -->
      <n-alert
        v-if="showPrecedenceNotice"
        type="info"
        class="mb-7.5 !bg-neon-cyan/5 text-[0.95rem] leading-normal text-text-secondary italic"
        :bordered="false"
      >
        {{ t('legal.precedence') }}
      </n-alert>

      <n-tabs
        v-model:value="activeTab"
        type="line"
        animated
        justify-content="space-evenly"
      >
        <!-- IMPRESSUM -->
        <n-tab-pane name="imprint" :tab="t('legal.tabs.imprint')">
          <div class="px-2.5 py-5 leading-relaxed">
            <n-h2 class="!mt-6 !mb-3 border-b border-neon-cyan/15 pb-1.5 text-[1.3rem] !text-neon-cyan">
              {{ t('legal.imprint.title') }}
            </n-h2>
            <n-text depth="3">{{ t('legal.imprint.subtitle') }}</n-text>

            <n-p
              class="mt-2.5 !mb-4 rounded-lg border-l-4 border-neon-cyan bg-elevated/50 p-3.5 !text-text-secondary"
            >
              <strong class="text-text-primary">{{ t('legal.imprint.name') }}</strong><br />
              <template
                v-for="(line, index) in formatAddress(t('legal.imprint.address'))"
                :key="index"
              >
                {{ line }}<br v-if="index < formatAddress(t('legal.imprint.address')).length - 1" />
              </template>
            </n-p>

            <n-h2 class="!mt-6 !mb-3 border-b border-neon-cyan/15 pb-1.5 text-[1.3rem] !text-neon-cyan">
              {{ t('legal.imprint.contact') }}
            </n-h2>
            <n-p class="!mb-4 !text-text-secondary">
              {{ t('legal.imprint.email') }}<br />
              {{ t('legal.imprint.phone') }}
            </n-p>

            <n-p class="!mb-4 !text-text-secondary">
              <strong class="text-text-primary">{{ t('legal.imprint.vatId') }}</strong>
            </n-p>

            <n-divider />

            <n-h2 class="!mt-6 !mb-3 border-b border-neon-cyan/15 pb-1.5 text-[1.3rem] !text-neon-cyan">
              {{ t('legal.imprint.dispute') }}
            </n-h2>
            <n-p class="!mb-4 !text-text-secondary">
              {{ t('legal.imprint.disputeText') }}
              <a
                :href="t('legal.imprint.disputeLink')"
                target="_blank"
                rel="noopener noreferrer"
                class="break-all text-neon-cyan underline transition-opacity hover:opacity-80"
              >
                {{ t('legal.imprint.disputeLink') }}
              </a>
            </n-p>
            <n-p class="!mb-4 !text-text-secondary">{{ t('legal.imprint.disputeRefusal') }}</n-p>

            <n-divider />

            <n-h2 class="!mt-6 !mb-3 border-b border-neon-cyan/15 pb-1.5 text-[1.3rem] !text-neon-cyan">
              {{ t('legal.imprint.legalNotice') }}
            </n-h2>
            <n-p class="!mb-2 !text-text-secondary">
              <strong class="text-text-primary">{{ t('legal.imprint.liabilityTitle') }}</strong>
            </n-p>
            <n-p class="!mb-4 !text-text-secondary">{{ t('legal.imprint.liabilityContent') }}</n-p>

            <n-p class="!mb-2 !text-text-secondary">
              <strong class="text-text-primary">{{ t('legal.imprint.copyrightTitle') }}</strong>
            </n-p>
            <n-p class="!mb-4 !text-text-secondary">{{ t('legal.imprint.copyrightContent') }}</n-p>
          </div>
        </n-tab-pane>

        <!-- PRIVACY -->
        <n-tab-pane name="privacy" :tab="t('legal.tabs.privacy')">
          <div class="px-2.5 py-5 leading-relaxed">
            <n-h1 class="!mb-5 text-[1.8rem]">{{ t('legal.privacy.title') }}</n-h1>

            <div v-for="key in orderedPrivacyKeys" :key="key" class="mb-10">
              <n-h2
                class="!mt-6 !mb-3 border-b border-neon-cyan/15 pb-1.5 text-[1.3rem] !text-neon-cyan"
              >
                {{ t(`legal.privacy.sections.${key}Title`) }}
              </n-h2>
              <n-p
                v-for="(para, index) in tm(`legal.privacy.sections.${key}Paragraphs`)"
                :key="index"
                class="!mb-4 !text-text-secondary"
              >
                <span class="whitespace-pre-wrap">{{ para }}</span>
              </n-p>
              <n-p
                v-if="key === 'payment' && te('legal.privacy.sections.paymentLink')"
                class="!mb-4"
              >
                <a
                  :href="t('legal.privacy.sections.paymentLink')"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="break-all text-neon-cyan underline transition-opacity hover:opacity-80"
                >
                  {{ t('legal.privacy.sections.paymentLink') }}
                </a>
              </n-p>
            </div>
          </div>
        </n-tab-pane>

        <!-- TERMS (AGB) -->
        <n-tab-pane name="terms" :tab="t('legal.tabs.terms')">
          <div class="px-2.5 py-5 leading-relaxed">
            <n-h1 class="!mb-5 text-[1.8rem]">{{ t('legal.terms.title') }}</n-h1>

            <div v-for="key in orderedTermsKeys" :key="key" class="mb-10">
              <n-h2
                class="!mt-6 !mb-3 border-b border-neon-cyan/15 pb-1.5 text-[1.3rem] !text-neon-cyan"
              >
                {{ t(`legal.terms.sections.${key}Title`) }}
              </n-h2>
              <n-p
                v-for="(para, index) in tm(`legal.terms.sections.${key}Paragraphs`)"
                :key="index"
                class="!mb-4 !text-text-secondary"
              >
                <span class="whitespace-pre-wrap">{{ para }}</span>
              </n-p>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </div>
</template>
