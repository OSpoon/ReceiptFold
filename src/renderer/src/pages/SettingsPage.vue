<script setup lang="ts">
import { Download, FolderOpen, LockKeyhole, RefreshCw, Sparkles } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppUpdates } from '@/composables/useAppUpdates'
import { fileSize } from '@/composables/useFormatters'
import { useInvoiceLibrary } from '@/composables/useInvoiceLibrary'
import { useOcrSettings } from '@/composables/useOcrSettings'
import { useTheme } from '@/composables/useTheme'

const { storageInfo, isImporting, isImportRequestActive } = useInvoiceLibrary()
const {
  ocrSettings,
  isLoadingOcrSettings,
  ocrSettingsError,
  selectedOcrModel,
  isSwitchingOcrModel,
  currentOcrModel,
  ocrModelPresets,
  refreshOcrSettings,
  switchOcrModel,
  openLocalFolder
} = useOcrSettings()
const { appInfo, updateStatus, updateStatusDescription, updateButtonDisabled, updateButtonLabel, handleUpdateButton } = useAppUpdates()
const { themeMode, themeOptions, setThemeMode } = useTheme()
</script>

<template>
  <section class="settings-page" aria-label="应用设置">
    <section class="settings-group">
      <div class="settings-group-heading"><div><h2>本地识别模型</h2><p>选择导入发票时使用的 RapidOCRNode 模型规格。</p></div></div>
      <Card class="settings-card model-settings-card">
        <div class="model-current-row">
          <div class="setting-product-icon"><Sparkles :size="15" /></div>
          <div class="setting-copy model-current-copy">
            <span>当前配置</span>
            <strong>{{ ocrSettings ? currentOcrModel.modelName : isLoadingOcrSettings ? '读取中…' : '读取失败' }}</strong>
            <span>{{ ocrSettings ? '导入发票使用中文检测与识别 · PP-OCRv4 Mobile 方向分类' : '无法读取当前识别模型配置。' }}</span>
          </div>
          <div class="model-storage-summary">
            <span>模型缓存占用</span>
            <strong>{{ isLoadingOcrSettings ? '读取中…' : ocrSettings ? fileSize(ocrSettings.modelStorageBytes) : '读取失败' }}</strong>
            <button v-if="ocrSettingsError" type="button" class="model-storage-retry" @click="refreshOcrSettings">重试</button>
          </div>
        </div>
        <div class="model-switch-row">
          <label class="model-select-field">
            <span>识别规格</span>
            <Select
              :model-value="selectedOcrModel"
              :disabled="!ocrSettings || isSwitchingOcrModel || isImporting || isImportRequestActive"
              @update:model-value="switchOcrModel"
            >
              <SelectTrigger aria-label="识别模型规格"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="preset in ocrModelPresets" :key="preset.value" :value="preset.value">{{ preset.label }} · {{ preset.modelName }}</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
        <div class="settings-note settings-note-with-action">
          <span class="settings-note-copy"><Download :size="15" /><span aria-live="polite">{{ isSwitchingOcrModel ? '正在切换模型…' : isImporting || isImportRequestActive ? '识别结束后可切换模型。' : '未缓存的规格会在首次识别时下载。' }}</span></span>
          <Button variant="outline" size="sm" class="folder-action-button" @click="openLocalFolder('models')"><FolderOpen :size="13" />打开模型文件夹</Button>
        </div>
      </Card>
    </section>

    <section class="settings-group">
      <div class="settings-group-heading"><div><h2>本地数据</h2><p>发票图片和识别信息只保存在这台设备上。</p></div></div>
      <Card class="settings-card">
        <div class="storage-metrics">
          <div><span>发票总数</span><strong>{{ storageInfo.invoiceCount }}<small> 张</small></strong></div>
          <div><span>待核对</span><strong>{{ storageInfo.reviewCount }}<small> 张</small></strong></div>
          <div><span>图片占用</span><strong>{{ fileSize(storageInfo.imageBytes) }}</strong></div>
        </div>
        <div class="settings-note settings-note-with-action">
          <span class="settings-note-copy"><LockKeyhole :size="15" /><span>RapidOCRNode 在本机识别发票。原图和识别结果不会上传到云端。</span></span>
          <Button variant="outline" size="sm" class="folder-action-button" @click="openLocalFolder('data')"><FolderOpen :size="13" />打开数据文件夹</Button>
        </div>
      </Card>
    </section>

    <section class="settings-group">
      <div class="settings-group-heading"><div><h2>外观</h2><p>选择发票夹的显示主题。</p></div></div>
      <Card class="settings-card">
        <div class="setting-row theme-setting-row">
          <div class="theme-options" role="group" aria-label="应用主题">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              type="button"
              :aria-pressed="themeMode === option.value"
              :class="['theme-option', { selected: themeMode === option.value }]"
              @click="setThemeMode(option.value)"
            >
              <component :is="option.icon" :size="15" /><span>{{ option.label }}</span>
            </button>
          </div>
        </div>
      </Card>
    </section>

    <section class="settings-group">
      <div class="settings-group-heading"><div><h2>应用更新</h2><p>查看当前版本并检查更新。</p></div></div>
      <Card class="settings-card">
        <div class="setting-row update-setting-row">
          <div class="setting-product-icon"><RefreshCw :size="17" /></div>
          <div class="setting-copy update-setting-copy">
            <strong>发票夹 <span>v{{ appInfo?.version ?? '…' }}</span></strong>
            <span>{{ appInfo?.packaged ? updateStatusDescription : '开发版本无法接收自动更新。' }}</span>
          </div>
          <Button v-if="appInfo?.packaged" variant="outline" class="settings-update-button" :disabled="updateButtonDisabled" aria-live="polite" @click="handleUpdateButton">
            <RefreshCw :size="14" :class="{ 'update-spinning': updateStatus.phase === 'checking' || updateStatus.phase === 'downloading' }" />
            {{ updateButtonLabel }}
          </Button>
          <span v-else class="development-badge">开发版本</span>
        </div>
      </Card>
    </section>
  </section>
</template>
