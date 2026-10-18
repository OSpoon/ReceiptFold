<script setup lang="ts">
import { DialogRoot } from 'reka-ui'

defineOptions({ inheritAttrs: false })
defineProps<{ open?: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
</script>

<template><DialogRoot :open="open" v-bind="$attrs" @update:open="emit('update:open', $event)"><slot /></DialogRoot></template>
