<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDraggable, useEventListener } from '@vueuse/core'
import { CircleHelp, Copy, FileImage, LockKeyhole, Minus, Plus, ReceiptText, Trash2, X } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import InvoiceEditForm from './InvoiceEditForm.vue'
import { money } from '@/composables/useFormatters'
import { invoiceStatusDisplay } from '@/composables/invoiceStatus'
import { useInvoiceDetail } from '@/composables/useInvoiceDetail'

const {
  selectedInvoice,
  previewImage,
  isEditing,
  isSaving,
  draft,
  faceAmountFields,
  faceMetadataFields,
  facePersonFields,
  itemFields,
  partyFields,
  partySections,
  shortDate,
  onSheetOpenChange,
  editInvoice,
  saveInvoice,
  removeInvoice,
  copyInvoiceContent
} = useInvoiceDetail()

const imageZoom = ref(1)
const imageStage = ref<HTMLElement | null>(null)
const imageOffset = ref({ x: 0, y: 0 })
const panStart = ref<{ pointerX: number, pointerY: number, offsetX: number, offsetY: number } | null>(null)
const zoomLabel = computed(() => `${Math.round(imageZoom.value * 100)}%`)
const imageTransform = computed(() => `translate(${imageOffset.value.x}px, ${imageOffset.value.y}px) scale(${imageZoom.value})`)
const detailStatus = computed(() => selectedInvoice.value ? invoiceStatusDisplay(selectedInvoice.value) : null)
const { isDragging: isImagePanning } = useDraggable(imageStage, {
  preventDefault: true,
  onStart: (_position, event) => {
    if (imageZoom.value <= 1) return false
    panStart.value = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: imageOffset.value.x,
      offsetY: imageOffset.value.y
    }
    return undefined
  },
  onMove: (_position, event) => {
    if (!panStart.value || imageZoom.value <= 1) return
    imageOffset.value = {
      x: panStart.value.offsetX + event.clientX - panStart.value.pointerX,
      y: panStart.value.offsetY + event.clientY - panStart.value.pointerY
    }
  },
  onEnd: () => { panStart.value = null }
})

watch([selectedInvoice, previewImage], () => {
  imageZoom.value = 1
  imageOffset.value = { x: 0, y: 0 }
})

function setImageZoom(nextZoom: number): void {
  imageZoom.value = Math.min(4, Math.max(1, nextZoom))
  if (imageZoom.value === 1) imageOffset.value = { x: 0, y: 0 }
}

function adjustImageZoom(amount: number): void {
  setImageZoom(imageZoom.value + amount)
}

function handleImageWheel(event: WheelEvent): void {
  event.preventDefault()
  setImageZoom(imageZoom.value * (event.deltaY < 0 ? 1.15 : 1 / 1.15))
}

useEventListener(imageStage, 'wheel', handleImageWheel, { passive: false })
</script>

