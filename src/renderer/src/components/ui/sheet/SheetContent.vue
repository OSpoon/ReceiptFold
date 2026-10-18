<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal } from 'reka-ui'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ side?: 'top' | 'right' | 'bottom' | 'left'; class?: string }>(), { side: 'right' })
const sideClasses = {
  right: 'inset-y-0 right-0 h-full border-l',
  left: 'inset-y-0 left-0 h-full border-r',
  top: 'inset-x-0 top-0 border-b',
  bottom: 'inset-x-0 bottom-0 border-t'
} as const
</script>

<template>
  <DialogPortal>
    <DialogOverlay class="sheet-overlay" />
    <DialogContent :class="cn('sheet-content fixed z-50 flex flex-col gap-0 bg-background shadow-xl outline-none', sideClasses[side], props.class)" v-bind="$attrs">
      <slot />
    </DialogContent>
  </DialogPortal>
</template>
