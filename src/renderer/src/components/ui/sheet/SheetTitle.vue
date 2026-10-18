<script setup lang="ts">
import { DialogTitle } from 'reka-ui'
import { cn } from '@/lib/utils'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template><DialogTitle :class="cn('text-base font-semibold text-foreground', props.class)" v-bind="$attrs"><slot /></DialogTitle></template>
