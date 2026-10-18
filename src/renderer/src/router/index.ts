import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import InvoiceLibraryPage from '../pages/InvoiceLibraryPage.vue'
import ReviewPage from '../pages/ReviewPage.vue'
import SettingsPage from '../pages/SettingsPage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', redirect: { name: 'all' } },
      { path: 'invoices', name: 'all', component: InvoiceLibraryPage, meta: { title: '发票库' } },
      { path: 'review', name: 'review', component: ReviewPage, meta: { title: '待核对', description: '点开任意发票即可核对完整票面信息。' } },
      { path: 'settings', name: 'settings', component: SettingsPage, meta: { title: '设置', description: '调整外观、识别模型和应用更新。' } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'all' } }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
