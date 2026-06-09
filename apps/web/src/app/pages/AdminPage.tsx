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
  deleteAdminChallenge,
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
  publishAdminChallenge,
  recalculateAdminChallenge,
  updateAdminBadge,
  updateAdminChallenge,
  updateAdminDangerousLocation,
  updateIncidentModeration,
  type AdminDashboard,
  type AdminRecord,
  type BadgePayload,
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

type AdminSection =
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
  goal_metadata: string;
  start_at: string;
  end_at: string;
  visibility: string;
  status: string;
  reward_badge_id: string;
  reward_points: string;
};

type BadgeFormState = {
  code: string;
  name: string;
  description: string;
  badge_icon_url: string;
  category: string;
  criteria_type: string;
  criteria_value: string;
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
  source: string;
  is_active: boolean;
};

const adminSections: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
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
  goal_type: 'distance',
  goal_value: '1',
  goal_metadata: '{}',
  start_at: '',
  end_at: '',
  visibility: 'public',
  status: 'draft',
  reward_badge_id: '',
  reward_points: '0',
};

const emptyBadgeForm: BadgeFormState = {
  code: '',
  name: '',
  description: '',
  badge_icon_url: '',
  category: 'general',
  criteria_type: 'manual',
  criteria_value: '1',
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
  source: 'manual',
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
  'rejected',
  'hidden',
];

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
    if (value != null) return String(value);
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
  return date.toISOString().slice(0, 16);
}

function nullable(value: string) {
  return value.trim() ? value.trim() : null;
}

