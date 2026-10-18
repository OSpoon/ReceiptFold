<script setup lang="ts">
import { reactive } from 'vue'
import { Check, Plus, X } from '@lucide/vue'
import type { InvoiceExtraField, InvoiceLineItem, InvoicePatch } from '../../../../common/contracts'
import { invoiceCategories } from '../../../../common/contracts'
import { faceAmountFields, faceMetadataFields, facePersonFields, itemFields, partyFields, partySections } from '@/composables/invoiceFields'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const props = defineProps<{ modelValue: InvoicePatch; isSaving: boolean }>()
const emit = defineEmits<{
  cancel: []
  submit: [patch: InvoicePatch]
}>()

const form = reactive(JSON.parse(JSON.stringify(props.modelValue)) as InvoicePatch)

function addItem(): void {
  const item: InvoiceLineItem = { name: '', specification: '', unit: '', quantity: '', unitPrice: '', amount: '', taxRate: '', taxAmount: '' }
  form.details.items.push(item)
}

function removeItem(index: number): void {
  form.details.items.splice(index, 1)
}

function addExtraField(): void {
  const field: InvoiceExtraField = { label: '', value: '' }
  form.details.extraFields.push(field)
}

function removeExtraField(index: number): void {
  form.details.extraFields.splice(index, 1)
}

function submitForm(): void {
  emit('submit', JSON.parse(JSON.stringify(form)) as InvoicePatch)
}

</script>

