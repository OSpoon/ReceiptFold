<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUpRight, Check, FileImage, FileText, Plus, Search } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { invoiceCategories, type Invoice } from '../../../../common/contracts'
import { money, shortDate } from '@/composables/useFormatters'
import { useInvoiceDetail } from '@/composables/useInvoiceDetail'
import { useInvoiceLibrary } from '@/composables/useInvoiceLibrary'
import { invoiceStatusDisplay } from '@/composables/invoiceStatus'

const props = defineProps<{ mode: 'all' | 'review' }>()
const query = ref('')
const categoryFilter = ref('all')
const library = useInvoiceLibrary()
const { invoices, isLoading, openImportDialog } = library
const { selectInvoice } = useInvoiceDetail()

const visibleInvoices = computed(() => {
  let items = [...invoices.value]
  if (props.mode === 'review') items = items.filter((invoice) => invoice.status === 'review')
  if (categoryFilter.value !== 'all') items = items.filter((invoice) => invoice.category === categoryFilter.value)
  const needle = query.value.trim().toLowerCase()
  if (needle) {
    items = items.filter((invoice) => [invoice.seller, invoice.invoiceNumber, invoice.fileName, invoice.text]
      .some((value) => value.toLowerCase().includes(needle)))
  }
  return items.sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt))
})

function openInvoice(invoice: Invoice): void {
  void selectInvoice(invoice)
}
</script>

<template>
  <section class="invoice-section">
    <div class="section-heading">
      <div class="section-title-row">
        <h2>{{ props.mode === 'review' ? '需要你看一眼' : '发票清单' }}</h2>
        <span class="result-count">{{ visibleInvoices.length }}</span>
      </div>
      <div v-if="invoices.length" class="table-tools">
        <label class="search-box">
          <Search :size="16" />
          <Input v-model="query" type="search" placeholder="搜索发票或销售方" aria-label="搜索发票" />
        </label>
        <Select v-model:model-value="categoryFilter">
          <SelectTrigger class="category-select-wrap" aria-label="按类别筛选"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有类别</SelectItem>
            <SelectItem v-for="category in invoiceCategories" :key="category" :value="category">{{ category }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div v-if="isLoading" class="loading-card"><span class="button-spinner"></span>正在加载发票…</div>
    <Card v-else-if="visibleInvoices.length" class="table-card">
      <Table class="invoice-table">
        <TableHeader class="table-heading">
          <TableRow>
            <TableHead class="date-column">开票日期</TableHead>
            <TableHead>销售方 / 发票号码</TableHead>
            <TableHead class="category-column">类别</TableHead>
            <TableHead class="status-column">状态</TableHead>
            <TableHead class="amount-column">价税合计</TableHead>
            <TableHead class="row-action-column"><span class="sr-only">打开详情</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="invoice in visibleInvoices"
            :key="invoice.id"
            class="invoice-row"
            tabindex="0"
            @click="openInvoice(invoice)"
            @keydown.enter="openInvoice(invoice)"
            @keydown.space.prevent="openInvoice(invoice)"
          >
            <TableCell class="date-cell">{{ shortDate(invoice.date) }}</TableCell>
            <TableCell>
              <div class="vendor-cell">
                <span class="vendor-mark"><FileText :size="16" /></span>
                <span class="vendor-copy"><strong>{{ invoice.seller || invoice.fileName }}</strong><small>{{ invoice.invoiceNumber || '发票号码待补充' }}</small></span>
              </div>
            </TableCell>
            <TableCell><Badge variant="secondary">{{ invoice.category }}</Badge></TableCell>
            <TableCell><Badge :variant="invoice.status === 'confirmed' ? 'secondary' : 'outline'" :class="['status-tag', invoiceStatusDisplay(invoice).className]"><span></span>{{ invoiceStatusDisplay(invoice).label }}</Badge></TableCell>
            <TableCell class="amount-cell"><span class="amount-currency">¥</span> {{ money(invoice.amount) }}</TableCell>
            <TableCell class="row-arrow"><Button variant="ghost" size="icon" :aria-label="`查看 ${invoice.seller || invoice.fileName} 的发票详情`" @click.stop="openInvoice(invoice)"><ArrowUpRight :size="15" /></Button></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
    <div v-else-if="query || categoryFilter !== 'all' || (props.mode === 'review' && invoices.length > 0)" class="empty-filter-card">
      <div class="empty-search-icon"><Search :size="21" /></div>
      <strong>{{ props.mode === 'review' && !query && categoryFilter === 'all' ? '没有待核对的发票' : '没有找到匹配的发票' }}</strong>
      <button v-if="query || categoryFilter !== 'all'" type="button" @click="query = ''; categoryFilter = 'all'">清除筛选</button>
    </div>
    <div v-else class="empty-state">
      <div class="empty-art">
        <div class="art-glow"></div>
        <div class="art-sheet sheet-back"><span></span><span></span><span></span></div>
        <div class="art-sheet sheet-front"><div class="art-sheet-header"><span></span><span></span></div><div class="art-lines"><i></i><i></i><i></i></div><div class="art-total"><span></span><b></b></div></div>
        <div class="art-stamp"><Check :size="17" /></div>
      </div>
      <h3>你的发票夹，还在等第一张票</h3>
      <Button class="empty-import-button" @click="openImportDialog"><Plus :size="17" /> 导入第一张发票</Button>
      <div class="supported-formats"><FileImage :size="14" /> 支持 JPG、PNG、WEBP、BMP、TIFF 图片</div>
    </div>
  </section>
</template>
