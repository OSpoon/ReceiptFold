<script setup lang="ts">
import { SelectContent as SelectContentPrimitive, SelectPortal, SelectViewport } from 'reka-ui'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <SelectPortal>
    <SelectContentPrimitive class="ui-select-content" position="popper" :side-offset="4" v-bind="$attrs">
      <SelectViewport class="ui-select-viewport"><slot /></SelectViewport>
    </SelectContentPrimitive>
  </SelectPortal>
</template>
