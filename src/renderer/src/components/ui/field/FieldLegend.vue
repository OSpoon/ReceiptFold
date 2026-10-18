<script setup lang="ts">
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ variant?: 'legend' | 'label'; class?: string }>(), { variant: 'legend' })
</script>

<template>
  <legend :data-slot="'field-legend'" :data-variant="props.variant" :class="cn('ui-field-legend', props.class)" v-bind="$attrs"><slot /></legend>
</template>
