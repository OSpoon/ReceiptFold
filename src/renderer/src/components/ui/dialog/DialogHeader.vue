<script setup lang="ts">
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template><div :class="cn('dialog-header', props.class)" v-bind="$attrs"><slot /></div></template>
