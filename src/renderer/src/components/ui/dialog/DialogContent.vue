<script setup lang="ts">
import { DialogContent as DialogContentPrimitive, DialogOverlay, DialogPortal } from 'reka-ui'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template>
  <DialogPortal>
    <DialogOverlay class="dialog-overlay" />
    <DialogContentPrimitive :class="cn('dialog-content', props.class)" v-bind="$attrs"><slot /></DialogContentPrimitive>
  </DialogPortal>
</template>
