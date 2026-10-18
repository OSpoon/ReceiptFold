<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { SelectIcon, SelectTrigger } from 'reka-ui'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ class?: string }>()
</script>

<template>
  <SelectTrigger :class="['ui-select-trigger', props.class]" v-bind="$attrs">
    <slot />
    <SelectIcon class="ui-select-icon"><ChevronDown :size="14" /></SelectIcon>
  </SelectTrigger>
</template>
