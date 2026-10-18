<script setup lang="ts">
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template>
  <div data-slot="field-content" :class="cn('ui-field-content', props.class)" v-bind="$attrs"><slot /></div>
</template>