<template>
  <form class="detail-form" autocomplete="off" @submit.prevent="submitForm">
    <div class="detail-section-heading">
      <div><h3>完整票面信息</h3><p>逐项核对识别结果后保存</p></div>
      <Button type="button" variant="ghost" size="sm" class="text-button" @click="emit('cancel')">取消</Button>
    </div>

    <FieldSet class="detail-form-section">
      <FieldLegend variant="label">基础信息</FieldLegend>
      <FieldGroup class="form-grid">
        <Field class="form-field">
          <FieldLabel for="invoice-date">开票日期</FieldLabel>
          <DatePicker id="invoice-date" v-model="form.date" />
        </Field>
        <Field class="form-field">
          <FieldLabel for="invoice-number">发票号码</FieldLabel>
          <Input id="invoice-number" v-model="form.invoiceNumber" placeholder="填写号码" />
        </Field>
      </FieldGroup>
      <FieldGroup class="form-grid">
        <Field v-for="field in faceMetadataFields" :key="field.key" class="form-field">
          <FieldLabel :for="`invoice-${field.key}`">{{ field.label }}</FieldLabel>
          <Input :id="`invoice-${field.key}`" v-model="form.details[field.key]" />
        </Field>
      </FieldGroup>
      <FieldGroup class="form-grid">
        <Field class="form-field">
          <FieldLabel for="invoice-amount">价税合计（元）</FieldLabel>
          <Input id="invoice-amount" v-model.number="form.amount" type="number" min="0" step="0.01" placeholder="0.00" />
          <FieldDescription>金额不能小于 0。</FieldDescription>
        </Field>
        <Field class="form-field">
          <FieldLabel for="invoice-category">类别</FieldLabel>
          <Select v-model:model-value="form.category">
            <SelectTrigger id="invoice-category" class="form-select-trigger" aria-label="类别"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem v-for="category in invoiceCategories" :key="category" :value="category">{{ category }}</SelectItem></SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </FieldSet>

    <FieldSet v-for="party in partySections" :key="party.key" class="detail-form-section">
      <FieldLegend variant="label">{{ party.label }}信息</FieldLegend>
      <FieldGroup class="form-grid">
        <Field v-for="field in partyFields" :key="field.key" class="form-field">
          <FieldLabel :for="`${party.key}-${field.key}`">{{ field.label }}</FieldLabel>
          <Input :id="`${party.key}-${field.key}`" v-model="form.details[party.key][field.key]" />
        </Field>
      </FieldGroup>
    </FieldSet>

    <FieldSet class="detail-form-section">
      <FieldLegend variant="label">金额与税额</FieldLegend>
      <FieldGroup class="form-grid">
        <Field v-for="field in faceAmountFields" :key="field.key" class="form-field">
          <FieldLabel :for="`amount-${field.key}`">{{ field.label }}</FieldLabel>
          <Input :id="`amount-${field.key}`" v-model="form.details[field.key]" />
        </Field>
      </FieldGroup>
    </FieldSet>

    <FieldSet class="detail-form-section detail-form-repeat-section">
      <FieldLegend variant="label" class="sr-only">项目明细（{{ form.details.items.length }}）</FieldLegend>
      <div class="detail-form-repeat-heading">
        <h3 aria-hidden="true">项目明细（{{ form.details.items.length }}）</h3>
        <Button type="button" variant="ghost" size="sm" class="text-button" @click="addItem"><Plus :size="13" />添加明细</Button>
      </div>
      <FieldSet v-for="(item, index) in form.details.items" :key="index" class="item-edit-card">
        <FieldLegend variant="label" class="sr-only">明细 {{ index + 1 }}</FieldLegend>
        <div class="item-edit-card-heading">
          <h4 aria-hidden="true">明细 {{ index + 1 }}</h4>
          <Button variant="outline" size="icon" class="item-remove" type="button" :aria-label="`删除明细 ${index + 1}`" @click="removeItem(index)"><X :size="13" /></Button>
        </div>
        <FieldGroup class="form-grid">
          <Field v-for="field in itemFields" :key="field.key" class="form-field">
            <FieldLabel :for="`item-${index}-${field.key}`">{{ field.label }}</FieldLabel>
            <Input :id="`item-${index}-${field.key}`" v-model="item[field.key]" />
          </Field>
        </FieldGroup>
      </FieldSet>
      <div v-if="!form.details.items.length" class="empty-detail">未识别到明细，可手动添加。</div>
    </FieldSet>

    <FieldSet class="detail-form-section">
      <FieldLegend variant="label">备注与开票人员</FieldLegend>
      <FieldGroup class="form-grid">
        <Field v-for="field in facePersonFields" :key="field.key" class="form-field">
          <FieldLabel :for="`person-${field.key}`">{{ field.label }}</FieldLabel>
          <Input :id="`person-${field.key}`" v-model="form.details[field.key]" />
        </Field>
      </FieldGroup>
      <Field class="form-field">
        <FieldLabel for="invoice-remarks">票面备注</FieldLabel>
        <Textarea id="invoice-remarks" v-model="form.details.remarks" rows="3" placeholder="发票票面备注" />
      </Field>
      <Field class="form-field">
        <FieldLabel for="invoice-note">内部备注</FieldLabel>
        <Textarea id="invoice-note" v-model="form.note" rows="2" placeholder="添加用途或报销说明…" />
      </Field>
    </FieldSet>

    <FieldSet class="detail-form-section detail-form-repeat-section">
      <FieldLegend variant="label" class="sr-only">其他票面字段（{{ form.details.extraFields.length }}）</FieldLegend>
      <div class="detail-form-repeat-heading">
        <h3 aria-hidden="true">其他票面字段（{{ form.details.extraFields.length }}）</h3>
        <Button type="button" variant="ghost" size="sm" class="text-button" @click="addExtraField"><Plus :size="13" />添加字段</Button>
      </div>
      <FieldGroup v-for="(field, index) in form.details.extraFields" :key="index" class="form-grid extra-edit-row">
        <Field class="form-field">
          <FieldLabel :for="`extra-label-${index}`">字段名</FieldLabel>
          <Input :id="`extra-label-${index}`" v-model="field.label" />
        </Field>
        <Field class="form-field">
          <FieldLabel :for="`extra-value-${index}`">内容</FieldLabel>
          <Input :id="`extra-value-${index}`" v-model="field.value" />
        </Field>
        <Button variant="ghost" size="icon" class="item-remove" type="button" :aria-label="`删除其他字段 ${index + 1}`" @click="removeExtraField(index)"><X :size="13" /></Button>
      </FieldGroup>
    </FieldSet>
    <Field class="form-field">
      <FieldLabel for="invoice-qr-content">二维码内容</FieldLabel>
      <Textarea id="invoice-qr-content" v-model="form.details.qrCodeText" rows="2" placeholder="未检测到二维码内容" />
    </Field>

    <Button class="save-button" type="submit" :disabled="isSaving"><Check :size="16" />{{ isSaving ? '正在保存…' : '保存并归档' }}</Button>
  </form>
</template>
