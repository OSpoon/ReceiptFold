<script setup lang="ts">
import { CircleDollarSign, Clock3, FileCheck2, Inbox } from '@lucide/vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { compactMoney } from '@/composables/useFormatters'
import { useInvoiceLibrary } from '@/composables/useInvoiceLibrary'

const { invoices, monthTotal, cumulativeTotal, reviewCount } = useInvoiceLibrary()
</script>

<template>
  <section class="stats-grid" aria-label="发票统计">
    <Card class="stat-card stat-highlight">
      <CardHeader class="stat-head"><CardTitle>本月金额</CardTitle><span class="stat-icon"><FileCheck2 :size="16" /></span></CardHeader>
      <CardContent class="stat-content"><div class="stat-value stat-money">{{ compactMoney(monthTotal) }}</div></CardContent>
    </Card>
    <Card class="stat-card">
      <CardHeader class="stat-head"><CardTitle>累计金额</CardTitle><span class="stat-icon muted"><CircleDollarSign :size="16" /></span></CardHeader>
      <CardContent class="stat-content"><div class="stat-value stat-money">{{ compactMoney(cumulativeTotal) }}</div></CardContent>
    </Card>
    <Card class="stat-card">
      <CardHeader class="stat-head"><CardTitle>发票总数</CardTitle><span class="stat-icon muted"><Inbox :size="16" /></span></CardHeader>
      <CardContent class="stat-content"><div class="stat-value">{{ invoices.length }}<small> 张</small></div></CardContent>
    </Card>
    <Card class="stat-card">
      <CardHeader class="stat-head"><CardTitle>待核对</CardTitle><span class="stat-icon amber"><Clock3 :size="16" /></span></CardHeader>
      <CardContent class="stat-content"><div class="stat-value">{{ reviewCount }}<small> 张</small></div></CardContent>
    </Card>
  </section>
</template>
