<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { NCard, NTabs, NTabPane, NH1, NH2, NP, NText, NDivider, NAlert } from 'naive-ui'

const { t, te, tm, rt, locale } = useI18n()
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
  'telegram',
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
  <div class="mx-auto my-1 max-w-[900px] px-1 sm:my-10 sm:px-5">
    <n-card
      class="glass text-text-primary [&>.n-card__content]:!px-2 [&>.n-card__content]:!py-2.5 sm:[&>.n-card__content]:!px-6 sm:[&>.n-card__content]:!py-5"
      :bordered="false"
    >
      <n-h1
        align-text
        class="!mb-3 text-center font-display text-base font-bold tracking-[1px] text-text-primary uppercase sm:!mb-7.5 sm:text-2xl sm:tracking-[2px]"
      >
        {{ t('legal.title') }}
      </n-h1>

      <!-- Language Precedence Notice -->
      <n-alert
        v-if="showPrecedenceNotice"
        type="info"
        class="mb-3 bg-elevated !p-2 text-[11px] leading-snug text-text-secondary italic sm:mb-7.5 sm:!p-3.5 sm:text-[0.9rem] sm:leading-normal"
        :bordered="false"
      >
        {{ t('legal.precedence') }}
      </n-alert>

      <n-tabs
        v-model:value="activeTab"
        type="line"
        size="small"
        animated
        justify-content="space-evenly"
      >
        <!-- IMPRESSUM -->
        <n-tab-pane name="imprint" :tab="t('legal.tabs.imprint')">
          <div class="px-0.5 py-2 text-xs leading-snug sm:px-2.5 sm:py-5 sm:text-sm sm:leading-relaxed">
            <n-h2
              class="!mt-3 !mb-1.5 border-b border-border pb-1 text-[13px] font-bold text-text-primary sm:!mt-6 sm:!mb-3 sm:pb-1.5 sm:text-[1.2rem]"
            >
              {{ t('legal.imprint.title') }}
            </n-h2>
            <n-text depth="3" class="text-[11px] sm:text-xs">{{ t('legal.imprint.subtitle') }}</n-text>

            <n-p
              class="mt-2 !mb-3 rounded-lg border-l-3 border-brand bg-elevated/50 p-2.5 text-xs !text-text-secondary sm:mt-2.5 sm:!mb-4 sm:border-l-4 sm:p-3.5 sm:text-sm"
            >
              <strong class="text-text-primary">{{ t('legal.imprint.name') }}</strong><br />
              <template
                v-for="(line, index) in formatAddress(t('legal.imprint.address'))"
                :key="index"
              >
                {{ line }}<br v-if="index < formatAddress(t('legal.imprint.address')).length - 1" />
              </template>
            </n-p>

            <n-h2
              class="!mt-3.5 !mb-1.5 border-b border-border pb-1 text-[13px] font-bold text-text-primary sm:!mt-6 sm:!mb-3 sm:pb-1.5 sm:text-[1.2rem]"
            >
              {{ t('legal.imprint.contact') }}
            </n-h2>
            <n-p class="!mb-2.5 text-xs !text-text-secondary sm:!mb-4 sm:text-sm">
              {{ t('legal.imprint.email') }}<br />
              {{ t('legal.imprint.phone') }}
            </n-p>

            <n-p class="!mb-2.5 text-xs !text-text-secondary sm:!mb-4 sm:text-sm">
              <strong class="text-text-primary">{{ t('legal.imprint.vatId') }}</strong>
            </n-p>

            <n-divider class="!my-3 sm:!my-5" />

            <n-h2
              class="!mt-3.5 !mb-1.5 border-b border-border pb-1 text-[13px] font-bold text-text-primary sm:!mt-6 sm:!mb-3 sm:pb-1.5 sm:text-[1.2rem]"
            >
              {{ t('legal.imprint.dispute') }}
            </n-h2>
            <n-p class="!mb-2 text-xs !text-text-secondary sm:!mb-4 sm:text-sm">
              {{ t('legal.imprint.disputeText') }}
              <a
                :href="t('legal.imprint.disputeLink')"
                target="_blank"
                rel="noopener noreferrer"
                class="break-all text-brand underline transition-opacity hover:opacity-80"
              >
                {{ t('legal.imprint.disputeLink') }}
              </a>
            </n-p>
            <n-p class="!mb-2.5 text-xs !text-text-secondary sm:!mb-4 sm:text-sm">
              {{ t('legal.imprint.disputeRefusal') }}
            </n-p>

            <n-divider class="!my-3 sm:!my-5" />

            <n-h2
              class="!mt-3.5 !mb-1.5 border-b border-border pb-1 text-[13px] font-bold text-text-primary sm:!mt-6 sm:!mb-3 sm:pb-1.5 sm:text-[1.2rem]"
            >
              {{ t('legal.imprint.legalNotice') }}
            </n-h2>
            <n-p class="!mb-1 text-xs !text-text-secondary sm:!mb-2 sm:text-sm">
              <strong class="text-text-primary">{{ t('legal.imprint.liabilityTitle') }}</strong>
            </n-p>
            <n-p class="!mb-2.5 text-xs !text-text-secondary sm:!mb-4 sm:text-sm">
              {{ t('legal.imprint.liabilityContent') }}
            </n-p>

            <n-p class="!mb-1 text-xs !text-text-secondary sm:!mb-2 sm:text-sm">
              <strong class="text-text-primary">{{ t('legal.imprint.copyrightTitle') }}</strong>
            </n-p>
            <n-p class="!mb-2 text-xs !text-text-secondary sm:!mb-4 sm:text-sm">
              {{ t('legal.imprint.copyrightContent') }}
            </n-p>
          </div>
        </n-tab-pane>

        <!-- PRIVACY -->
        <n-tab-pane name="privacy" :tab="t('legal.tabs.privacy')">
          <div class="px-0.5 py-2 text-xs leading-snug sm:px-2.5 sm:py-5 sm:text-sm sm:leading-relaxed">
            <n-h1 class="!mb-2.5 text-sm font-bold sm:!mb-5 sm:text-[1.5rem]">
              {{ t('legal.privacy.title') }}
            </n-h1>

            <div v-for="key in orderedPrivacyKeys" :key="key" class="mb-4 sm:mb-8">
              <n-h2
                class="!mt-3.5 !mb-1.5 border-b border-border pb-1 text-[13px] font-bold text-text-primary sm:!mt-6 sm:!mb-3 sm:pb-1.5 sm:text-[1.2rem]"
              >
                {{ t(`legal.privacy.sections.${key}Title`) }}
              </n-h2>
              <n-p
                v-for="(para, index) in tm(`legal.privacy.sections.${key}Paragraphs`)"
                :key="index"
                class="!mb-2 text-xs leading-snug !text-text-secondary sm:!mb-3.5 sm:text-sm sm:leading-relaxed"
              >
                <span class="whitespace-pre-wrap">{{ rt(para) }}</span>
              </n-p>
            </div>
          </div>
        </n-tab-pane>

        <!-- TERMS (AGB) -->
        <n-tab-pane name="terms" :tab="t('legal.tabs.terms')">
          <div class="px-0.5 py-2 text-xs leading-snug sm:px-2.5 sm:py-5 sm:text-sm sm:leading-relaxed">
            <n-h1 class="!mb-2.5 text-sm font-bold sm:!mb-5 sm:text-[1.5rem]">
              {{ t('legal.terms.title') }}
            </n-h1>

            <div v-for="key in orderedTermsKeys" :key="key" class="mb-4 sm:mb-8">
              <n-h2
                class="!mt-3.5 !mb-1.5 border-b border-border pb-1 text-[13px] font-bold text-text-primary sm:!mt-6 sm:!mb-3 sm:pb-1.5 sm:text-[1.2rem]"
              >
                {{ t(`legal.terms.sections.${key}Title`) }}
              </n-h2>
              <n-p
                v-for="(para, index) in tm(`legal.terms.sections.${key}Paragraphs`)"
                :key="index"
                class="!mb-2 text-xs leading-snug !text-text-secondary sm:!mb-3.5 sm:text-sm sm:leading-relaxed"
              >
                <span class="whitespace-pre-wrap">{{ rt(para) }}</span>
              </n-p>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </div>
</template>
