<script setup lang="ts">
import { Check } from '@lucide/vue'

defineProps<{ message: string }>()
</script>

<template>
  <Transition name="toast">
    <div v-if="message" class="toast-message"><span class="toast-check"><Check :size="15" /></span>{{ message }}</div>
  </Transition>
</template>
