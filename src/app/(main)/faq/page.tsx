import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import FaqAccordion from './FaqAccordion'
import { Role } from '@/lib/constants'

const CATEGORY_ORDER = ['admin', 'collection', 'security', 'others']
const CATEGORY_LABELS: Record<string, string> = {
  admin: 'Admin Related Tasks',
  collection: 'Collection Related Tasks',
  security: 'Password, Access & Data Security',
  others: 'Others',
}

export default async function FaqPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const setting = await prisma.platformSetting.findUnique({ where: { key: 'faq' } })
  let faqs: { question: string; answer: string; category?: string }[] = []
  if (setting) {
    try { faqs = JSON.parse(setting.value) } catch { faqs = [] }
  }

  const isAgent = user.role === Role.AGENT
  const visibleCategories = isAgent
    ? ['collection', 'security', 'others']
    : ['admin', 'collection', 'security', 'others']

  const grouped = CATEGORY_ORDER
    .filter(cat => visibleCategories.includes(cat))
    .map(cat => ({
      key: cat,
      label: CATEGORY_LABELS[cat],
      items: faqs.filter(f => (f.category || 'others') === cat),
    }))
    .filter(g => g.items.length > 0)

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <Link href="/profile" className="text-sm text-primary-600 mb-4 inline-block">&larr; Back</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-1">FAQ</h1>
      <p className="text-sm text-gray-500 mb-6">Frequently asked questions</p>

      {faqs.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-500">No FAQs available yet.</p>
        </div>
      ) : (
        <FaqAccordion grouped={grouped} />
      )}
    </div>
  )
}