<template>
  <Sheet :open="Boolean(selectedInvoice)" @update:open="onSheetOpenChange">
    <SheetContent v-if="selectedInvoice" class="detail-panel">
      <SheetHeader class="detail-header">
        <div class="detail-header-title"><span class="detail-header-icon"><ReceiptText :size="16" /></span><SheetTitle>发票详情</SheetTitle></div>
        <SheetDescription class="sr-only">查看和修改这张发票的完整票面信息。</SheetDescription>
        <div class="detail-header-actions">
          <Button variant="ghost" size="icon" title="删除发票" @click="removeInvoice"><Trash2 :size="16" /></Button>
          <SheetClose as-child><Button variant="ghost" size="icon" class="close-button" title="关闭"><X :size="18" /></Button></SheetClose>
        </div>
      </SheetHeader>

      <div class="detail-scroll">
        <div class="preview-frame">
          <div
            v-if="previewImage"
            ref="imageStage"
            :class="['preview-image-stage', { zoomed: imageZoom > 1, panning: isImagePanning }]"
            :aria-label="`发票原图预览：${selectedInvoice.fileName}，可滚轮缩放，放大后拖动查看`"
            role="img"
            tabindex="0"
          >
            <img :src="previewImage" :alt="selectedInvoice.fileName" :style="{ transform: imageTransform }" draggable="false" />
          </div>
          <div v-else class="preview-fallback"><FileImage :size="31" /><span>无法预览这张图片</span></div>
          <div v-if="previewImage" class="preview-image-toolbar" aria-label="发票原图缩放控制">
            <Button variant="outline" size="icon" aria-label="缩小图片" title="缩小" :disabled="imageZoom <= 1" @click="adjustImageZoom(-0.25)"><Minus :size="13" /></Button>
            <span class="preview-image-zoom-value">{{ zoomLabel }}</span>
            <Button variant="outline" size="icon" aria-label="放大图片" title="放大" :disabled="imageZoom >= 4" @click="adjustImageZoom(0.25)"><Plus :size="13" /></Button>
            <Button variant="ghost" class="preview-image-reset" @click="setImageZoom(1)">适应</Button>
          </div>
          <span class="preview-badge"><LockKeyhole :size="12" /> 原票预览</span>
        </div>

        <div class="detail-summary">
          <div class="detail-status-line">
            <div class="detail-status-info">
              <Badge :class="['status-tag', detailStatus?.className]"><span></span>{{ detailStatus?.label }}</Badge>
              <span v-if="selectedInvoice.ocrStatus === 'done'" class="detail-confidence">识别分数 {{ Math.round(selectedInvoice.confidence * 100) }}%</span>
              <span v-else-if="selectedInvoice.ocrStatus === 'manual'" class="detail-confidence">手动录入</span>
            </div>
            <div class="detail-meta-actions">
              <span class="detail-created">收录于 {{ shortDate(selectedInvoice.createdAt.slice(0, 10)) }}</span>
              <Button class="copy-invoice-button" size="sm" title="复制完整票面信息" @click="copyInvoiceContent"><Copy :size="13" />复制发票内容</Button>
            </div>
          </div>
          <h2>{{ selectedInvoice.seller || '未识别销售方' }}</h2>
          <div class="detail-amount"><span>¥</span>{{ money(selectedInvoice.amount) }}</div>
          <div v-if="selectedInvoice.ocrError" class="ocr-message"><CircleHelp :size="15" /><span>{{ selectedInvoice.ocrError }}</span></div>
        </div>

        <InvoiceEditForm v-if="isEditing && draft" :model-value="draft" :is-saving="isSaving" @cancel="isEditing = false" @submit="saveInvoice" />

        <div v-else class="detail-fields">
          <div class="detail-section-heading"><div><h3>完整票面信息</h3><p>已提取票面字段与项目明细，可随时修正。</p></div><button class="edit-button" type="button" @click="editInvoice">编辑信息</button></div>
          <div class="detail-subheading">基础信息</div>
          <div class="field-row"><span>开票日期</span><strong>{{ selectedInvoice.date ? shortDate(selectedInvoice.date) : '—' }}</strong></div>
          <div class="field-row"><span>发票号码</span><strong class="field-number">{{ selectedInvoice.invoiceNumber || '—' }}</strong></div>
          <div v-for="field in faceMetadataFields" :key="field.key" class="field-row"><span>{{ field.label }}</span><strong>{{ selectedInvoice.details[field.key] || '—' }}</strong></div>
          <div class="field-row"><span>价税合计</span><strong>¥ {{ money(selectedInvoice.amount) }}</strong></div>
          <div class="field-row"><span>类别</span><strong><Badge variant="secondary">{{ selectedInvoice.category }}</Badge></strong></div>

          <template v-for="party in partySections" :key="party.key">
            <div class="detail-subheading">{{ party.label }}信息</div>
            <div v-for="field in partyFields" :key="field.key" class="field-row"><span>{{ field.label }}</span><strong>{{ selectedInvoice.details[party.key][field.key] || '—' }}</strong></div>
          </template>

          <div class="detail-subheading">金额与税额</div>
          <div v-for="field in faceAmountFields" :key="field.key" class="field-row"><span>{{ field.label }}</span><strong>{{ selectedInvoice.details[field.key] || '—' }}</strong></div>

          <div class="detail-subheading detail-subheading-actions"><span>项目明细（{{ selectedInvoice.details.items.length }}）</span></div>
          <article v-for="(item, index) in selectedInvoice.details.items" :key="index" class="item-view-card">
            <strong class="item-view-title">{{ item.name || `明细 ${index + 1}` }}</strong>
            <div class="item-view-grid">
              <div v-for="field in itemFields.slice(1)" :key="field.key"><span>{{ field.label }}</span><strong>{{ item[field.key] || '—' }}</strong></div>
            </div>
          </article>
          <div v-if="!selectedInvoice.details.items.length" class="empty-detail">未能识别为明细行，可通过“编辑信息”手动添加。</div>

          <div class="detail-subheading">备注与开票人员</div>
          <div v-for="field in facePersonFields" :key="field.key" class="field-row"><span>{{ field.label }}</span><strong>{{ selectedInvoice.details[field.key] || '—' }}</strong></div>
          <div class="field-row field-row-multiline"><span>票面备注</span><strong>{{ selectedInvoice.details.remarks || '—' }}</strong></div>
          <div class="field-row field-row-multiline"><span>内部备注</span><strong>{{ selectedInvoice.note || '—' }}</strong></div>

          <div class="detail-subheading detail-subheading-actions"><span>其他票面字段（{{ selectedInvoice.details.extraFields.length }}）</span></div>
          <div v-for="(field, index) in selectedInvoice.details.extraFields" :key="index" class="field-row"><span>{{ field.label }}</span><strong>{{ field.value }}</strong></div>
          <div class="field-row field-row-multiline"><span>二维码内容</span><strong class="field-number">{{ selectedInvoice.details.qrCodeText || '未检测到二维码' }}</strong></div>
        </div>

      </div>
      <div class="detail-bottom"><LockKeyhole :size="13" /> 原图和信息仅保存在你的设备上</div>
    </SheetContent>
  </Sheet>
</template>
