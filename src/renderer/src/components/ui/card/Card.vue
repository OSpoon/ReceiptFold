<script setup lang="ts">
import { cn } from '@/lib/utils'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template><div :class="cn('rounded-xl border bg-card text-card-foreground shadow-sm', props.class)" v-bind="$attrs"><slot /></div></template>
