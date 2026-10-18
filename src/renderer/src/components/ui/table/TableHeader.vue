<script setup lang="ts">
import { cn } from '@/lib/utils'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template><thead :class="cn('[&_tr]:border-b', props.class)" v-bind="$attrs"><slot /></thead></template>
