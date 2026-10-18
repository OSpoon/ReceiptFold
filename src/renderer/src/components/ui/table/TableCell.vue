<script setup lang="ts">
import { cn } from '@/lib/utils'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template><td :class="cn('px-3 py-3 align-middle [&:has([role=checkbox])]:pr-0', props.class)" v-bind="$attrs"><slot /></td></template>
