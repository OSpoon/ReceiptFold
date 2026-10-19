<script setup lang="ts">
import { Download, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppUpdates } from '@/composables/useAppUpdates'

const { appInfo, updateStatus, isUpdateDialogOpen, openReleasePage, dismissUpdateDialog } = useAppUpdates()
</script>

<template>
  <Dialog v-model:open="isUpdateDialogOpen">
    <DialogContent class="update-dialog">
      <DialogHeader class="update-dialog-header">
        <div class="update-dialog-icon"><Download :size="17" /></div>
        <div class="update-dialog-heading">
          <DialogTitle>发现新版本 v{{ updateStatus.phase === 'available' ? updateStatus.version : '' }}</DialogTitle>
          <DialogDescription>发票夹 v{{ appInfo?.version }} 有新版本可用。前往 GitHub Releases 下载后，打开安装包完成更新。</DialogDescription>
        </div>
        <DialogClose as-child><Button variant="ghost" size="icon" class="update-dialog-close" aria-label="稍后更新" @click="dismissUpdateDialog"><X :size="16" /></Button></DialogClose>
      </DialogHeader>
      <div class="update-dialog-note">macOS 版本需要手动下载并安装更新。</div>
      <DialogFooter class="update-dialog-footer">
        <DialogClose as-child><Button variant="outline" @click="dismissUpdateDialog">稍后</Button></DialogClose>
        <Button @click="openReleasePage"><Download :size="14" />前往 GitHub Releases</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
