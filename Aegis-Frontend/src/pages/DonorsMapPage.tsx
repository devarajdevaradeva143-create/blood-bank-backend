import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2, Navigation, Route as RouteIcon, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { BLOOD_GROUPS, DISTRICTS } from '../data/constants';
import { districtCenter } from '../data/districtCenters';
import { listDonorMap } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import {
  googleDirectionsUrl,
  orderTrip,
  toMappedDonor,
  tripKm,
  type MappedDonor,
} from '../utils/geo';
import {
  storedMapProvider,
  storeMapProvider,
  type MapProvider,
} from '../lib/googleMaps';

const DonorGoogleMap = lazy(() => import('./DonorGoogleMap'));

const GROUP_COLORS: Record<string, string> = {
  'O+': '#dc2626',
  'O-': '#991b1b',
  'A+': '#2563eb',
  'A-': '#1e40af',
  'B+': '#059669',
  'B-': '#065f46',
  'AB+': '#7c3aed',
  'AB-': '#5b21b6',
};

function dotIcon(color: string, label?: string): L.DivIcon {
  const inner = label
    ? `<span style="color:#fff;font-size:11px;font-weight:800;line-height:22px;">${label}</span>`
    : `<span style="display:block;width:10px;height:10px;border-radius:9999px;background:#fff;margin:6px auto;"></span>`;
  return L.divIcon({
    className: 'donor-dot',
    html: `<div style="width:22px;height:22px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;text-align:center;">${inner}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 11));
  }, [center, map]);
  return null;
}

function InvalidateOnFullscreen({ isFullscreen }: { isFullscreen: boolean }) {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => {
      map.invalidateSize();
    }, 60);
    return () => window.clearTimeout(t);
  }, [isFullscreen, map]);
  return null;
}

interface DonorMapPaneProps {
  provider: MapProvider;
  donors: MappedDonor[];
  tripStops: MappedDonor[];
  selected: Set<string>;
  toggleSelect: (id: string) => void;
  center: [number, number];
  height: string;
  isFullscreen: boolean;
  onUseOsm?: () => void;
}

/** OSM (Leaflet) pane — original map, untouched behaviour. */
function OsmDonorMap({
  donors,
  tripStops,
  selected,
  toggleSelect,
  center,
  height,
  isFullscreen,
}: Omit<DonorMapPaneProps, 'provider'>) {
  const { t } = useI18n();
  return (
    <MapContainer center={center} zoom={11} style={{ height, width: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={center} />
      <InvalidateOnFullscreen isFullscreen={isFullscreen} />
      {donors.map((d) => {
        const order = tripStops.findIndex((s) => s.donorId === d.donorId);
        return (
          <Marker
            key={d.donorId}
            position={[d.mapLat, d.mapLng]}
            icon={dotIcon(GROUP_COLORS[d.bloodGroup] ?? '#dc2626', order >= 0 ? String(order + 1) : undefined)}
          >
            <Popup>
              <div className="min-w-[160px]">
                <p className="text-sm font-bold">{d.fullName || d.donorId}</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {d.bloodGroup} · {d.status}
                  {d.approx ? ' · approx' : ''}
                </p>
                {d.address ? <p className="mt-1 text-xs">{d.address}</p> : null}
                <p className="mt-0.5 text-xs text-slate-500">
                  {[d.city, d.pincode].filter(Boolean).join(' · ')}
                </p>
                <button
                  type="button"
                  onClick={() => toggleSelect(d.donorId)}
                  className="mt-2 w-full rounded-md bg-red-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  {selected.has(d.donorId) ? t('donorMap.removeStop') : t('donorMap.addStop')}
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
      {tripStops.length >= 2 ? (
        <Polyline positions={tripStops.map((s) => [s.mapLat, s.mapLng] as [number, number])} color="#059669" weight={4} />
      ) : null}
    </MapContainer>
  );
}

/** Provider switch — OSM default, Google lazy-loads only when selected. */
function DonorMapPane({ provider, onUseOsm, ...rest }: DonorMapPaneProps) {
  if (provider === 'google') {
    return <DonorGoogleMapLazy {...rest} onUseOsm={onUseOsm} />;
  }
  return <OsmDonorMap {...rest} />;
}

function DonorGoogleMapLazy(props: Omit<DonorMapPaneProps, 'provider' | 'isFullscreen'>) {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
          <Spinner />
          <span className="text-sm">{t('donorMap.googleLoading')}</span>
        </div>
      }
    >
      <DonorGoogleMap
        donors={props.donors}
        tripStops={props.tripStops}
        selected={props.selected}
        onToggleSelect={props.toggleSelect}
        center={props.center}
        groupColors={GROUP_COLORS}
        height={props.height}
        onUseOsm={props.onUseOsm}
      />
    </Suspense>
  );
}

export default function DonorsMapPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const [bloodGroup, setBloodGroup] = useState('');
  const [donors, setDonors] = useState<MappedDonor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tripMode, setTripMode] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [provider, setProvider] = useState<MapProvider>(() => storedMapProvider());

  const switchProvider = (p: MapProvider) => {
    setProvider(p);
    storeMapProvider(p);
  };

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isFullscreen]);

  const userDistrictSlug = useMemo(() => (user?.districtId ?? '').trim().toLowerCase(), [user]);
  const userDistrictDisplay = useMemo(() => {
    if (!userDistrictSlug) return '';
    return DISTRICTS.find((d) => d.toLowerCase() === userDistrictSlug) ?? user?.districtId ?? '';
  }, [user, userDistrictSlug]);
  const scopeDisplay = userDistrictDisplay || user?.districtId || '—';
  const center = useMemo<[number, number]>(
    () => districtCenter(userDistrictSlug || 'chennai'),
    [userDistrictSlug]
  );
  const districtMissing = user?.role === 'DistrictAdmin' && !userDistrictSlug;

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (districtMissing) {
        setDonors([]);
        setError(t('donations.forbidden'));
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await listDonorMap({
          bloodGroup: bloodGroup || undefined,
          districtId: userDistrictSlug || undefined,
          district: userDistrictDisplay || undefined,
        });
        if (cancelled) return;
        const mapped = (res.data ?? []).map((d) => toMappedDonor(d, userDistrictSlug || 'chennai'));
        setDonors(mapped);
      } catch (e) {
        if (cancelled) return;
        setDonors([]);
        setError(e instanceof Error ? e.message : t('donorMap.loading'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [bloodGroup, userDistrictSlug, userDistrictDisplay, districtMissing, refreshNonce, t]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tripStops = useMemo(() => {
    const picks = donors.filter((d) => selected.has(d.donorId));
    return orderTrip(picks);
  }, [donors, selected]);

  const tripDistance = useMemo(() => tripKm(tripStops), [tripStops]);
  const approxCount = useMemo(() => donors.filter((d) => d.approx).length, [donors]);

  return (
    <div>
      <PageHeader title={t('donorMap.title')} subtitle={t('donorMap.subtitle')} />

      <Card className="border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40">
        <p className="flex items-center gap-2 text-xs font-medium text-sky-800 dark:text-sky-200">
          <Users className="h-4 w-4" />
          {t('donorMap.scope', { district: scopeDisplay })} · {donors.length} dots
          {approxCount > 0 ? ` · ${approxCount} approx` : ''}
        </p>
      </Card>

      <Card className="mt-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[140px]">
            <label htmlFor="map-group" className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('donors.group')}
            </label>
            <Select id="map-group" className="mt-1.5" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
              <option value="">{t('donors.allGroups')}</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </Select>
          </div>
          <Button
            variant={tripMode ? 'primary' : 'outline'}
            size="sm"
            icon={<RouteIcon className="h-3.5 w-3.5" />}
            onClick={() => setTripMode((v) => !v)}
          >
            {tripMode ? t('donorMap.tripOn') : t('donorMap.planTrip')}
          </Button>
          {tripStops.length >= 2 ? (
            <a
              href={googleDirectionsUrl(tripStops)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Navigation className="h-3.5 w-3.5" />
              {t('donorMap.openRoute')} · {tripDistance.toFixed(1)} km
            </a>
          ) : null}
          {selected.size > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              {t('donorMap.clear')} ({selected.size})
            </Button>
          ) : null}
          <div
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
            role="group"
            aria-label={t('donorMap.mapProvider')}
          >
            <button
              type="button"
              onClick={() => switchProvider('osm')}
              aria-pressed={provider === 'osm'}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                provider === 'osm'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {t('donorMap.providerOsm')}
            </button>
            <button
              type="button"
              onClick={() => switchProvider('google')}
              aria-pressed={provider === 'google'}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                provider === 'google'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {t('donorMap.providerGoogle')}
            </button>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              icon={
                isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />
              }
              onClick={() => setIsFullscreen((v) => !v)}
              aria-pressed={isFullscreen}
              title={isFullscreen ? t('donorMap.exitFullscreen') : t('donorMap.fullscreen')}
            >
              {isFullscreen ? t('donorMap.exitFullscreen') : t('donorMap.fullscreen')}
            </Button>
          </div>
        </div>
        {tripMode ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('donorMap.tripHint')}</p> : null}
      </Card>

      {isFullscreen ? (
        <div className="fixed inset-0 z-[200] flex flex-col bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 rounded-xl bg-white px-4 py-2.5 shadow-lg dark:bg-slate-900">
            <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
              {t('donorMap.title')} · {t('donorMap.scope', { district: scopeDisplay })} · {donors.length} dots
            </p>
            <Button
              variant="outline"
              size="sm"
              icon={<Minimize2 className="h-3.5 w-3.5" />}
              onClick={() => setIsFullscreen(false)}
            >
              {t('donorMap.exitFullscreen')}
            </Button>
          </div>
          <Card padded={false} className="mx-auto mt-3 w-full max-w-7xl flex-1 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
                <Spinner />
                <span className="text-sm">{t('donorMap.loading')}</span>
              </div>
            ) : error && donors.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12">
                <EmptyState title={t('donors.error')} hint={error} />
                <Button variant="outline" size="sm" onClick={() => setRefreshNonce((n) => n + 1)}>
                  {t('donors.retry')}
                </Button>
              </div>
            ) : donors.length === 0 ? (
              <EmptyState title={t('donors.empty')} hint={t('donors.noResultsHint')} />
            ) : (
              <DonorMapPane
                provider={provider}
                donors={donors}
                tripStops={tripStops}
                selected={selected}
                toggleSelect={toggleSelect}
                center={center}
                height="calc(100dvh - 160px)"
                isFullscreen={isFullscreen}
                onUseOsm={() => switchProvider('osm')}
              />
            )}
          </Card>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card padded={false} className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
              <Spinner />
              <span className="text-sm">{t('donorMap.loading')}</span>
            </div>
          ) : error && donors.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12">
              <EmptyState title={t('donors.error')} hint={error} />
              <Button variant="outline" size="sm" onClick={() => setRefreshNonce((n) => n + 1)}>
                {t('donors.retry')}
              </Button>
            </div>
          ) : donors.length === 0 ? (
            <EmptyState title={t('donors.empty')} hint={t('donors.noResultsHint')} />
          ) : (
            <DonorMapPane
              provider={provider}
              donors={donors}
              tripStops={tripStops}
              selected={selected}
              toggleSelect={toggleSelect}
              center={center}
              height="480"
              isFullscreen={isFullscreen}
              onUseOsm={() => switchProvider('osm')}
            />
          )}
        </Card>

        <Card className="max-h-[544px] overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('donorMap.stops')} ({tripStops.length})
            {tripStops.length >= 2 ? ` · ${tripDistance.toFixed(1)} km` : ''}
          </p>
          {tripStops.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">{t('donorMap.noStops')}</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {tripStops.map((s, i) => (
                <li key={s.donorId} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{s.fullName || s.donorId}</p>
                    <p className="truncate text-[11px] text-slate-500">{s.address || [s.city, s.pincode].filter(Boolean).join(', ')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSelect(s.donorId)}
                    className="shrink-0 text-[11px] font-semibold text-rose-600 hover:underline"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('donorMap.allDonors')} ({donors.length})
            </p>
            <ul className="mt-2 space-y-1.5">
              {donors.slice(0, 60).map((d) => (
                <li key={d.donorId}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <input
                      type="checkbox"
                      checked={selected.has(d.donorId)}
                      onChange={() => toggleSelect(d.donorId)}
                      className="h-3.5 w-3.5 accent-red-600"
                    />
                    <Badge tone="red">{d.bloodGroup || '—'}</Badge>
                    <span className="min-w-0 flex-1 truncate font-medium">{d.fullName || d.donorId}</span>
                  </label>
                </li>
              ))}
            </ul>
            {donors.length > 60 ? (
              <p className="mt-2 text-[11px] text-slate-400">+{donors.length - 60} more — filter by blood group</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
