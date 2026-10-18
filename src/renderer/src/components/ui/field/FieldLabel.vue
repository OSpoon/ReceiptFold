<script setup lang="ts">
import { Label } from 'reka-ui'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template>
  <Label data-slot="field-label" :class="cn('ui-field-label', props.class)" v-bind="$attrs"><slot /></Label>
</template>
