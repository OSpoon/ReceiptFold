<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Archive, ArrowDownToLine, Clock3, Plus, Settings2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import InvoiceDetailSheet from '@/components/invoices/InvoiceDetailSheet.vue'
import InvoiceExportDialog from '@/components/invoices/InvoiceExportDialog.vue'
import InvoiceImportDialog from '@/components/invoices/InvoiceImportDialog.vue'
import ToastMessage from '@/components/app/ToastMessage.vue'
import { useAppUpdates } from '@/composables/useAppUpdates'
import { useInvoiceLibrary } from '@/composables/useInvoiceLibrary'
import { useOcrSettings } from '@/composables/useOcrSettings'
import { useTheme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import brandLogo from '@/assets/receipt-fold-logo.svg'

type ViewName = 'all' | 'review' | 'settings'

const route = useRoute()
const router = useRouter()
const view = computed<ViewName>(() => route.name === 'review' ? 'review' : route.name === 'settings' ? 'settings' : 'all')
const pageTitle = computed(() => String(route.meta.title ?? '发票库'))
const pageDescription = computed(() => String(route.meta.description ?? ''))
const {
  invoices,
  isImporting,
  progress,
  reviewCount,
  initializeInvoiceLibrary,
  disposeInvoiceLibrary,
  openImportDialog,
  openExportDialog
} = useInvoiceLibrary()
const { initializeAppUpdates, disposeAppUpdates } = useAppUpdates()
const { initializeOcrSettings } = useOcrSettings()
const { initializeTheme, disposeTheme } = useTheme()
const { toastMessage, clearToast } = useToast()
initializeTheme()

function setView(nextView: ViewName): void {
  if (view.value !== nextView) void router.push({ name: nextView })
}

onMounted(() => {
  initializeInvoiceLibrary()
  initializeOcrSettings()
  initializeAppUpdates()
})

onUnmounted(() => {
  disposeInvoiceLibrary()
  disposeAppUpdates()
  disposeTheme()
  clearToast()
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand-row">
        <div class="brand-mark"><img :src="brandLogo" alt="" /></div>
        <div class="brand-copy">
          <strong>发票夹</strong>
          <span>RECEIPT FOLD</span>
        </div>
      </div>

      <nav class="primary-nav" aria-label="主导航">
        <button :class="['nav-item', { active: view === 'all' }]" type="button" @click="setView('all')">
          <Archive :size="18" :stroke-width="1.8" /><span>发票库</span>
          <span class="nav-count">{{ invoices.length }}</span>
        </button>
        <button :class="['nav-item', { active: view === 'review' }]" type="button" @click="setView('review')">
          <Clock3 :size="18" :stroke-width="1.8" /><span>待核对</span>
          <span v-if="reviewCount" class="nav-count attention">{{ reviewCount }}</span>
        </button>
      </nav>

      <div class="sidebar-spacer"></div>
      <button :class="['nav-item', 'settings-nav-item', { active: view === 'settings' }]" type="button" @click="setView('settings')">
        <Settings2 :size="18" :stroke-width="1.8" /><span>设置</span>
      </button>
    </aside>

    <main class="main-content">
      <header class="topbar">
        <div class="topbar-context"><span>发票夹</span><span class="crumb-slash">/</span><strong>{{ pageTitle }}</strong></div>
        <div v-if="view !== 'settings' || isImporting" class="topbar-actions">
          <Button v-if="view !== 'settings'" variant="secondary" class="export-button" :disabled="!invoices.length" @click="openExportDialog">
            <ArrowDownToLine :size="16" /> <span>导出清单</span>
          </Button>
          <Button :variant="isImporting ? 'secondary' : 'default'" @click="openImportDialog">
            <span v-if="isImporting" class="button-spinner"></span>
            <Plus v-else :size="17" />
            {{ isImporting ? progress ? `识别中 ${progress.current}/${progress.total}` : '导入处理中' : '导入发票' }}
          </Button>
        </div>
      </header>

      <div :class="['page-content', { 'settings-page-content': view === 'settings' }]">
        <section v-if="view !== 'settings'" class="page-heading">
          <div>
            <h1>{{ pageTitle }}</h1>
            <p v-if="pageDescription">{{ pageDescription }}</p>
          </div>
        </section>
        <RouterView />
      </div>
    </main>

    <InvoiceImportDialog />
    <InvoiceExportDialog />
    <InvoiceDetailSheet />
    <ToastMessage :message="toastMessage" />
  </div>
</template>
