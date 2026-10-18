<script setup lang="ts">
import { ArrowDownToLine, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useInvoiceLibrary } from '@/composables/useInvoiceLibrary'

const { invoices, isExportDialogOpen, isExporting, exportCsv } = useInvoiceLibrary()
</script>

<template>
  <Dialog v-model:open="isExportDialogOpen">
    <DialogContent class="export-dialog">
      <DialogHeader class="export-dialog-header">
        <div class="export-dialog-icon"><ArrowDownToLine :size="17" /></div>
        <div class="export-dialog-heading">
          <DialogTitle>导出发票清单</DialogTitle>
          <DialogDescription>将 {{ invoices.length }} 张发票导出为 CSV 文件。</DialogDescription>
        </div>
        <DialogClose as-child><Button variant="ghost" size="icon" class="export-dialog-close" aria-label="关闭导出对话框"><X :size="16" /></Button></DialogClose>
      </DialogHeader>
      <div class="export-dialog-summary">
        <span>导出内容</span>
        <p>完整票面信息、项目明细与备注</p>
      </div>
      <DialogFooter class="export-dialog-footer">
        <DialogClose as-child><Button variant="outline" :disabled="isExporting">取消</Button></DialogClose>
        <Button :disabled="isExporting" @click="exportCsv">
          <span v-if="isExporting" class="button-spinner"></span>
          <ArrowDownToLine v-else :size="15" />
          {{ isExporting ? '正在导出…' : '选择保存位置' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
