<script setup lang="ts">
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ modelValue?: string | number; modelModifiers?: Record<string, boolean>; class?: string }>(), { modelValue: '' })
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()

function updateValue(event: Event): void {
  let value: string | number = (event.target as HTMLInputElement).value
  if (props.modelModifiers?.trim && typeof value === 'string') value = value.trim()
  if (props.modelModifiers?.number && typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) value = parsed
  }
  emit('update:modelValue', value)
}
</script>

<template>
  <input :value="modelValue" :class="cn('flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20', props.class)" v-bind="$attrs" @input="updateValue" />
</template>
