<script setup lang="ts">
import { cn } from '@/lib/utils'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template><tbody :class="cn('[&_tr:last-child]:border-0', props.class)" v-bind="$attrs"><slot /></tbody></template>
