import { useEffect, useRef, useState } from 'react';
import { GoogleMap, InfoWindowF, MarkerF, PolylineF, useJsApiLoader } from '@react-google-maps/api';
import { useI18n } from '../i18n/I18nContext';
import type { MappedDonor } from '../utils/geo';
import { GOOGLE_MAPS_KEY, googleMarkerIcon, hasGoogleMapsKey } from '../lib/googleMaps';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';

interface DonorGoogleMapProps {
  donors: MappedDonor[];
  tripStops: MappedDonor[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  center: [number, number];
  groupColors: Record<string, string>;
  height: string;
  onUseOsm?: () => void;
}

function MissingKeyPane({ onUseOsm }: { onUseOsm?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12">
      <EmptyState title={t('donorMap.keyMissingTitle')} hint={t('donorMap.keyMissing')} />
      {onUseOsm ? (
        <button
          type="button"
          onClick={onUseOsm}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          {t('donorMap.useOsm')}
        </button>
      ) : null}
    </div>
  );
}

function DonorGoogleMapInner({
  donors,
  tripStops,
  selected,
  onToggleSelect,
  center,
  groupColors,
  height,
  onUseOsm,
}: DonorGoogleMapProps) {
  const { t } = useI18n();
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'aegis-donor-gmap',
    googleMapsApiKey: GOOGLE_MAPS_KEY ?? '',
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.panTo({ lat: center[0], lng: center[1] });
    }
  }, [center]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12">
        <EmptyState title={t('donors.error')} hint={String(loadError.message || loadError)} />
        {onUseOsm ? (
          <button
            type="button"
            onClick={onUseOsm}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {t('donorMap.useOsm')}
          </button>
        ) : null}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
        <Spinner />
        <span className="text-sm">{t('donorMap.googleLoading')}</span>
      </div>
    );
  }

  const active = activeId ? donors.find((d) => d.donorId === activeId) ?? null : null;

  return (
    <GoogleMap
      mapContainerStyle={{ height, width: '100%' }}
      center={{ lat: center[0], lng: center[1] }}
      zoom={11}
      onLoad={(map) => {
        mapRef.current = map;
      }}
      onUnmount={() => {
        mapRef.current = null;
      }}
    >
      {donors.map((d) => {
        const order = tripStops.findIndex((s) => s.donorId === d.donorId);
        return (
          <MarkerF
            key={d.donorId}
            position={{ lat: d.mapLat, lng: d.mapLng }}
            icon={googleMarkerIcon(groupColors[d.bloodGroup] ?? '#dc2626', order >= 0 ? String(order + 1) : undefined)}
            onClick={() => setActiveId(d.donorId)}
          />
        );
      })}
      {active ? (
        <InfoWindowF position={{ lat: active.mapLat, lng: active.mapLng }} onCloseClick={() => setActiveId(null)}>
          <div className="min-w-[160px]">
            <p className="text-sm font-bold">{active.fullName || active.donorId}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {active.bloodGroup} · {active.status}
              {active.approx ? ' · approx' : ''}
            </p>
            {active.address ? <p className="mt-1 text-xs">{active.address}</p> : null}
            <p className="mt-0.5 text-xs text-slate-500">
              {[active.city, active.pincode].filter(Boolean).join(' · ')}
            </p>
            <button
              type="button"
              onClick={() => onToggleSelect(active.donorId)}
              className="mt-2 w-full rounded-md bg-red-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              {selected.has(active.donorId) ? t('donorMap.removeStop') : t('donorMap.addStop')}
            </button>
          </div>
        </InfoWindowF>
      ) : null}
      {tripStops.length >= 2 ? (
        <PolylineF
          path={tripStops.map((s) => ({ lat: s.mapLat, lng: s.mapLng }))}
          options={{ strokeColor: '#059669', strokeWeight: 4 }}
        />
      ) : null}
    </GoogleMap>
  );
}

export default function DonorGoogleMap(props: DonorGoogleMapProps) {
  // Key illana Google script-a load pannave vendaam — OSM-ku switch sollu.
  if (!hasGoogleMapsKey()) {
    return <MissingKeyPane onUseOsm={props.onUseOsm} />;
  }
  return <DonorGoogleMapInner {...props} />;
}