function numeric(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function recordSnippet(item: AdminRecord, keys: string[]) {
  const value = getField(item, keys, '-');
  return value.length > 90 ? `${value.slice(0, 87)}...` : value;
}

function StatusPill({ value }: { value: unknown }) {
  const status = String(value ?? 'unknown');
  const className = status.match(/active|approved|published|complete|success/i)
    ? 'border-green-200 bg-green-50 text-green-700'
    : status.match(/rejected|hidden|critical|failed|inactive|archived/i)
      ? 'border-red-200 bg-red-50 text-red-700'
      : status.match(/pending|draft|medium|warning/i)
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-border bg-muted/30 text-muted-foreground';

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
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
    ? 'border-green-200 bg-green-50 text-green-700'
    : 'border-red-200 bg-red-50 text-red-700';

  return (
    <div className={`mb-5 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${classes}`}>
      <span>{notice.message}</span>
      <button onClick={onClear} className="rounded p-0.5 hover:bg-white/60" title="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function LoadingPanel({ label = 'Loading admin data...' }: { label?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function DynamicTable({ columns, items, actions }: { columns: Column[]; items: AdminRecord[]; actions?: (item: AdminRecord) => ReactNode }) {
  if (items.length === 0) return <EmptyPanel label="No records found." />;

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.label}</TableHead>
            ))}
            {actions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => {
            const id = getAdminId(item) || `row-${index}`;
            return (
              <TableRow key={id}>
                {columns.map((column) => (
                  <TableCell key={column.key} className="max-w-[260px] overflow-hidden text-ellipsis">
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
  );
}

function collectMetrics(dashboard: AdminDashboard | null) {
  if (!dashboard) return [];
  const metrics: Array<{ label: string; value: number | string; group?: string }> = [];

  Object.entries(dashboard).forEach(([key, value]) => {
    if (typeof value === 'number') {
      metrics.push({ label: humanize(key), value });
      return;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value as Record<string, unknown>).forEach(([innerKey, innerValue]) => {
        if (typeof innerValue === 'number' || typeof innerValue === 'string') {
          metrics.push({ group: humanize(key), label: humanize(innerKey), value: innerValue });
        }
      });
    }
  });

  return metrics.slice(0, 24);
}

function findTimeSeries(dashboard: AdminDashboard | null) {
  if (!dashboard) return [];
  const series: Array<{ title: string; data: AdminRecord[]; xKey: string; yKey: string }> = [];

  Object.entries(dashboard).forEach(([key, value]) => {
    if (!Array.isArray(value) || value.length === 0) return;
    const first = value[0];
    if (!first || typeof first !== 'object') return;
    const keys = Object.keys(first as AdminRecord);
    const xKey = keys.find((itemKey) => /date|day|month|time|created/i.test(itemKey));
    const yKey = keys.find((itemKey) => typeof (first as AdminRecord)[itemKey] === 'number');
    if (xKey && yKey) {
      series.push({ title: humanize(key), data: value as AdminRecord[], xKey, yKey });
    }
  });

  return series.slice(0, 3);
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

  useEffect(() => {
    loadDashboard();
  }, []);

  const metrics = useMemo(() => collectMetrics(dashboard), [dashboard]);
  const timeSeries = useMemo(() => findTimeSeries(dashboard), [dashboard]);

  if (loading) return <LoadingPanel />;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2>Admin Dashboard</h2>
          <p className="text-sm text-muted-foreground">Users, trails, activities, safety, notifications, challenges, and badges.</p>
        </div>
        <AdminButton variant="secondary" onClick={loadDashboard}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </AdminButton>
      </div>

      {metrics.length === 0 ? (
        <EmptyPanel label="Dashboard stats are not available yet." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={`${metric.group ?? 'root'}-${metric.label}`} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.group ?? 'Overview'}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{textValue(metric.value)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>
      )}

      {timeSeries.length > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {timeSeries.map((series) => (
            <div key={series.title} className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-4">{series.title}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series.data}>
                    <XAxis dataKey={series.xKey} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey={series.yKey} stroke="var(--primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function challengeFormFromRecord(item: AdminRecord): ChallengeFormState {
  const metadata = item.goal_metadata ?? {};
  return {
    title: getField(item, ['title']),
    description: getField(item, ['description']),
    goal_type: getField(item, ['goal_type'], 'distance'),
    goal_value: String(getNumberField(item, ['goal_value'], 1)),
    goal_metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata, null, 2),
    start_at: toDateTimeInput(item.start_at),
    end_at: toDateTimeInput(item.end_at),
    visibility: getField(item, ['visibility'], 'public'),
    status: getField(item, ['status'], 'draft'),
    reward_badge_id: getField(item, ['reward_badge_id']),
    reward_points: String(getNumberField(item, ['reward_points'], 0)),
  };
}

function buildChallengePayload(form: ChallengeFormState): ChallengePayload {
  const metadata = form.goal_metadata.trim() ? JSON.parse(form.goal_metadata) : null;
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    goal_type: form.goal_type,
    goal_value: numeric(form.goal_value, 1),
    goal_metadata: metadata,
    start_at: nullable(form.start_at),
    end_at: nullable(form.end_at),
    visibility: form.visibility,
    status: form.status,
    reward_badge_id: nullable(form.reward_badge_id),
    reward_points: numeric(form.reward_points),
  };
}

function ChallengesSection({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [items, setItems] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<ChallengeFormState>(emptyChallengeForm);
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getAdminChallenges());
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to load challenges.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId('');
    setForm(emptyChallengeForm);
    setFormError('');
  };

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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');

    try {
      const payload = buildChallengePayload(form);
      const saved = editingId
        ? await updateAdminChallenge(editingId, payload)
        : await createAdminChallenge(payload);
      const savedId = getAdminId(saved) || editingId;
      onNotice({ type: 'success', message: `Challenge ${editingId ? 'updated' : 'created'}${savedId ? ` (${savedId})` : ''}.` });
      resetForm();
      await load();
    } catch (error) {
      setFormError(toErrorMessage(error, 'Unable to save challenge. Check required fields and metadata JSON.'));
    }
  };

  const runAction = async (item: AdminRecord, action: 'publish' | 'archive' | 'delete' | 'recalculate') => {
    const id = getAdminId(item);
    if (!id) return;
    if (action === 'delete' && !window.confirm('Archive this challenge? The backend treats delete as archive.')) return;

    try {
      if (action === 'publish') await publishAdminChallenge(id);
      if (action === 'archive') await archiveAdminChallenge(id);
      if (action === 'delete') await deleteAdminChallenge(id);
      if (action === 'recalculate') await recalculateAdminChallenge(id);
      onNotice({ type: 'success', message: `Challenge ${action} completed.` });
      await load();
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, `Unable to ${action} challenge.`) });
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader title="Challenges Management" description="Create, edit, publish, archive, delete, and recalculate challenge progress." onRefresh={load} />

      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3>{editingId ? 'Edit Challenge' : 'Create Challenge'}</h3>
          {editingId && (
            <AdminButton type="button" variant="ghost" onClick={resetForm}>
              <X className="h-4 w-4" />
              Cancel
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
            <TextInput value={form.goal_type} onChange={(e) => setForm({ ...form, goal_type: e.target.value })} required />
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
            <TextInput type="number" value={form.reward_points} onChange={(e) => setForm({ ...form, reward_points: e.target.value })} />
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
              <option value="admin">Admin</option>
            </SelectInput>
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <SelectInput value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </SelectInput>
          </div>
          <div>
            <FieldLabel>Reward Badge ID</FieldLabel>
            <TextInput value={form.reward_badge_id} onChange={(e) => setForm({ ...form, reward_badge_id: e.target.value })} />
          </div>
          <div className="lg:col-span-2">
            <FieldLabel>Goal Metadata JSON</FieldLabel>
            <TextArea value={form.goal_metadata} onChange={(e) => setForm({ ...form, goal_metadata: e.target.value })} className="font-mono" />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <AdminButton type="submit">
            {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Save Challenge' : 'Create Challenge'}
          </AdminButton>
        </div>
      </form>

      {loading ? <LoadingPanel /> : (
        <DynamicTable
          items={items}
          columns={[
            { key: 'title', label: 'Title', render: (item) => recordSnippet(item, ['title', 'name']) },
            { key: 'goal_type', label: 'Goal' },
            { key: 'goal_value', label: 'Value' },
            { key: 'status', label: 'Status', render: (item) => <StatusPill value={item.status} /> },
            { key: 'visibility', label: 'Visibility' },
            { key: 'reward_points', label: 'Points' },
          ]}
          actions={(item) => (
            <div className="flex flex-wrap justify-end gap-2">
              <AdminButton variant="secondary" onClick={() => editItem(item)}>Edit</AdminButton>
              <AdminButton variant="secondary" onClick={() => runAction(item, 'publish')}>Publish</AdminButton>
              <AdminButton variant="secondary" onClick={() => runAction(item, 'archive')}>
                <Archive className="h-4 w-4" />
                Archive
              </AdminButton>
              <AdminButton variant="secondary" onClick={() => runAction(item, 'recalculate')}>Recalc</AdminButton>
              <AdminButton variant="danger" onClick={() => runAction(item, 'delete')}>
                <Trash2 className="h-4 w-4" />
                Delete
              </AdminButton>
            </div>
          )}
        />
      )}
    </section>
  );
}

function badgeFormFromRecord(item: AdminRecord): BadgeFormState {
  return {
    code: getField(item, ['code']),
    name: getField(item, ['name']),
    description: getField(item, ['description']),
    badge_icon_url: getField(item, ['badge_icon_url', 'icon']),
    category: getField(item, ['category'], 'general'),
    criteria_type: getField(item, ['criteria_type'], 'manual'),
    criteria_value: String(getNumberField(item, ['criteria_value'], 1)),
    points: String(getNumberField(item, ['points'], 0)),
    is_active: getBooleanField(item, ['is_active'], true),
  };
}

function buildBadgePayload(form: BadgeFormState): BadgePayload {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    badge_icon_url: nullable(form.badge_icon_url),
    category: form.category.trim(),
    criteria_type: form.criteria_type.trim(),
    criteria_value: numeric(form.criteria_value, 1),
    points: numeric(form.points),
    is_active: form.is_active,
  };
}

function BadgesSection({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [items, setItems] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<BadgeFormState>(emptyBadgeForm);

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

  useEffect(() => {
    load();
  }, []);

  const editItem = async (item: AdminRecord) => {
    const id = getAdminId(item);
    if (!id) return;
    try {
      const detail = await getAdminBadge(id);
      setEditingId(getAdminId(detail) || id);
      setForm(badgeFormFromRecord(detail));
    } catch {
      setEditingId(id);
      setForm(badgeFormFromRecord(item));
    }
  };

  const resetForm = () => {
    setEditingId('');
    setForm(emptyBadgeForm);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = buildBadgePayload(form);
      const saved = editingId ? await updateAdminBadge(editingId, payload) : await createAdminBadge(payload);
      const savedId = getAdminId(saved) || editingId;
      onNotice({ type: 'success', message: `Badge ${editingId ? 'updated' : 'created'}${savedId ? ` (${savedId})` : ''}.` });
      resetForm();
      await load();
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to save badge.') });
    }
  };

  const disableBadge = async (item: AdminRecord) => {
    const id = getAdminId(item);
    if (!id || !window.confirm('Disable this badge? The backend treats delete as is_active = false.')) return;
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
          {editingId && <AdminButton type="button" variant="ghost" onClick={resetForm}><X className="h-4 w-4" />Cancel</AdminButton>}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <FieldLabel>Code</FieldLabel>
            <TextInput value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Name</FieldLabel>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <TextInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
          </div>
          <div className="lg:col-span-3">
            <FieldLabel>Description</FieldLabel>
            <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Icon URL</FieldLabel>
            <TextInput value={form.badge_icon_url} onChange={(e) => setForm({ ...form, badge_icon_url: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Criteria Type</FieldLabel>
            <TextInput value={form.criteria_type} onChange={(e) => setForm({ ...form, criteria_type: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Criteria Value</FieldLabel>
            <TextInput type="number" value={form.criteria_value} onChange={(e) => setForm({ ...form, criteria_value: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Points</FieldLabel>
            <TextInput type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
          </div>
          <label className="flex items-center gap-3 pt-7 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
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
                <Trash2 className="h-4 w-4" />
                Disable
              </AdminButton>
            </div>
          )}
        />
      )}
    </section>
  );
}

function IncidentsSection({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [items, setItems] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState<IncidentModerationPayload['moderation_status']>('pending');
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getAdminIncidents());
    } catch (error) {
      onNotice({ type: 'error', message: toErrorMessage(error, 'Unable to load incidents.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
      <SectionHeader title="Safety Incidents Moderation" description="Review reported incidents and update only moderation status and note." onRefresh={load} />
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
              {moderationStatuses.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
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
    source: getField(item, ['source'], 'manual'),
    is_active: getBooleanField(item, ['is_active'], true),
  };
}

function buildLocationPayload(form: LocationFormState): DangerousLocationPayload {
  return {
    name: form.name.trim(),
    name_ar: nullable(form.name_ar),
    location_type: form.location_type,
    latitude: numeric(form.latitude),
    longitude: numeric(form.longitude),
    danger_radius_meters: numeric(form.danger_radius_meters, 500),
    risk_level: form.risk_level,
    description: form.description.trim(),
    description_ar: nullable(form.description_ar),
    source: form.source,
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

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId('');
    setForm(emptyLocationForm);
  };

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
          {editingId && <AdminButton type="button" variant="ghost" onClick={resetForm}><X className="h-4 w-4" />Cancel</AdminButton>}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <FieldLabel>Name</FieldLabel>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Name Arabic</FieldLabel>
            <TextInput value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Location Type</FieldLabel>
            <SelectInput value={form.location_type} onChange={(e) => setForm({ ...form, location_type: e.target.value })}>
              {locationTypes.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
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
            <FieldLabel>Radius Meters</FieldLabel>
            <TextInput type="number" value={form.danger_radius_meters} onChange={(e) => setForm({ ...form, danger_radius_meters: e.target.value })} required />
          </div>
          <div>
            <FieldLabel>Risk Level</FieldLabel>
            <SelectInput value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value })}>
              {['low', 'medium', 'high', 'critical'].map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>Source</FieldLabel>
            <SelectInput value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {['manual', 'ocha', 'osm'].map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
            </SelectInput>
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
            <FieldLabel>Description Arabic</FieldLabel>
            <TextArea value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} />
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
            { key: 'latitude', label: 'Latitude', render: (item) => getField(item, ['latitude', 'lat'], '-') },
            { key: 'longitude', label: 'Longitude', render: (item) => getField(item, ['longitude', 'lng', 'lon'], '-') },
            { key: 'source', label: 'Source' },
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

  useEffect(() => {
    load();
  }, []);

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

  useEffect(() => {
    load();
  }, []);

  const triggerFetch = async () => {
    setFetching(true);
    try {
      const response = await fetchAdminOcha();
      const id = getAdminId(response);
      onNotice({ type: 'success', message: `OCHA fetch started${id ? ` (${id})` : ''}.` });
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

function SectionHeader({ title, description, onRefresh }: { title: string; description: string; onRefresh: () => void }) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h2>{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <AdminButton variant="secondary" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4" />
        Refresh
      </AdminButton>
    </div>
  );
}

export function AdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      if (!getAccessToken()) {
        setAccess('denied');
        return;
      }

      try {
        const user = await getMe();
        if (!cancelled) setAccess(user.role === 'admin' ? 'allowed' : 'denied');
      } catch {
        if (!cancelled) setAccess('denied');
      }
    };

    checkAccess();
    return () => {
      cancelled = true;
    };
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
                    onClick={() => {
                      setActiveSection(id);
                      setNotice(null);
                    }}
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
                { key: 'description', label: 'Description', render: (item) => recordSnippet(item, ['description', 'note', 'details']) },
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
                { key: 'user_id', label: 'User', render: (item) => getField(item, ['user_id', 'profile_id', 'user_email'], '-') },
                { key: 'status', label: 'Status', render: (item) => <StatusPill value={getField(item, ['status'], '-')} /> },
                { key: 'latitude', label: 'Latitude', render: (item) => getField(item, ['latitude', 'lat'], '-') },
                { key: 'longitude', label: 'Longitude', render: (item) => getField(item, ['longitude', 'lng', 'lon'], '-') },
                { key: 'created_at', label: 'Created', render: (item) => recordSnippet(item, ['created_at', 'triggered_at']) },
              ]}
            />
          )}
          {activeSection === 'ocha' && <OchaSection onNotice={showNotice} />}
        </main>
      </div>
    </div>
  );
}
