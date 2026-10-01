import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import FaqAccordion from './FaqAccordion'

export default async function FaqPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const setting = await prisma.platformSetting.findUnique({ where: { key: 'faq' } })
  let faqs: { question: string; answer: string }[] = []
  if (setting) {
    try { faqs = JSON.parse(setting.value) } catch { faqs = [] }
  }

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
        <FaqAccordion faqs={faqs} />
      )}
    </div>
  )
}
