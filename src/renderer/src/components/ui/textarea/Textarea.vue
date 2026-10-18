<script setup lang="ts">
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ modelValue?: string; class?: string }>(), { modelValue: '' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <textarea :value="modelValue" :class="cn('flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50', props.class)" v-bind="$attrs" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" />
</template>
