import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'

export default async function ContactUsPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const setting = await prisma.platformSetting.findUnique({ where: { key: 'contact_us' } })
  let contact: { phone?: string; email?: string; emails?: string[]; address?: string; notes?: string } | null = null
  if (setting) {
    try { contact = JSON.parse(setting.value) } catch { contact = null }
  }

  const emailList: string[] = contact?.emails?.length
    ? contact.emails
    : contact?.email
      ? contact.email.split(',').map((e: string) => e.trim()).filter(Boolean)
      : []

  const hasContent = contact && (contact.phone || emailList.length > 0 || contact.address || contact.notes)

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <Link href="/profile" className="text-sm text-primary-600 mb-4 inline-block">&larr; Back</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Contact Us</h1>
      <p className="text-sm text-gray-500 mb-6">Get in touch with the platform administrator</p>

      {!hasContent ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-500">No contact information available yet.</p>
        </div>
      ) : (
        <div className="card p-4 space-y-4">
          {contact!.phone && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Phone</p>
                <a href={`tel:${contact!.phone}`} className="text-sm text-primary-600 font-medium">
                  {contact!.phone}
                </a>
              </div>
            </div>
          )}

          {emailList.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                {emailList.map((email) => (
                  <a key={email} href={`mailto:${email}`} className="block text-sm text-primary-600 font-medium">
                    {email}
                  </a>
                ))}
              </div>
            </div>
          )}

          {contact!.address && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Address</p>
                <p className="text-sm text-gray-900 whitespace-pre-line">{contact!.address}</p>
              </div>
            </div>
          )}

          {contact!.notes && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Additional Information</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{contact!.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
