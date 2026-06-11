import { useEffect, useMemo, useState } from 'react';
import type {
  ButtonHTMLAttributes,
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import {
  AlertTriangle,
  Archive,
  Award,
  Bell,
  Database,
  FileWarning,
  LayoutDashboard,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getAccessToken } from '../api/client';
import { getMe } from '../api/auth';
import {
  archiveAdminChallenge,
  createAdminBadge,
  createAdminChallenge,
  createAdminDangerousLocation,
  deleteAdminBadge,
  deleteAdminDangerousLocation,
  fetchAdminOcha,
  getAdminBadge,
  getAdminBadges,
  getAdminChallenge,
  getAdminChallenges,
  getAdminCheckpointReports,
  getAdminDangerousLocations,
  getAdminDashboard,
  getAdminId,
  getAdminIncidents,
  getAdminOchaLogs,
  getAdminSosEvents,
  getAdminUsers,
  publishAdminChallenge,
  recalculateAdminChallenge,
  updateAdminBadge,
  updateAdminChallenge,
  updateAdminDangerousLocation,
  updateIncidentModeration,
  type AdminDashboard,
  type AdminRecord,
  type ChallengePayload,
  type DangerousLocationPayload,
  type IncidentModerationPayload,
} from '../api/admin';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

// ─── Fixed BadgePayload type (criteria_value is now a JSON object) ────────────
type BadgePayload = {
  code: string;
  name: string;
  name_ar: string | null;
  description: string;
  description_ar: string | null;
  badge_icon_url: string | null;
  category: string;
  criteria_type: string;
  criteria_value: Record<string, unknown>;
  points: number;
  is_active: boolean;
};

type AdminSection =
  | 'users'
  | 'dashboard'
  | 'challenges'
  | 'badges'
  | 'incidents'
  | 'locations'
  | 'checkpointReports'
  | 'sosEvents'
  | 'ocha';

type Notice = {
  type: 'success' | 'error';
  message: string;
};

type Column = {
  key: string;
  label: string;
  render?: (item: AdminRecord) => ReactNode;
};

type ChallengeFormState = {
  title: string;
  description: string;
  goal_type: string;
  goal_value: string;
  goal_metadata_difficulty: string;
  goal_metadata_region: string;
  goal_metadata_labels: string;
  goal_metadata_raw: Record<string, unknown>;
  start_at: string;
  end_at: string;
  visibility: string;
  reward_badge_id: string;
  reward_points: string;
};

// ─── Fixed BadgeFormState (added name_ar, description_ar; criteria_value is JSON string) ──
type BadgeFormState = {
  code: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  badge_icon_url: string;
  category: string;
  criteria_type: string;
  criteria_target: string;
  criteria_region: string;
  criteria_place_type: string;
  criteria_value_raw: Record<string, unknown>;
  points: string;
  is_active: boolean;
};

type LocationFormState = {
  name: string;
  name_ar: string;
  location_type: string;
  latitude: string;
  longitude: string;
  danger_radius_meters: string;
  risk_level: string;
  description: string;
  description_ar: string;
  operating_hours: string;
  is_active: boolean;
};

const adminSections: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'challenges', label: 'Challenges', icon: Trophy },
  { id: 'badges', label: 'Badges', icon: Award },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'locations', label: 'Danger Zones', icon: MapPin },
  { id: 'checkpointReports', label: 'Checkpoints', icon: FileWarning },
  { id: 'sosEvents', label: 'SOS Events', icon: Bell },
  { id: 'ocha', label: 'OCHA', icon: Database },
];

const emptyChallengeForm: ChallengeFormState = {
  title: '',
  description: '',
  goal_type: 'total_distance_km',
  goal_value: '1',
  goal_metadata_difficulty: '',
  goal_metadata_region: '',
  goal_metadata_labels: '',
  goal_metadata_raw: {},
  start_at: '',
  end_at: '',
  visibility: 'public',
  reward_badge_id: '',
  reward_points: '0',
};

// ─── Fixed emptyBadgeForm (criteria_value is now '{}') ───────────────────────
const emptyBadgeForm: BadgeFormState = {
  code: '',
  name: '',
  name_ar: '',
  description: '',
  description_ar: '',
  badge_icon_url: '',
  category: 'general',
  criteria_type: 'manual',
  criteria_target: '',
  criteria_region: '',
  criteria_place_type: 'spring',
  criteria_value_raw: {},
  points: '0',
  is_active: true,
};

const emptyLocationForm: LocationFormState = {
  name: '',
  name_ar: '',
  location_type: 'settlement',
  latitude: '',
  longitude: '',
  danger_radius_meters: '500',
  risk_level: 'medium',
  description: '',
  description_ar: '',
  operating_hours: '',
  is_active: true,
};

const locationTypes = [
  'settlement',
  'outpost',
  'military_checkpoint',
  'flying_checkpoint',
  'military_base',
  'bypass_road',
  'roadblock',
  'watchtower',
  'settler_road',
];

const moderationStatuses: IncidentModerationPayload['moderation_status'][] = [
  'pending',
  'approved',
  'verified',
  'rejected',
  'hidden',
];

const challengeDifficultyOptions = ['', 'easy', 'medium', 'hard'];
const challengeGoalTypeOptions = [
  'complete_trails',
  'total_distance_km',
  'complete_difficulty',
  'join_meetups',
  'submit_safety_reports',
  'checkpoint_reports',
];

const badgeCriteriaTypeOptions = [
  'manual',
  'trails_count',
  'reviews_count',
  'photos_count',
  'distance_km',
  'summits',
  'meetups_joined',
  'meetups_hosted',
  'unique_places',
  'region_trails',
  'regions_visited',
];

