<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

withDefaults(defineProps<{
  modelValue: boolean
  disabled?: boolean
  ariaLabel?: string
}>(), { disabled: false })

const emit = defineEmits<{
  'update:modelValue': [checked: boolean]
}>()
</script>

<template>
  <SwitchRoot
    :model-value="modelValue"
    :disabled="disabled"
    :aria-label="ariaLabel"
    class="ui-switch"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <SwitchThumb class="ui-switch-thumb" />
  </SwitchRoot>
</template>
