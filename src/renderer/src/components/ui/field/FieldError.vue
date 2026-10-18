<script setup lang="ts">
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ errors?: string[]; class?: string }>()
</script>

<template>
  <p v-if="props.errors?.length || $slots.default" data-slot="field-error" :class="cn('ui-field-error', props.class)" v-bind="$attrs">
    {{ props.errors?.[0] }}<slot />
  </p>
</template>
