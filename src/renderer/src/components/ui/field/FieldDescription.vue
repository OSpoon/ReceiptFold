<script setup lang="ts">
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template>
  <p data-slot="field-description" :class="cn('ui-field-description', props.class)" v-bind="$attrs"><slot /></p>
</template>
