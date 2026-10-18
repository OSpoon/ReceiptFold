<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })

const badgeVariants = cva('inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 [&>svg]:pointer-events-none [&>svg]:size-3', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      destructive: 'border-transparent bg-destructive text-white',
      outline: 'border-border text-foreground'
    }
  },
  defaultVariants: { variant: 'default' }
})

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>
const props = withDefaults(defineProps<{ variant?: BadgeVariant; class?: ClassValue }>(), { variant: 'default' })
</script>

<template><span :class="cn(badgeVariants({ variant }), props.class)" v-bind="$attrs"><slot /></span></template>
