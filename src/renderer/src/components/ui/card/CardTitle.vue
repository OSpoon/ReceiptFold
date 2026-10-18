<script setup lang="ts">
import { cn } from '@/lib/utils'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template><h3 :class="cn('text-sm font-medium leading-none tracking-tight', props.class)" v-bind="$attrs"><slot /></h3></template>
