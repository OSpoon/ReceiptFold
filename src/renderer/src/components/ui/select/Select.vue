<script setup lang="ts">
import { SelectRoot } from 'reka-ui'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <SelectRoot :model-value="props.modelValue" :disabled="props.disabled" v-bind="$attrs" @update:model-value="emit('update:modelValue', String($event))">
    <slot />
  </SelectRoot>
</template>
