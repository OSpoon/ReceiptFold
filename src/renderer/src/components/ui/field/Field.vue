<script setup lang="ts">
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  orientation?: 'vertical' | 'horizontal' | 'responsive'
  invalid?: boolean
  class?: string
}>(), { orientation: 'vertical', invalid: false })
</script>

<template>
  <div
    role="group"
    :data-slot="'field'"
    :data-orientation="props.orientation"
    :data-invalid="props.invalid ? '' : undefined"
    :class="cn('ui-field', props.class)"
    v-bind="$attrs"
  >
    <slot />
  </div>
</template>
