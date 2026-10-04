import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { useLanguage } from '../context/useLanguage'
import { OFFICE_CENTER, OFFICE_ZOOM, getGoogleMapsKey } from '../lib/mapProvider'

function MissingKeyNotice({ onUseOsm }) {
  const { t } = useLanguage()
  return (
    <div className="flex w-full flex-col items-center gap-2 bg-slate-50 px-6 py-12 text-center dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {t('map.keyMissingTitle')}
      </p>
      <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
        {t('map.keyMissing')}
      </p>
      {onUseOsm ? (
        <button
          type="button"
          onClick={onUseOsm}
          className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
        >
          {t('map.useOsm')}
        </button>
      ) : null}
    </div>
  )
}

function GoogleMapInner({ heightClass, apiKey, onUseOsm }) {
  const { t } = useLanguage()
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'contact-gmap',
    googleMapsApiKey: apiKey,
  })

  if (loadError) {
    return (
      <div className="flex w-full flex-col items-center gap-2 bg-slate-50 px-6 py-12 text-center dark:bg-slate-900">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('map.keyMissingTitle')}
        </p>
        <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
          {String(loadError.message || loadError)}
        </p>
        {onUseOsm ? (
          <button
            type="button"
            onClick={onUseOsm}
            className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
          >
            {t('map.useOsm')}
          </button>
        ) : null}
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex w-full items-center justify-center gap-2 bg-slate-50 px-6 py-12 dark:bg-slate-900">
        <span className="text-sm text-slate-500">{t('map.googleLoading')}</span>
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerClassName={`w-full ${heightClass}`}
      center={OFFICE_CENTER}
      zoom={OFFICE_ZOOM}
    >
      <MarkerF position={OFFICE_CENTER} title={t('contact.mapTitle')} />
    </GoogleMap>
  )
}

export default function ContactMap({ heightClass = 'h-64', onUseOsm }) {
  const apiKey = getGoogleMapsKey()

  // Debug only: key value-a log panna matom, iruka/illaya mattum (Vite inject check).
  if (import.meta.env.DEV) {
    console.info('[map] google key present:', apiKey ? true : false)
  }

  // Key illana Google script-a load pannave vendaam — OSM-ku switch sollu.
  if (!apiKey) {
    return <MissingKeyNotice onUseOsm={onUseOsm} />
  }

  return <GoogleMapInner heightClass={heightClass} apiKey={apiKey} onUseOsm={onUseOsm} />
}
