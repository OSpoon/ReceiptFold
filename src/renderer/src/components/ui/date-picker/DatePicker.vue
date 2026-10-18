<script setup lang="ts">
import { computed } from 'vue'
import { parseDate, type DateValue } from '@internationalized/date'
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'
import {
  DatePickerCalendar,
  DatePickerCell,
  DatePickerCellTrigger,
  DatePickerClose,
  DatePickerContent,
  DatePickerGrid,
  DatePickerGridBody,
  DatePickerGridHead,
  DatePickerGridRow,
  DatePickerHeadCell,
  DatePickerHeader,
  DatePickerHeading,
  DatePickerNext,
  DatePickerPrev,
  DatePickerRoot,
  DatePickerTrigger
} from 'reka-ui'
import { Button } from '@/components/ui/button'

const props = defineProps<{ modelValue?: string; id?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const selectedDate = computed<DateValue | undefined>({
  get() {
    const value = props.modelValue
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined

    try {
      return parseDate(value)
    } catch {
      return undefined
    }
  },
  set(value) {
    emit('update:modelValue', value?.toString() ?? '')
  }
})

const displayDate = computed(() => selectedDate.value?.toString().replaceAll('-', '/') ?? '选择日期')
</script>

<template>
  <div class="date-picker-root">
    <DatePickerRoot v-model="selectedDate" locale="zh-CN" :week-starts-on="1" :close-on-select="true">
      <DatePickerTrigger as-child>
        <Button :id="props.id" variant="outline" class="date-picker-trigger" :aria-label="`开票日期：${displayDate}`">
          <span>{{ displayDate }}</span>
          <CalendarDays :size="14" aria-hidden="true" />
        </Button>
      </DatePickerTrigger>
      <DatePickerContent class="date-picker-content" align="start" :side-offset="4" :collision-padding="{ top: 54, bottom: 42 }">
        <DatePickerCalendar v-slot="{ weekDays, grid }" class="date-picker-calendar">
          <DatePickerHeader class="date-picker-header">
            <DatePickerPrev as-child>
              <Button variant="ghost" size="icon" class="date-picker-nav" aria-label="上个月"><ChevronLeft :size="15" /></Button>
            </DatePickerPrev>
            <DatePickerHeading class="date-picker-heading" />
            <DatePickerNext as-child>
              <Button variant="ghost" size="icon" class="date-picker-nav" aria-label="下个月"><ChevronRight :size="15" /></Button>
            </DatePickerNext>
          </DatePickerHeader>
          <DatePickerGrid v-for="month in grid" :key="month.value.toString()" class="date-picker-grid">
            <DatePickerGridHead>
              <DatePickerGridRow>
                <DatePickerHeadCell v-for="day in weekDays" :key="day" class="date-picker-weekday">{{ day }}</DatePickerHeadCell>
              </DatePickerGridRow>
            </DatePickerGridHead>
            <DatePickerGridBody>
              <DatePickerGridRow v-for="(week, weekIndex) in month.rows" :key="weekIndex">
                <DatePickerCell v-for="day in week" :key="day.toString()" :date="day" class="date-picker-cell">
                  <DatePickerCellTrigger :day="day" :month="month.value" class="date-picker-day" />
                </DatePickerCell>
              </DatePickerGridRow>
            </DatePickerGridBody>
          </DatePickerGrid>
          <div class="date-picker-footer">
            <DatePickerClose as-child>
              <Button variant="ghost" size="sm" class="date-picker-clear" @click="selectedDate = undefined">清除日期</Button>
            </DatePickerClose>
          </div>
        </DatePickerCalendar>
      </DatePickerContent>
    </DatePickerRoot>
  </div>
</template>
