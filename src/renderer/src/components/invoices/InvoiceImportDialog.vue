<script setup lang="ts">
import { FileImage, FolderOpen, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useInvoiceLibrary } from '@/composables/useInvoiceLibrary'

const {
  isImportDialogOpen,
  isImporting,
  isImportDragOver,
  importError,
  importWarning,
  progress,
  progressPercent,
  importFiles,
  handleImportDragOver,
  handleImportDragLeave,
  handleImportDrop
} = useInvoiceLibrary()
</script>

<template>
  <Dialog v-model:open="isImportDialogOpen">
    <DialogContent class="import-dialog">
      <DialogHeader class="import-dialog-header">
        <div class="import-dialog-icon"><FileImage :size="17" /></div>
        <div class="import-dialog-heading">
          <DialogTitle>{{ isImporting ? '正在导入发票' : '导入发票' }}</DialogTitle>
          <DialogDescription>{{ isImporting ? '关闭窗口后可以切换菜单，识别会继续运行。' : '选择图片，或将发票文件拖到下方区域。' }}</DialogDescription>
        </div>
        <DialogClose as-child><Button variant="ghost" size="icon" class="import-dialog-close" aria-label="关闭导入窗口"><X :size="16" /></Button></DialogClose>
      </DialogHeader>

      <div v-if="isImporting" class="import-dialog-progress" aria-live="polite">
        <div class="import-progress-heading">
          <div>
            <strong>{{ progress ? progress.phase === 'prepare' ? '正在准备识别模型' : progress.phase === 'structuring-downloading' ? '正在下载结构化模型' : progress.phase === 'structuring' ? '正在整理票据字段' : '正在识别发票' : '正在准备导入' }}</strong>
            <span>{{ progress?.fileName || '正在读取所选文件…' }}</span>
          </div>
          <b>{{ progressPercent }}%</b>
        </div>
        <div class="import-progress-track"><span :style="{ width: `${progressPercent}%` }"></span></div>
        <div class="import-progress-meta"><span>已处理 {{ progress?.current ?? 0 }} / {{ progress?.total ?? '—' }} 张</span><span>{{ progress?.phase === 'structuring-downloading' ? '首次使用时下载，完成后复用本机缓存' : progress?.phase === 'structuring' ? '本地模型处理中' : '识别在后台继续' }}</span></div>
      </div>

      <div v-else>
        <div
          :class="['import-dropzone', { 'drag-over': isImportDragOver }]"
          @dragenter="handleImportDragOver"
          @dragover="handleImportDragOver"
          @dragleave="handleImportDragLeave"
          @drop="handleImportDrop"
        >
          <div class="import-dropzone-icon"><FileImage :size="20" /></div>
          <strong>拖放发票图片到这里</strong>
          <span>支持 JPG、PNG、WEBP、BMP、TIFF，可多选</span>
          <Button variant="outline" @click="importFiles"><FolderOpen :size="14" />选择发票文件</Button>
        </div>
        <p v-if="importError" class="import-error" role="alert">{{ importError }}</p>
        <p v-if="importWarning" class="import-warning" role="status">{{ importWarning }}</p>
      </div>
    </DialogContent>
  </Dialog>
</template>
