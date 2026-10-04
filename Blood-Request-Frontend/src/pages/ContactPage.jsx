import { Suspense, lazy, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { LoaderCircle, Mail, MapPin, Maximize2, Minimize2, Phone, Send } from 'lucide-react'
import { useLanguage } from '../context/useLanguage'
import { storedMapProvider, storeMapProvider } from '../lib/mapProvider'
import FormField from '../components/FormField'

const ContactMap = lazy(() => import('../components/ContactMap'))

import PageHeader from '../components/PageHeader'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[6-9]\d{9}$/

const INITIAL_VALUES = { name: '', email: '', phone: '', message: '' }

export default function ContactPage() {
  const { t } = useLanguage()
  const [values, setValues] = useState(INITIAL_VALUES)
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mapProvider, setMapProvider] = useState(() => storedMapProvider())

  function switchMapProvider(p) {
    setMapProvider(p)
    storeMapProvider(p)
  }

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [isFullscreen])

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  function validate() {
    const next = {}
    const name = values.name.trim()
    if (!name) {
      next.name = t('err.required')
    } else if (name.length < 2) {
      next.name = t('err.patientName')
    }
    if (!EMAIL_RE.test(values.email.trim())) {
      next.email = t('err.emailInvalid')
    }
    const phone = values.phone.trim()
    if (phone && !PHONE_RE.test(phone)) {
      next.phone = t('err.phoneInvalid')
    }
    if (values.message.trim().length < 10) {
      next.message = t('err.messageShort')
    }
    return next
  }

  function handleSubmit(e) {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSending(true)
    setTimeout(() => {
      toast.success(t('toast.contactSent'))
      setValues(INITIAL_VALUES)
      setErrors({})
      setSending(false)
    }, 800)
  }

  const infoRows = [
    {
      icon: Phone,
      label: t('contact.phoneLabel'),
      content: <a href="tel:+914440001234">{t('contact.phoneValue')}</a>,
    },
    {
      icon: Mail,
      label: t('contact.emailLabel'),
      content: (
        <a href={`mailto:${t('contact.emailValue')}`}>{t('contact.emailValue')}</a>
      ),
    },
    {
      icon: MapPin,
      label: t('contact.addressLabel'),
      content: <span>{t('contact.addressValue')}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        icon={Mail}
        title={t('contact.pageTitle')}
        description={t('contact.pageSub')}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card animate-fade-in-up p-5 sm:p-7 lg:col-span-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('contact.formTitle')}
          </h3>
          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
            <FormField
              label={t('contact.name')}
              htmlFor="contact-name"
              required
              error={errors.name}
            >
              <input
                id="contact-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder={t('contact.phName')}
                value={values.name}
                onChange={(e) => setField('name', e.target.value)}
                className={`input-base ${errors.name ? 'input-error' : ''}`}
              />
            </FormField>
            <FormField
              label={t('contact.email')}
              htmlFor="contact-email"
              required
              error={errors.email}
            >
              <input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t('contact.phEmail')}
                value={values.email}
                onChange={(e) => setField('email', e.target.value)}
                className={`input-base ${errors.email ? 'input-error' : ''}`}
              />
            </FormField>
            <FormField
              label={t('contact.phone')}
              htmlFor="contact-phone"
              error={errors.phone}
            >
              <input
                id="contact-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder={t('contact.phPhone')}
                value={values.phone}
                onChange={(e) =>
                  setField('phone', e.target.value.replace(/\D/g, ''))
                }
                className={`input-base ${errors.phone ? 'input-error' : ''}`}
              />
            </FormField>
            <FormField
              label={t('contact.message')}
              htmlFor="contact-message"
              required
              error={errors.message}
            >
              <textarea
                id="contact-message"
                name="message"
                rows={5}
                placeholder={t('contact.phMessage')}
                value={values.message}
                onChange={(e) => setField('message', e.target.value)}
                className={`input-base resize-y ${errors.message ? 'input-error' : ''}`}
              />
            </FormField>
            <button
              type="submit"
              disabled={sending}
              className="btn-primary w-full sm:w-auto"
            >
              {sending ? (
                <>
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  {t('btn.sending')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {t('btn.send')}
                </>
              )}
            </button>
          </form>
        </section>

        <div className="space-y-5 lg:col-span-2">
          <section className="card animate-fade-in-up p-5 sm:p-7">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('contact.infoTitle')}
            </h3>
            <div className="mt-4 space-y-4">
              {infoRows.map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                    <row.icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                      {row.label}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                      {row.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-700">
            <div className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-3 dark:bg-slate-900">
              <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <MapPin className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                <span className="truncate">{t('contact.mapTitle')}</span>
              </p>
              <div
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
                role="group"
                aria-label={t('map.provider')}
              >
                <button
                  type="button"
                  onClick={() => switchMapProvider('osm')}
                  aria-pressed={mapProvider === 'osm'}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                    mapProvider === 'osm'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {t('map.osm')}
                </button>
                <button
                  type="button"
                  onClick={() => switchMapProvider('google')}
                  aria-pressed={mapProvider === 'google'}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                    mapProvider === 'google'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {t('map.google')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                title={t('map.fullscreen')}
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t('map.fullscreen')}
              </button>
            </div>
            {mapProvider === 'google' ? (
              <Suspense
                fallback={
                  <div className="flex w-full items-center justify-center px-6 py-12">
                    <span className="text-sm text-slate-500">{t('map.googleLoading')}</span>
                  </div>
                }
              >
                <ContactMap heightClass="h-64" onUseOsm={() => switchMapProvider('osm')} />
              </Suspense>
            ) : (
              <iframe
                title={t('contact.mapTitle')}
                src="https://www.openstreetmap.org/export/embed.html?bbox=80.24%2C13.06%2C80.30%2C13.10&layer=mapnik&marker=13.0810%2C80.2694"
                className="h-64 w-full border-0"
                loading="lazy"
              />
            )}
          </div>
        </div>
      </div>

      {isFullscreen ? (
        <div className="fixed inset-0 z-[200] flex flex-col bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-xl bg-white px-4 py-2.5 shadow-lg dark:bg-slate-900">
            <p className="flex min-w-0 items-center gap-2 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
              <MapPin className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span className="truncate">{t('contact.mapTitle')}</span>
            </p>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            >
              <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('map.exitFullscreen')}
            </button>
          </div>
          <div className="mx-auto mt-3 w-full max-w-6xl flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {mapProvider === 'google' ? (
              <Suspense
                fallback={
                  <div className="flex w-full items-center justify-center px-6 py-12">
                    <span className="text-sm text-slate-500">{t('map.googleLoading')}</span>
                  </div>
                }
              >
                <ContactMap heightClass="h-[calc(100dvh-160px)]" onUseOsm={() => switchMapProvider('osm')} />
              </Suspense>
            ) : (
              <iframe
                title={t('contact.mapTitle')}
                src="https://www.openstreetmap.org/export/embed.html?bbox=80.24%2C13.06%2C80.30%2C13.10&layer=mapnik&marker=13.0810%2C80.2694"
                className="h-[calc(100dvh-160px)] w-full border-0"
                loading="lazy"
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
