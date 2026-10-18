<script setup lang="ts">
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template>
  <fieldset data-slot="field-set" :class="cn('ui-field-set', props.class)" v-bind="$attrs"><slot /></fieldset>
</template>
