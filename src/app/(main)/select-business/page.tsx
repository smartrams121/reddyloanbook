import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'

export default async function SelectBusinessPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const businesses = await prisma.business.findMany({
    where: {
      id: { in: user.businessIds },
      isActive: true,
    },
    orderBy: { name: 'asc' },
  })

  if (businesses.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-gray-500">No businesses assigned to your account.</p>
        <p className="text-sm text-gray-400 mt-2">Contact your administrator.</p>
      </div>
    )
  }

  if (businesses.length === 1) {
    redirect(`/b/${businesses[0].id}/dashboard`)
  }

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Select Collection</h1>
      <p className="text-sm text-gray-500 mb-6">Choose a business to work in</p>

      <div className="space-y-3">
        {businesses.map((biz) => (
          <Link
            key={biz.id}
            href={`/b/${biz.id}/dashboard`}
            className="card p-4 block hover:border-primary-300 transition-colors"
          >
            <h3 className="font-semibold text-gray-900">{biz.name}</h3>
            <p className="text-sm text-gray-500">{biz.city} &middot; {biz.collectionType}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
