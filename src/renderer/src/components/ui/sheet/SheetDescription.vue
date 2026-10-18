<script setup lang="ts">
import { DialogDescription } from 'reka-ui'
import { cn } from '@/lib/utils'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template><DialogDescription :class="cn('text-sm text-muted-foreground', props.class)" v-bind="$attrs"><slot /></DialogDescription></template>