const uniquePlaceTypes = ['spring', 'valley', 'heritage'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function textValue(value: unknown) {
  if (value == null || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function getField(item: AdminRecord | null | undefined, keys: string[], fallback = '') {
  if (!item) return fallback;
  for (const key of keys) {
    const value = item[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return fallback;
}

function getNumberField(item: AdminRecord | null | undefined, keys: string[], fallback = 0) {
  const value = getField(item, keys);
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getBooleanField(item: AdminRecord | null | undefined, keys: string[], fallback = false) {
  if (!item) return fallback;
  for (const key of keys) {
    if (typeof item[key] === 'boolean') return Boolean(item[key]);
    if (item[key] === 'true') return true;
    if (item[key] === 'false') return false;
  }
  return fallback;
}

function toDateTimeInput(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoDateTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function nullable(value: string) {
  return value.trim() ? value.trim() : null;
}

function nullableUuid(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(trimmed) ? trimmed : null;
}

function getAchievementId(item: AdminRecord | null | undefined) {
  return getField(item, ['id', 'badge_id']);
}

function numeric(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseRecord(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function omitKeys(value: Record<string, unknown>, keys: string[]) {
  const next = { ...value };
  keys.forEach((key) => {
    delete next[key];
  });
  return next;
}

function commaList(value: unknown) {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(', ');
  if (typeof value === 'string') return value;
  return '';
}

function recordSnippet(item: AdminRecord, keys: string[]) {
  const value = getField(item, keys, '-');
  return value.length > 90 ? `${value.slice(0, 87)}...` : value;
}

function formatDateTime(value: unknown) {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatPercentage(value: unknown, key = '') {
  if (value == null || value === '') return '-';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '-';
    if (trimmed.includes('%')) return trimmed;
    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue)) return trimmed;
    return formatPercentage(numericValue, key);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);

  const looksLikePercentage = /percent|percentage|rate|ratio|completion|progress|success_rate|hit_rate|accuracy|coverage/i.test(key);
  if (!looksLikePercentage) return String(value);

  const percent = value <= 1 ? value * 100 : value;
  const formatted = Number.isInteger(percent) ? String(percent) : percent.toFixed(1).replace(/\.0$/, '');
  return `${formatted}%`;
}

function getAdminMetricValue(dashboard: AdminDashboard | null, group: string, key: string): number | string | boolean | null {
  if (!dashboard) return null;
  const section = dashboard[group];
  if (!section || typeof section !== 'object' || Array.isArray(section)) return null;
  const value = (section as Record<string, unknown>)[key];
  if (value == null || value === '') return null;
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
  return null;
}

function UserAnalyticsCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string | boolean | null;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 text-2xl font-bold text-foreground tabular-nums">{textValue(value)}</div>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

// ─── UI primitives ────────────────────────────────────────────────────────────

function StatusPill({ value }: { value: unknown }) {
  const status = String(value ?? 'unknown');
  const className = status.match(/active|approved|published|complete|success/i)
    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold'
    : status.match(/rejected|hidden|critical|failed|inactive|archived/i)
      ? 'border-rose-300 bg-rose-50 text-rose-700 font-semibold'
      : status.match(/pending|draft|medium|warning/i)
        ? 'border-amber-300 bg-amber-50 text-amber-700 font-semibold'
        : 'border-slate-300 bg-slate-50 text-slate-700';

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${className}`}>
      {humanize(status)}
    </span>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-sm font-medium text-foreground mb-1.5">{children}</label>;
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-md border border-border bg-input-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 ${props.className ?? ''}`}
    />
  );
}

function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-20 w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 ${props.className ?? ''}`}
    />
  );
}

function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 w-full rounded-md border border-border bg-input-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 ${props.className ?? ''}`}
    />
  );
}

function AdminButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'border border-border bg-card text-foreground hover:bg-muted/30',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    ghost: 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
  };

  return (
    <button
      {...props}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function NoticeBanner({ notice, onClear }: { notice: Notice | null; onClear: () => void }) {
  if (!notice) return null;
  const classes = notice.type === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-md'
    : 'border-rose-200 bg-rose-50 text-rose-800 shadow-md';
  const icon = notice.type === 'success' ? '✓' : '✕';

  return (
    <div className={`mb-6 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200 ${classes}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg">{icon}</span>
        <span>{notice.message}</span>
      </div>
      <button onClick={onClear} className="rounded p-1 hover:bg-white/40 transition-colors" title="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function LoadingPanel({ label = 'Loading admin data...' }: { label?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-12 text-center">
      <div className="mb-4 inline-block">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary"></div>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 p-12 text-center">
      <div className="mb-3 text-4xl text-muted-foreground/40">📭</div>
      <p className="text-sm text-muted-foreground font-medium">{label}</p>
    </div>
  );
}

function DynamicTable({ columns, items, actions }: { columns: Column[]; items: AdminRecord[]; actions?: (item: AdminRecord) => ReactNode }) {
  if (items.length === 0) return <EmptyPanel label="No records found." />;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((column) => (
                <TableHead key={column.key} className="font-semibold text-foreground">
                  {column.label}
                </TableHead>
              ))}
              {actions && <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const id = getAdminId(item) || `row-${index}`;
              return (
                <TableRow key={id} className="hover:bg-muted/30 transition-colors">
                  {columns.map((column) => (
                    <TableCell key={column.key} className="max-w-xs overflow-hidden text-ellipsis py-3">
                      {column.render ? column.render(item) : textValue(item[column.key])}
                    </TableCell>
                  ))}
                  {actions && <TableCell className="text-right">{actions(item)}</TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-border bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
        Showing {items.length} record{items.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function collectMetrics(dashboard: AdminDashboard | null) {
  if (!dashboard) return [];
  const metrics: Array<{ label: string; value: number | string | boolean; group?: string }> = [];

  Object.entries(dashboard).forEach(([key, value]) => {
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      metrics.push({ label: humanize(key), value });
      return;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value as Record<string, unknown>).forEach(([innerKey, innerValue]) => {
        if (typeof innerValue === 'number' || typeof innerValue === 'string' || typeof innerValue === 'boolean') {
          metrics.push({ group: humanize(key), label: humanize(innerKey), value: innerValue });
        }
      });
    }
  });

  return metrics;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTimeSeriesArray(items: AdminRecord[]) {
  if (items.length === 0) return false;
  const first = items[0];
  const keys = Object.keys(first);
  const xKey = keys.find((k) => /date|day|month|time|created|period/i.test(k));
  const yKey = keys.find((k) => typeof first[k] === 'number');
  return Boolean(xKey && yKey);
}

function inferDashboardColumns(items: AdminRecord[]) {
  if (items.length === 0) return [];
  const keys = Object.keys(items[0]);
  const priority = ['name', 'full_name', 'title', 'status', 'type', 'role', 'count', 'total', 'email', 'username', 'created_at', 'last_active_at', 'updated_at', 'message'];
  return keys
    .slice()
    .sort((a, b) => {
      const aIndex = priority.findIndex((key) => new RegExp(`^${key}$`, 'i').test(a));
      const bIndex = priority.findIndex((key) => new RegExp(`^${key}$`, 'i').test(b));
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    })
    .slice(0, 6);
}

function dashboardCellValue(key: string, value: unknown) {
  if (value == null || value === '') return '-';
  if (/date|time|created|updated|joined|at$/i.test(key)) return formatDateTime(value);
  if (/percent|percentage|rate|ratio|completion|progress|success_rate|hit_rate|accuracy|coverage/i.test(key)) {
    return formatPercentage(value, key);
  }
  if (/status|role|type|visibility|level|state/i.test(key)) return <StatusPill value={value} />;
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return textValue(value);
}

function DashboardValueSection({
  title,
  value,
  path,
}: {
  title: string;
  value: unknown;
  path: string;
}) {
  if (value == null || value === '') {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">Not available.</p>
      </div>
    );
  }

  if (Array.isArray(value)) {
    const items = value.filter(isPlainObject) as AdminRecord[];
    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">No records available.</p>
        </div>
      );
    }

    if (isTimeSeriesArray(items)) {
      const first = items[0];
      const keys = Object.keys(first);
      const xKey = keys.find((k) => /date|day|month|time|created|period/i.test(k)) ?? keys[0];
      const yKey = keys.find((k) => typeof first[k] === 'number') ?? keys[1] ?? keys[0];

      return (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
          <p className="mb-4 text-xs text-muted-foreground">Trend over time</p>
          <div className="h-72 rounded-md bg-muted/20 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={items}>
                <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  cursor={{ stroke: 'var(--primary)', strokeWidth: 1 }}
                />
                <Line type="monotone" dataKey={yKey} stroke="var(--primary)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (path === 'users.recent_active_users') {
      return (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-base font-semibold text-foreground">{title}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.slice(0, 6).map((item, index) => (
              <div key={getAdminId(item) || `${path}-${index}`} className="rounded-md border border-border bg-muted/20 p-3">
                <div className="font-medium text-foreground">{getField(item, ['full_name', 'name'], 'Unknown user')}</div>
                <div className="mt-1 text-xs text-muted-foreground">Last active: {formatDateTime(getField(item, ['last_active_at', 'created_at']))}</div>
                <div className="mt-1 text-xs text-muted-foreground">Events: {getField(item, ['event_count', 'count'], '-')}</div>
                <div className="mt-1 break-all text-[11px] text-muted-foreground/80">{getField(item, ['user_id', 'id'], '-')}</div>
              </div>
            ))}
          </div>
          {items.length > 6 && <p className="mt-3 text-xs text-muted-foreground">{items.length - 6} more user records available.</p>}
        </div>
      );
    }

    const columns = inferDashboardColumns(items).map((key) => ({
      key,
      label: humanize(key),
      render: (item: AdminRecord) => dashboardCellValue(key, item[key]),
    }));

    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-base font-semibold text-foreground">{title}</h3>
        <DynamicTable columns={columns} items={items.slice(0, 10)} />
        {items.length > 10 && <p className="mt-3 text-xs text-muted-foreground">Showing first 10 of {items.length} records.</p>}
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    const scalarEntries = entries.filter(([, entryValue]) => typeof entryValue === 'number' || typeof entryValue === 'string' || typeof entryValue === 'boolean');
    const complexEntries = entries.filter(([, entryValue]) => isPlainObject(entryValue) || Array.isArray(entryValue));

    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {scalarEntries.length + complexEntries.length} field{scalarEntries.length + complexEntries.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {scalarEntries.length > 0 && (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <tbody>
                {scalarEntries.map(([key, entryValue]) => (
                  <tr key={`${path}.${key}`} className="border-b border-border last:border-0">
                    <td className="w-1/3 px-3 py-2 text-xs font-medium text-muted-foreground">{humanize(key)}</td>
                    <td className="px-3 py-2 text-foreground">{dashboardCellValue(key, entryValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {complexEntries.length > 0 && (
          <div className="mt-4 space-y-4">
            {complexEntries.map(([key, entryValue]) => (
              <DashboardValueSection
                key={`${path}.${key}`}
                title={humanize(key)}
                value={entryValue}
                path={`${path}.${key}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-foreground">{textValue(value)}</p>
    </div>
  );
}

function DashboardSection({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      setDashboard(await getAdminDashboard());
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to load admin dashboard.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  const dashboardEntries = useMemo(() => Object.entries(dashboard ?? {}), [dashboard]);
  const highlights = [
    { label: 'Users', value: getAdminMetricValue(dashboard, 'users', 'total'), note: 'Total profiles' },
    { label: 'Published trails', value: getAdminMetricValue(dashboard, 'trails', 'published'), note: 'Visible to the community' },
    { label: 'Pending incidents', value: getAdminMetricValue(dashboard, 'safety', 'pending_incidents'), note: 'Awaiting admin review' },
    { label: 'Open SOS', value: getAdminMetricValue(dashboard, 'safety', 'recent_open_sos_events'), note: 'Created in the last 7 days' },
    { label: 'Active challenges', value: getAdminMetricValue(dashboard, 'challenges', 'active'), note: 'Currently running' },
    { label: 'Active badges', value: getAdminMetricValue(dashboard, 'badges', 'total'), note: 'Available for earning' },
  ];

  if (loading) return <LoadingPanel />;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2>Admin Dashboard</h2>
        </div>
        <AdminButton variant="secondary" onClick={loadDashboard}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </AdminButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {highlights.map((item) => (
          <UserAnalyticsCard key={item.label} label={item.label} value={item.value} note={item.note} />
        ))}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {dashboardEntries.map(([key, value]) => (
            <DashboardValueSection key={key} title={humanize(key)} value={value} path={key} />
          ))}
        </div>
      </div>
    </section>
  );
}

function UsersSection({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [items, setItems] = useState<AdminRecord[]>([]);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });

  const loadUsers = async (nextPage = page, nextQuery = query) => {
    setLoading(true);
    try {
      const usersResult = await getAdminUsers({
        q: nextQuery.trim() || undefined,
        page: nextPage,
        limit,
      });
      setItems(usersResult.users);
      setPagination({ page: usersResult.page, pages: usersResult.pages, total: usersResult.total });
      setPage(usersResult.page);
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to load users.') });
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      setDashboard(await getAdminDashboard());
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to load user analytics.') });
    }
  };

  useEffect(() => {
    void Promise.all([loadUsers(1, ''), loadSummary()]);
  }, []);

  const applySearch = async () => {
    await loadUsers(1, query);
  };

  const totalUsers = getAdminMetricValue(dashboard, 'users', 'total');
  const newThisWeek = getAdminMetricValue(dashboard, 'users', 'new_this_week');
  const newThisMonth = getAdminMetricValue(dashboard, 'users', 'new_this_month');
  const activeThisWeek = getAdminMetricValue(dashboard, 'users', 'active_this_week');
  const activeThisMonth = getAdminMetricValue(dashboard, 'users', 'active_this_month');
  const recentActiveUsers = getAdminMetricValue(dashboard, 'users', 'recent_active_users');

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Users"
        description="Browse user profiles and keep an eye on the live user funnel."
        onRefresh={() => Promise.all([loadUsers(page, query), loadSummary()]).then(() => undefined)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <UserAnalyticsCard label="Total users" value={totalUsers} note="Profiles in the system" />
        <UserAnalyticsCard label="New this week" value={newThisWeek} note="Joined over the last 7 days" />
        <UserAnalyticsCard label="New this month" value={newThisMonth} note="Joined over the last 30 days" />
        <UserAnalyticsCard label="Active this week" value={activeThisWeek} note="Seen in the last 7 days" />
        <UserAnalyticsCard label="Active this month" value={activeThisMonth} note="Seen in the last 30 days" />
        <UserAnalyticsCard label="Recent active users" value={Array.isArray(recentActiveUsers) ? recentActiveUsers.length : null} note="Top 30-day active list" />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, username, or location"
          />
          <AdminButton onClick={applySearch}>
            <RefreshCw className="h-4 w-4" />
            Search
          </AdminButton>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {pagination.total} user{pagination.total !== 1 ? 's' : ''}.
        </p>
      </div>

      {loading ? (
        <LoadingPanel label="Loading users..." />
      ) : items.length === 0 ? (
        <EmptyPanel label="No users matched your search." />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold text-foreground">User</TableHead>
                  <TableHead className="font-semibold text-foreground">Email</TableHead>
                  <TableHead className="font-semibold text-foreground">Username</TableHead>
                  <TableHead className="font-semibold text-foreground">Role</TableHead>
                  <TableHead className="font-semibold text-foreground">Location</TableHead>
                  <TableHead className="font-semibold text-foreground">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const id = getAdminId(item) || `user-${index}`;
                  const name = getField(item, ['full_name'], 'Unnamed user');
                  const initials = name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? '')
                    .join('') || 'U';

                  return (
                    <TableRow key={id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {initials}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{name}</div>
                            <div className="text-xs text-muted-foreground">{id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getField(item, ['email'], '-')}</TableCell>
                      <TableCell>{getField(item, ['username'], '-')}</TableCell>
                      <TableCell>
                        <StatusPill value={getField(item, ['role'], 'user')} />
                      </TableCell>
                      <TableCell>{getField(item, ['location', 'home_region'], '-')}</TableCell>
                      <TableCell>{formatDateTime(getField(item, ['created_at']))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 border-t border-border bg-muted/10 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Page {pagination.page} of {pagination.pages || 1}
            </span>
            <div className="flex gap-2">
                <AdminButton
                  variant="secondary"
                  onClick={() => loadUsers(Math.max(1, page - 1), query)}
                  disabled={loading || page <= 1}
                >
                  Previous
                </AdminButton>
                <AdminButton
                  variant="secondary"
                  onClick={() => loadUsers(Math.min(pagination.pages || page + 1, page + 1), query)}
                  disabled={loading || pagination.pages === 0 || page >= pagination.pages}
                >
                  Next
                </AdminButton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Challenges ───────────────────────────────────────────────────────────────

function challengeFormFromRecord(item: AdminRecord): ChallengeFormState {
  const metadata = parseRecord(item.goal_metadata);
  return {
    title: getField(item, ['title']),
    description: getField(item, ['description']),
    goal_type: getField(item, ['goal_type'], 'total_distance_km'),
    goal_value: String(getNumberField(item, ['goal_value'], 1)),
    goal_metadata_difficulty: typeof metadata.difficulty === 'string' ? metadata.difficulty : '',
    goal_metadata_region: typeof metadata.region === 'string' ? metadata.region : '',
    goal_metadata_labels: commaList(metadata.labels),
    goal_metadata_raw: metadata,
    start_at: toDateTimeInput(item.start_at),
    end_at: toDateTimeInput(item.end_at),
    visibility: getField(item, ['visibility'], 'public'),
    reward_badge_id: getField(item, ['reward_badge_id']),
    reward_points: String(getNumberField(item, ['reward_points'], 0)),
  };
}

function buildChallengePayload(form: ChallengeFormState, status: ChallengePayload['status']): ChallengePayload {
  const metadata = omitKeys(form.goal_metadata_raw, ['difficulty', 'region', 'labels']);
  if (form.goal_metadata_difficulty.trim()) metadata.difficulty = form.goal_metadata_difficulty.trim();
  if (form.goal_metadata_region.trim()) metadata.region = form.goal_metadata_region.trim();
  const labels = form.goal_metadata_labels
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);
  if (labels.length > 0) metadata.labels = labels;
  const goalType: ChallengePayload['goal_type'] = challengeGoalTypeOptions.includes(form.goal_type)
    ? (form.goal_type as ChallengePayload['goal_type'])
    : 'total_distance_km';
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    goal_type: goalType,
    goal_value: numeric(form.goal_value, 1),
    goal_metadata: Object.keys(metadata).length > 0 ? metadata : {},
    start_at: toIsoDateTime(form.start_at),
    end_at: toIsoDateTime(form.end_at),
    visibility: form.visibility === 'private' ? 'private' : 'public',
    status,
    reward_badge_id: nullable(form.reward_badge_id),
    reward_points: numeric(form.reward_points),
  };
}

function validateChallengeForm(form: ChallengeFormState) {
  if (!form.title.trim()) return 'Title is required.';
  if (!form.description.trim()) return 'Description is required.';
  if (!form.start_at.trim() || !form.end_at.trim()) return 'Start and end time are required.';

  const goalValue = numeric(form.goal_value, 0);
  if (goalValue <= 0) return 'Goal value must be greater than 0.';

  const rewardPoints = numeric(form.reward_points, 0);
  if (rewardPoints < 0) return 'Reward points cannot be negative.';

  const startIso = toIsoDateTime(form.start_at);
  const endIso = toIsoDateTime(form.end_at);
  if (!startIso || !endIso) return 'Start and end time must be valid dates.';
  if (Date.parse(endIso) <= Date.parse(startIso)) return 'End time must be after start time.';

  return '';
}

function ChallengesSection({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [items, setItems] = useState<AdminRecord[]>([]);
  const [badges, setBadges] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<ChallengeFormState>(emptyChallengeForm);
  const [formError, setFormError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ChallengePayload['status']>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [challengeItems, badgeItems] = await Promise.all([getAdminChallenges(), getAdminBadges()]);
      setItems(challengeItems);
      setBadges(badgeItems);
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to load challenges.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const selectedBadgeExists = badges.some((badge) => getAchievementId(badge) === form.reward_badge_id);
  const selectedBadge = badges.find((badge) => getAchievementId(badge) === form.reward_badge_id) ?? null;
  const selectedBadgePoints = selectedBadge ? getNumberField(selectedBadge, ['points'], 0) : null;
  const missingSelectedBadge = Boolean(form.reward_badge_id && !selectedBadgeExists);
  const applyRewardBadge = (badgeId: string) => {
    const badge = badges.find((entry) => getAchievementId(entry) === badgeId) ?? null;
    setForm((current) => ({
      ...current,
      reward_badge_id: badgeId,
      reward_points: badge ? String(getNumberField(badge, ['points'], 0)) : current.reward_points,
    }));
  };

  const filteredItems = useMemo(() => {
    if (statusFilter === 'all') return items;
    return items.filter((item) => getField(item, ['status'], 'draft') === statusFilter);
  }, [items, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { all: items.length, draft: 0, published: 0, archived: 0 };
    items.forEach((item) => {
      const status = getField(item, ['status'], 'draft');
      if (status === 'draft' || status === 'published' || status === 'archived') {
        counts[status] += 1;
      }
    });
    return counts;
  }, [items]);

  const resetForm = () => { setEditingId(''); setForm(emptyChallengeForm); setFormError(''); };

  const editItem = async (item: AdminRecord) => {
    const id = getAdminId(item);
    if (!id) return;
    setFormError('');
    try {
      const detail = await getAdminChallenge(id);
      setEditingId(getAdminId(detail) || id);
      setForm(challengeFormFromRecord(detail));
    } catch {
      setEditingId(id);
      setForm(challengeFormFromRecord(item));
    }
  };

  const submit = async (status: ChallengePayload['status'], event?: FormEvent) => {
    event?.preventDefault();
    setFormError('');
    try {
      const validationError = validateChallengeForm(form);
      if (validationError) {
        throw new Error(validationError);
      }
      const payload = buildChallengePayload(form, status);
      if (missingSelectedBadge) {
        payload.reward_badge_id = null;
      }
      const saved = editingId
        ? await updateAdminChallenge(editingId, payload)
        : await createAdminChallenge(payload);
      const savedId = getAdminId(saved) || editingId;
      onNotice({
        type: 'success',
        message: `Challenge ${editingId ? 'updated' : 'created'} as ${status}${savedId ? ` (${savedId})` : ''}${missingSelectedBadge ? '. Missing reward badge was cleared.' : ''}`,
      });
      resetForm();
      await load();
    } catch (error) {
      setFormError(toErrorMessage(error, 'Unable to save challenge. Check required fields and metadata values.'));
    }
  };

  const runAction = async (item: AdminRecord, action: 'publish' | 'archive' | 'recalculate') => {
    const id = getAdminId(item);
    if (!id) return;
    const currentStatus = getField(item, ['status'], 'draft');
    if (action === 'archive' && !window.confirm('Archive this challenge? It will no longer be joinable.')) return;
    if (action === 'publish' && currentStatus === 'archived') {
      onNotice({ type: 'error', message: 'Archived challenges cannot be published again.' });
      return;
    }
    try {
      if (action === 'publish') await publishAdminChallenge(id);
      if (action === 'archive') await archiveAdminChallenge(id);
      if (action === 'recalculate') await recalculateAdminChallenge(id);
      onNotice({ type: 'success', message: `Challenge ${action} completed.` });
      await load();
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, `Unable to ${action} challenge.`) });
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader title="Challenges Management" description="Create, edit, publish, archive, and recalculate challenge progress." onRefresh={load} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { key: 'all' as const, label: 'All challenges', value: statusCounts.all },
          { key: 'draft' as const, label: 'Drafts', value: statusCounts.draft },
          { key: 'published' as const, label: 'Published', value: statusCounts.published },
          { key: 'archived' as const, label: 'Archived', value: statusCounts.archived },
        ].map((entry) => {
          const active = statusFilter === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setStatusFilter(entry.key)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/20'
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{entry.label}</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{entry.value}</p>
            </button>
          );
        })}
      </div>

      <form onSubmit={(event) => submit(editingId ? (getField(items.find((item) => getAdminId(item) === editingId), ['status'], 'draft') as ChallengePayload['status']) : 'draft', event)} className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3>{editingId ? 'Edit Challenge' : 'Create Challenge'}</h3>
          {editingId && (
            <AdminButton type="button" variant="ghost" onClick={resetForm}>
              <X className="h-4 w-4" />Cancel
            </AdminButton>
          )}
        </div>
        {formError && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <FieldLabel>Title</FieldLabel>
            <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Goal Type</FieldLabel>
            <SelectInput value={form.goal_type} onChange={(e) => setForm({ ...form, goal_type: e.target.value })} required>
              {challengeGoalTypeOptions.map((option) => (
                <option key={option} value={option}>{humanize(option)}</option>
              ))}
            </SelectInput>
          </div>
          <div className="lg:col-span-2">
            <FieldLabel>Description</FieldLabel>
            <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Goal Value</FieldLabel>
            <TextInput type="number" value={form.goal_value} onChange={(e) => setForm({ ...form, goal_value: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Reward Points</FieldLabel>
            <TextInput
              type="number"
              value={form.reward_points}
              onChange={(e) => setForm({ ...form, reward_points: e.target.value })}
            />
            {selectedBadge && (
              <p className="mt-2 text-xs text-muted-foreground">
                Default from badge: {selectedBadgePoints ?? 0} points. You can override it for this challenge.
              </p>
            )}
          </div>
          <div>
            <FieldLabel>Start At</FieldLabel>
            <TextInput type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
          </div>
          <div>
            <FieldLabel>End At</FieldLabel>
            <TextInput type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Visibility</FieldLabel>
            <SelectInput value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </SelectInput>
          </div>
          <div>
            <FieldLabel>Reward Badge</FieldLabel>
            <SelectInput value={form.reward_badge_id} onChange={(e) => applyRewardBadge(e.target.value)}>
              <option value="">No reward badge</option>
              {form.reward_badge_id && !selectedBadgeExists && (
                <option value={form.reward_badge_id}>
                  {`${form.reward_badge_id} (missing badge)`}
                </option>
              )}
              {badges.map((badge) => {
                const badgeId = getAchievementId(badge);
                if (!badgeId) return null;
                const badgeLabel = [
                  getField(badge, ['name'], 'Badge'),
                  getField(badge, ['category'], 'general'),
                  `${getField(badge, ['points'], '0')} pts`,
                ].join(' | ');
                return (
                  <option key={badgeId} value={badgeId}>
                    {badgeLabel} ({getField(badge, ['code'], badgeId)})
                  </option>
                );
              })}
            </SelectInput>
            <div className="mt-2 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              {selectedBadge ? (
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {getField(selectedBadge, ['name'], 'Badge')} {getField(selectedBadge, ['code'], '') ? ` - ${getField(selectedBadge, ['code'], '')}` : ''}
                  </p>
                  <p>Category: {getField(selectedBadge, ['category'], 'general')}</p>
                  <p>Points: {getField(selectedBadge, ['points'], '0')}</p>
                  <p>Icon: {getField(selectedBadge, ['badge_icon_url', 'icon'], 'Not set')}</p>
                </div>
              ) : form.reward_badge_id ? (
                <p>Selected badge no longer exists. Saving this challenge will clear the missing reward badge unless you pick another one.</p>
              ) : (
                <p>No reward badge selected.</p>
              )}
            </div>
          </div>
          <div className="lg:col-span-2 rounded-md border border-border bg-muted/20 p-4">
            <div className="mb-3">
              <FieldLabel>Goal Metadata</FieldLabel>
              <p className="text-xs text-muted-foreground">Optional details used by the challenge logic and filtering.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <FieldLabel>Difficulty</FieldLabel>
                <SelectInput
                  value={form.goal_metadata_difficulty}
                  onChange={(e) => setForm({ ...form, goal_metadata_difficulty: e.target.value })}
                >
                  <option value="">Not set</option>
                  {challengeDifficultyOptions.filter(Boolean).map((option) => (
                    <option key={option} value={option}>{humanize(option)}</option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Region</FieldLabel>
                <TextInput
                  value={form.goal_metadata_region}
                  onChange={(e) => setForm({ ...form, goal_metadata_region: e.target.value })}
                  placeholder="e.g. Hebron"
                />
              </div>
              <div>
                <FieldLabel>Labels</FieldLabel>
                <TextInput
                  value={form.goal_metadata_labels}
                  onChange={(e) => setForm({ ...form, goal_metadata_labels: e.target.value })}
                  placeholder="e.g. family, weekend, scenic"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col justify-end gap-2 sm:flex-row">
          <AdminButton type="button" variant="secondary" onClick={() => void submit('draft')}>
            <Save className="h-4 w-4" />
            {editingId ? 'Save As Draft' : 'Create Draft'}
          </AdminButton>
          <AdminButton type="button" onClick={() => void submit('published')}>
            {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Save And Publish' : 'Create And Publish'}
          </AdminButton>
        </div>
      </form>

      {loading ? <LoadingPanel /> : (
        <DynamicTable
          items={filteredItems}
          columns={[
            { key: 'title', label: 'Title', render: (item) => recordSnippet(item, ['title', 'name']) },
            { key: 'goal_type', label: 'Goal', render: (item) => humanize(getField(item, ['goal_type'], '-')) },
            { key: 'goal_value', label: 'Value' },
            { key: 'status', label: 'Status', render: (item) => <StatusPill value={item.status} /> },
            { key: 'visibility', label: 'Visibility' },
            { key: 'participant_count', label: 'Participants', render: (item) => getField(item, ['participant_count'], '0') },
            { key: 'completed_count', label: 'Completed', render: (item) => getField(item, ['completed_count'], '0') },
            { key: 'end_at', label: 'Ends', render: (item) => formatDateTime(getField(item, ['end_at'])) },
            { key: 'reward_points', label: 'Points' },
          ]}
          actions={(item) => (
            <div className="flex flex-wrap justify-end gap-2">
              <AdminButton variant="secondary" onClick={() => editItem(item)}>Edit</AdminButton>
              <AdminButton
                variant="secondary"
                onClick={() => runAction(item, 'publish')}
                disabled={getField(item, ['status'], 'draft') !== 'draft'}
              >
                Publish
              </AdminButton>
              <AdminButton
                variant="secondary"
                onClick={() => runAction(item, 'archive')}
                disabled={getField(item, ['status'], 'draft') === 'archived'}
              >
                <Archive className="h-4 w-4" />Archive
              </AdminButton>
              <AdminButton
                variant="secondary"
                onClick={() => runAction(item, 'recalculate')}
                disabled={getField(item, ['status'], 'draft') === 'archived'}
              >
                Recalc
              </AdminButton>
            </div>
          )}
        />
      )}
    </section>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

// Fixed: reads both icon and badge_icon_url; maps criteria_value as JSON object
function badgeFormFromRecord(item: AdminRecord): BadgeFormState {
  const criteriaValue = parseRecord(item.criteria_value ?? item.criteria);
  const targetValue = Number(
    criteriaValue.target ??
      criteriaValue.value ??
      criteriaValue.count ??
      criteriaValue.kilometers ??
      criteriaValue.distance ??
      criteriaValue.distance_km ??
      criteriaValue.total ??
      0
  );
  return {
    code: getField(item, ['code']),
    name: getField(item, ['name']),
    name_ar: getField(item, ['name_ar']),
    description: getField(item, ['description']),
    description_ar: getField(item, ['description_ar']),
    badge_icon_url: getField(item, ['badge_icon_url', 'icon']),
    category: getField(item, ['category'], 'general'),
    criteria_type: getField(item, ['criteria_type'], 'manual'),
    criteria_target: Number.isFinite(targetValue) && targetValue > 0 ? String(targetValue) : '',
    criteria_region: typeof criteriaValue.region === 'string' ? criteriaValue.region : '',
    criteria_place_type: typeof criteriaValue.type === 'string' ? criteriaValue.type : 'spring',
    criteria_value_raw: criteriaValue,
    points: String(getNumberField(item, ['points'], 0)),
    is_active: getBooleanField(item, ['is_active'], true),
  };
}

function normalizeBadgeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s*([:-])\s*/g, '$1')
    .replace(/\s+/g, '_');
}

// Fixed: criteria_value serialized as object; includes name_ar, description_ar
function buildBadgePayload(form: BadgeFormState): BadgePayload {
  const criteriaValue = omitKeys(form.criteria_value_raw, [
    'target',
    'value',
    'count',
    'kilometers',
    'distance',
    'distance_km',
    'total',
    'region',
    'type',
  ]);
  const target = numeric(form.criteria_target, 0);

  if (form.criteria_type === 'unique_places') {
    if (form.criteria_place_type.trim()) criteriaValue.type = form.criteria_place_type.trim();
    if (target > 0) criteriaValue.target = target;
  } else if (form.criteria_type === 'region_trails') {
    if (form.criteria_region.trim()) criteriaValue.region = form.criteria_region.trim();
    if (target > 0) criteriaValue.target = target;
  } else if (form.criteria_type === 'manual') {
    // Keep any custom metadata the admin already had, but do not force rule fields.
  } else if (target > 0) {
    criteriaValue.target = target;
  }

  return {
    code: normalizeBadgeCode(form.code),
    name: form.name.trim(),
    name_ar: nullable(form.name_ar),
    description: form.description.trim(),
    description_ar: nullable(form.description_ar),
    badge_icon_url: nullable(form.badge_icon_url),
    category: form.category.trim(),
    criteria_type: form.criteria_type.trim(),
    criteria_value: Object.keys(criteriaValue).length > 0 ? criteriaValue : {},
    points: numeric(form.points),
    is_active: form.is_active,
  };
}

function BadgesSection({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [items, setItems] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<BadgeFormState>(emptyBadgeForm);
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getAdminBadges());
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to load badges.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const editItem = async (item: AdminRecord) => {
    const id = getAdminId(item);
    if (!id) return;
    setFormError('');
    try {
      const detail = await getAdminBadge(id);
      setEditingId(getAdminId(detail) || id);
      setForm(badgeFormFromRecord(detail));
    } catch {
      setEditingId(id);
      setForm(badgeFormFromRecord(item));
    }
  };

  const resetForm = () => { setEditingId(''); setForm(emptyBadgeForm); setFormError(''); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    try {
      const payload = buildBadgePayload(form);
      const saved = editingId
        ? await updateAdminBadge(editingId, payload)
        : await createAdminBadge(payload);
      const savedId = getAdminId(saved) || editingId;
      onNotice({ type: 'success', message: `Badge ${editingId ? 'updated' : 'created'}${savedId ? ` (${savedId})` : ''}.` });
      resetForm();
      await load();
    } catch (error) {
      setFormError(toErrorMessage(error, 'Unable to save badge. Check criteria values and selected rule.'));
    }
  };

  const disableBadge = async (item: AdminRecord) => {
    const id = getAdminId(item);
    if (!id || !window.confirm('Disable this badge? This will set it inactive.')) return;
    try {
      await deleteAdminBadge(id);
      onNotice({ type: 'success', message: 'Badge disabled.' });
      await load();
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to disable badge.') });
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader title="Badges Management" description="Create, edit, and disable badges." onRefresh={load} />

      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3>{editingId ? 'Edit Badge' : 'Create Badge'}</h3>
          {editingId && (
            <AdminButton type="button" variant="ghost" onClick={resetForm}>
              <X className="h-4 w-4" />Cancel
            </AdminButton>
          )}
        </div>
        {formError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
        )}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <FieldLabel>Code</FieldLabel>
            <TextInput
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              onBlur={() => setForm((current) => ({ ...current, code: normalizeBadgeCode(current.code) }))}
              required
              placeholder="e.g. FIRST_HIKE"
            />
          </div>
          <div>
            <FieldLabel>Name</FieldLabel>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Name (Arabic)</FieldLabel>
            <TextInput value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} dir="rtl" />
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <TextInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Criteria Type</FieldLabel>
            <SelectInput value={form.criteria_type} onChange={(e) => setForm({ ...form, criteria_type: e.target.value })} required>
              {badgeCriteriaTypeOptions.map((option) => (
                <option key={option} value={option}>{humanize(option)}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>Points</FieldLabel>
            <TextInput type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
          </div>
          <div className="lg:col-span-2">
            <FieldLabel>Icon URL</FieldLabel>
            <TextInput value={form.badge_icon_url} onChange={(e) => setForm({ ...form, badge_icon_url: e.target.value })} />
          </div>
          <label className="flex items-center gap-3 pt-7 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
          <div className="lg:col-span-3">
            <FieldLabel>Description</FieldLabel>
            <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          </div>
          <div className="lg:col-span-3">
            <FieldLabel>Description (Arabic)</FieldLabel>
            <TextArea value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} dir="rtl" />
          </div>
          <div className="lg:col-span-3">
            <div className="rounded-md border border-border bg-muted/20 p-4">
              <div className="mb-3">
                <FieldLabel>Criteria</FieldLabel>
                <p className="text-xs text-muted-foreground">Pick the rule type, then fill the matching fields below.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <FieldLabel>Target</FieldLabel>
                  <TextInput
                    type="number"
                    min="0"
                    value={form.criteria_target}
                    onChange={(e) => setForm({ ...form, criteria_target: e.target.value })}
                    placeholder="e.g. 5"
                  />
                </div>
                <div>
                  <FieldLabel>Place Type</FieldLabel>
                  <SelectInput
                    value={form.criteria_place_type}
                    onChange={(e) => setForm({ ...form, criteria_place_type: e.target.value })}
                    disabled={form.criteria_type !== 'unique_places'}
                  >
                    {uniquePlaceTypes.map((option) => (
                      <option key={option} value={option}>{humanize(option)}</option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Region</FieldLabel>
                  <TextInput
                    value={form.criteria_region}
                    onChange={(e) => setForm({ ...form, criteria_region: e.target.value })}
                    placeholder="e.g. Hebron"
                    disabled={form.criteria_type !== 'region_trails'}
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                `Target` applies to count-based badges. `Place Type` is used for unique places. `Region` is used for region trail badges.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <AdminButton type="submit">
            {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Save Badge' : 'Create Badge'}
          </AdminButton>
        </div>
      </form>

      {loading ? <LoadingPanel /> : (
        <DynamicTable
          items={items}
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Name' },
            { key: 'category', label: 'Category' },
            { key: 'criteria_type', label: 'Criteria' },
            { key: 'points', label: 'Points' },
            { key: 'is_active', label: 'Active', render: (item) => <StatusPill value={getBooleanField(item, ['is_active']) ? 'active' : 'inactive'} /> },
          ]}
          actions={(item) => (
            <div className="flex justify-end gap-2">
              <AdminButton variant="secondary" onClick={() => editItem(item)}>Edit</AdminButton>
              <AdminButton variant="danger" onClick={() => disableBadge(item)}>
                <Trash2 className="h-4 w-4" />Disable
              </AdminButton>
            </div>
          )}
        />
      )}
    </section>
  );
}

// ─── Incidents ────────────────────────────────────────────────────────────────

function IncidentsSection({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [items, setItems] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState<IncidentModerationPayload['moderation_status']>('pending');
  const [note, setNote] = useState('');
  // Fixed: expose the status filter the backend supports
  const [statusFilter, setStatusFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getAdminIncidents(statusFilter.trim() || undefined));
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to load incidents.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectItem = (item: AdminRecord) => {
    const id = getAdminId(item);
    setSelectedId(id);
    setStatus(getField(item, ['moderation_status'], 'pending') as IncidentModerationPayload['moderation_status']);
    setNote(getField(item, ['moderation_note']));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    try {
      await updateIncidentModeration(selectedId, { moderation_status: status, moderation_note: nullable(note) });
      onNotice({ type: 'success', message: 'Incident moderation updated.' });
      setSelectedId('');
      setNote('');
      await load();
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to update moderation.') });
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader title="Safety Incidents Moderation" description="Review reported incidents and update moderation status and note." onRefresh={load} />

      {/* Status filter */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row">
        <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-48">
          <option value="">All statuses</option>
          {moderationStatuses.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </SelectInput>
        <AdminButton onClick={load}><RefreshCw className="h-4 w-4" />Apply Filter</AdminButton>
      </div>

      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4">Moderation Update</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr_auto]">
          <div>
            <FieldLabel>Selected Incident ID</FieldLabel>
            <TextInput value={selectedId} readOnly placeholder="Choose a row below" />
          </div>
          <div>
            <FieldLabel>Moderation Note</FieldLabel>
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <SelectInput value={status} onChange={(e) => setStatus(e.target.value as IncidentModerationPayload['moderation_status'])}>
              {moderationStatuses.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </SelectInput>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <AdminButton type="submit" disabled={!selectedId}><Save className="h-4 w-4" />Save Moderation</AdminButton>
        </div>
      </form>

      {loading ? <LoadingPanel /> : (
        <DynamicTable
          items={items}
          columns={[
            { key: 'type', label: 'Type', render: (item) => recordSnippet(item, ['incident_type', 'type', 'category']) },
            { key: 'description', label: 'Description', render: (item) => recordSnippet(item, ['description', 'message', 'details']) },
            { key: 'trust_level', label: 'Trust', render: (item) => <StatusPill value={getField(item, ['trust_level'], '-')} /> },
            { key: 'confirmations', label: 'Confirms', render: (item) => getField(item, ['confirmations_count', 'confirmed_count'], '0') },
            { key: 'disputes', label: 'Disputes', render: (item) => getField(item, ['disputes_count'], '0') },
            { key: 'moderation_status', label: 'Moderation', render: (item) => <StatusPill value={getField(item, ['moderation_status'], 'pending')} /> },
            { key: 'risk_level', label: 'Risk', render: (item) => <StatusPill value={getField(item, ['risk_level', 'severity'], '-')} /> },
            { key: 'created_at', label: 'Reported', render: (item) => recordSnippet(item, ['created_at', 'reported_at']) },
          ]}
          actions={(item) => <AdminButton variant="secondary" onClick={() => selectItem(item)}>Moderate</AdminButton>}
        />
      )}
    </section>
  );
}

// ─── Locations ────────────────────────────────────────────────────────────────

// Fixed: added operating_hours; removed source (not in backend schema)
function locationFormFromRecord(item: AdminRecord): LocationFormState {
  return {
    name: getField(item, ['name']),
    name_ar: getField(item, ['name_ar']),
    location_type: getField(item, ['location_type'], 'settlement'),
    latitude: String(getNumberField(item, ['latitude', 'lat'], 0)),
    longitude: String(getNumberField(item, ['longitude', 'lng', 'lon'], 0)),
    danger_radius_meters: String(getNumberField(item, ['danger_radius_meters', 'radius_meters'], 500)),
    risk_level: getField(item, ['risk_level'], 'medium'),
    description: getField(item, ['description']),
    description_ar: getField(item, ['description_ar']),
    operating_hours: getField(item, ['operating_hours']),
    is_active: getBooleanField(item, ['is_active'], true),
  };
}

// Fixed: removed source (not in backend schema); added operating_hours
function buildLocationPayload(form: LocationFormState): DangerousLocationPayload {
  return {
    name: form.name.trim(),
    name_ar: nullable(form.name_ar),
    location_type: form.location_type,
    latitude: numeric(form.latitude),
    longitude: numeric(form.longitude),
    danger_radius_meters: numeric(form.danger_radius_meters, 500),
    risk_level: form.risk_level,
    operating_hours: nullable(form.operating_hours),
    description: nullable(form.description),
    description_ar: nullable(form.description_ar),
    is_active: form.is_active,
  };
}

function LocationsSection({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [items, setItems] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<LocationFormState>(emptyLocationForm);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getAdminDangerousLocations());
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to load dangerous locations.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setEditingId(''); setForm(emptyLocationForm); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = buildLocationPayload(form);
      const saved = editingId
        ? await updateAdminDangerousLocation(editingId, payload)
        : await createAdminDangerousLocation(payload);
      const savedId = getAdminId(saved) || editingId;
      onNotice({ type: 'success', message: `Dangerous location ${editingId ? 'updated' : 'created'}${savedId ? ` (${savedId})` : ''}.` });
      resetForm();
      await load();
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to save dangerous location.') });
    }
  };

  const remove = async (item: AdminRecord) => {
    const id = getAdminId(item);
    if (!id || !window.confirm('Delete this dangerous location?')) return;
    try {
      await deleteAdminDangerousLocation(id);
      onNotice({ type: 'success', message: 'Dangerous location deleted.' });
      await load();
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to delete dangerous location.') });
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader title="Dangerous Locations Management" description="Create, edit, and delete map safety zones." onRefresh={load} />

      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3>{editingId ? 'Edit Location' : 'Create Location'}</h3>
          {editingId && (
            <AdminButton type="button" variant="ghost" onClick={resetForm}>
              <X className="h-4 w-4" />Cancel
            </AdminButton>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <FieldLabel>Name</FieldLabel>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Name (Arabic)</FieldLabel>
            <TextInput value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} dir="rtl" />
          </div>
          <div>
            <FieldLabel>Location Type</FieldLabel>
            <SelectInput value={form.location_type} onChange={(e) => setForm({ ...form, location_type: e.target.value })}>
              {locationTypes.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>Latitude</FieldLabel>
            <TextInput type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Longitude</FieldLabel>
            <TextInput type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Radius (meters)</FieldLabel>
            <TextInput type="number" value={form.danger_radius_meters} onChange={(e) => setForm({ ...form, danger_radius_meters: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Risk Level</FieldLabel>
            <SelectInput value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value })}>
              {['low', 'medium', 'high', 'critical'].map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>Operating Hours</FieldLabel>
            <TextInput value={form.operating_hours} onChange={(e) => setForm({ ...form, operating_hours: e.target.value })} placeholder="e.g. 06:00-22:00" />
          </div>
          <label className="flex items-center gap-3 pt-7 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
          <div className="lg:col-span-3">
            <FieldLabel>Description</FieldLabel>
            <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="lg:col-span-3">
            <FieldLabel>Description (Arabic)</FieldLabel>
            <TextArea value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} dir="rtl" />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <AdminButton type="submit">
            {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Save Location' : 'Create Location'}
          </AdminButton>
        </div>
      </form>

      {loading ? <LoadingPanel /> : (
        <DynamicTable
          items={items}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'location_type', label: 'Type', render: (item) => humanize(getField(item, ['location_type'], '-')) },
            { key: 'risk_level', label: 'Risk', render: (item) => <StatusPill value={getField(item, ['risk_level'], '-')} /> },
            { key: 'operating_hours', label: 'Hours', render: (item) => getField(item, ['operating_hours'], '-') },
            { key: 'latitude', label: 'Latitude', render: (item) => getField(item, ['latitude', 'lat'], '-') },
            { key: 'longitude', label: 'Longitude', render: (item) => getField(item, ['longitude', 'lng', 'lon'], '-') },
            { key: 'is_active', label: 'Active', render: (item) => <StatusPill value={getBooleanField(item, ['is_active']) ? 'active' : 'inactive'} /> },
          ]}
          actions={(item) => (
            <div className="flex justify-end gap-2">
              <AdminButton variant="secondary" onClick={() => { setEditingId(getAdminId(item)); setForm(locationFormFromRecord(item)); }}>Edit</AdminButton>
              <AdminButton variant="danger" onClick={() => remove(item)}><Trash2 className="h-4 w-4" />Delete</AdminButton>
            </div>
          )}
        />
      )}
    </section>
  );
}

// ─── Read-only reports ────────────────────────────────────────────────────────

function ReadOnlyReportsSection({
  title,
  description,
  loadItems,
  columns,
  filterPlaceholder,
  onNotice,
}: {
  title: string;
  description: string;
  loadItems: (query?: Record<string, string>) => Promise<AdminRecord[]>;
  columns: Column[];
  filterPlaceholder: string;
  onNotice: (notice: Notice) => void;
}) {
  const [items, setItems] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setItems(await loadItems(filter.trim() ? { q: filter.trim() } : undefined));
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, `Unable to load ${title.toLowerCase()}.`) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <section className="space-y-6">
      <SectionHeader title={title} description={description} onRefresh={load} />
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row">
        <TextInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={filterPlaceholder} />
        <AdminButton onClick={load}><RefreshCw className="h-4 w-4" />Apply Filter</AdminButton>
      </div>
      {loading ? <LoadingPanel /> : <DynamicTable items={items} columns={columns} />}
    </section>
  );
}

// ─── OCHA ─────────────────────────────────────────────────────────────────────

function OchaSection({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [logs, setLogs] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setLogs(await getAdminOchaLogs());
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to load OCHA logs.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const triggerFetch = async () => {
    setFetching(true);
    try {
      const response = await fetchAdminOcha();
      const importedCount = getField(response, ['records_imported', 'imported_count', 'count']);
      const message = importedCount && importedCount !== '-'
        ? `OCHA import completed. Imported ${importedCount} records.`
        : 'OCHA import completed.';
      onNotice({ type: 'success', message });
      await load();
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to trigger OCHA fetch.') });
    } finally {
      setFetching(false);
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader title="OCHA Management" description="View import logs and trigger a manual OCHA fetch." onRefresh={load} />
      <div className="rounded-lg border border-border bg-card p-5">
        <AdminButton onClick={triggerFetch} disabled={fetching}>
          <Database className="h-4 w-4" />
          {fetching ? 'Fetching...' : 'Trigger OCHA Fetch'}
        </AdminButton>
      </div>
      {loading ? <LoadingPanel /> : (
        <DynamicTable
          items={logs}
          columns={[
            { key: 'status', label: 'Status', render: (item) => <StatusPill value={getField(item, ['status'], '-')} /> },
            { key: 'source', label: 'Source', render: (item) => getField(item, ['source', 'import_source'], '-') },
            { key: 'records_imported', label: 'Imported', render: (item) => getField(item, ['records_imported', 'imported_count', 'count'], '-') },
            { key: 'message', label: 'Message', render: (item) => recordSnippet(item, ['message', 'error', 'details']) },
            { key: 'created_at', label: 'Created', render: (item) => recordSnippet(item, ['created_at', 'started_at']) },
          ]}
        />
      )}
    </section>
  );
}

// ─── Shared section header ────────────────────────────────────────────────────

function SectionHeader({ title, description, onRefresh }: { title: string; description: string; onRefresh: () => void }) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-xl">{description}</p>
      </div>
      <AdminButton variant="secondary" onClick={onRefresh} className="shrink-0">
        <RefreshCw className="h-4 w-4" />Refresh
      </AdminButton>
    </div>
  );
}

// ─── Root page ────────────────────────────────────────────────────────────────

export function AdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      if (!getAccessToken()) { setAccess('denied'); return; }
      try {
        const user = await getMe();
        if (!cancelled) setAccess(user.role === 'admin' ? 'allowed' : 'denied');
      } catch {
        if (!cancelled) setAccess('denied');
      }
    };

    checkAccess();
    return () => { cancelled = true; };
  }, []);

  const showNotice = (nextNotice: Notice) => setNotice(nextNotice);

  if (access === 'checking') {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <LoadingPanel label="Checking admin access..." />
        </div>
      </div>
    );
  }

  if (access === 'denied') {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1>Admin Access Required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with an account whose profile role is admin to use this panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        <aside className="lg:w-64 lg:shrink-0">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="mb-3 px-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin</p>
              <h1 className="text-xl">Control Panel</h1>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {adminSections.map(({ id, label, icon: Icon }) => {
                const active = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => { setActiveSection(id); setNotice(null); }}
                    className={`flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <NoticeBanner notice={notice} onClear={() => setNotice(null)} />
          {activeSection === 'users' && <UsersSection onNotice={showNotice} />}
          {activeSection === 'dashboard' && <DashboardSection onNotice={showNotice} />}
          {activeSection === 'challenges' && <ChallengesSection onNotice={showNotice} />}
          {activeSection === 'badges' && <BadgesSection onNotice={showNotice} />}
          {activeSection === 'incidents' && <IncidentsSection onNotice={showNotice} />}
          {activeSection === 'locations' && <LocationsSection onNotice={showNotice} />}
          {activeSection === 'checkpointReports' && (
            <ReadOnlyReportsSection
              title="Checkpoint Reports"
              description="View, list, and filter checkpoint reports."
              filterPlaceholder="Filter reports"
              loadItems={getAdminCheckpointReports}
              onNotice={showNotice}
              columns={[
                { key: 'checkpoint_name', label: 'Checkpoint', render: (item) => recordSnippet(item, ['checkpoint_name', 'name', 'location_name']) },
                { key: 'status', label: 'Status', render: (item) => <StatusPill value={getField(item, ['status', 'checkpoint_status'], '-')} /> },
                { key: 'wait_time_minutes', label: 'Wait', render: (item) => getField(item, ['wait_time_minutes', 'wait_minutes'], '-') },
                { key: 'description', label: 'Description', render: (item) => recordSnippet(item, ['notes', 'description', 'note', 'details']) },
                { key: 'created_at', label: 'Reported', render: (item) => recordSnippet(item, ['created_at', 'reported_at']) },
              ]}
            />
          )}
          {activeSection === 'sosEvents' && (
            <ReadOnlyReportsSection
              title="SOS Events"
              description="View SOS events and their current status."
              filterPlaceholder="Filter SOS events"
              loadItems={getAdminSosEvents}
              onNotice={showNotice}
              columns={[
                { key: 'user', label: 'User', render: (item) => getField(item, ['full_name', 'user_email', 'user_id'], '-') },
                { key: 'status', label: 'Status', render: (item) => <StatusPill value={getField(item, ['status'], '-')} /> },
                { key: 'notification_status', label: 'Notify', render: (item) => <StatusPill value={getField(item, ['notification_status', 'status_note'], '-')} /> },
                { key: 'contacts_notified', label: 'Contacts', render: (item) => getField(item, ['contacts_notified', 'notified_contact_count', 'emergency_contacts_notified'], '0') },
                { key: 'message', label: 'Message', render: (item) => recordSnippet(item, ['message', 'status_note']) },
                { key: 'location', label: 'Location', render: (item) => `${getField(item, ['latitude', 'lat'], '?')}, ${getField(item, ['longitude', 'lng', 'lon'], '?')}` },
                { key: 'occurred_at', label: 'Occurred', render: (item) => recordSnippet(item, ['occurred_at', 'created_at', 'triggered_at']) },
              ]}
            />
          )}
          {activeSection === 'ocha' && <OchaSection onNotice={showNotice} />}
        </main>
      </div>
    </div>
  );
}
