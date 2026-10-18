<script setup lang="ts">
import { Check } from '@lucide/vue'
import { SelectItem as SelectItemPrimitive, SelectItemIndicator, SelectItemText } from 'reka-ui'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ value: string; disabled?: boolean; textValue?: string }>()
</script>

<template>
  <SelectItemPrimitive :value="props.value" :disabled="props.disabled" :text-value="props.textValue" class="ui-select-item" v-bind="$attrs">
    <SelectItemText><slot /></SelectItemText>
    <SelectItemIndicator class="ui-select-item-indicator"><Check :size="13" /></SelectItemIndicator>
  </SelectItemPrimitive>
</template>
