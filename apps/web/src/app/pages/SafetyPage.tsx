import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, MapPin, Plus, Shield, Trash2, X } from 'lucide-react';
import { getAccessToken } from '../api/client';
import {
  alertTitle,
  getNearbySafetyAlerts,
  getTrailSafety,
  INCIDENT_TYPES,
  reportSafetyIncident,
  SEVERITY_OPTIONS,
  submitIncidentFeedback,
  type NearbySafetyAlert,
  type TrailSafety,
} from '../api/safety';
import {
  addEmergencyContact,
  contactDisplayName,
  createSos,
  deleteEmergencyContact,
  getEmergencyContacts,
  getMySosEvents,
  updateEmergencyContact,
  updateSosStatus,
  type CreateSosResult,
  type EmergencyContact,
  type SosAlert,
} from '../api/sos';

type ContactDraft = {
  id?: string;
  full_name: string;
  phone: string;
  relationship: string;
  notify_on_sos: boolean;
  is_primary: boolean;
};

const emptyContactDraft: ContactDraft = {
  full_name: '',
  phone: '',
  relationship: '',
  notify_on_sos: true,
  is_primary: false,
};

const TERMINAL_SOS_STATUSES = new Set(['resolved', 'cancelled']);

function getDisplayedSosStatus(event: Pick<SosAlert, 'status' | 'notification_status'>): string {
  if (event.status === 'notified' && event.notification_status === 'partial') {
    return 'partial';
  }

  return event.status;
}

function getSosStatusMessage(result: CreateSosResult): string {
  const headline =
    result.notification_status === 'failed'
      ? `Emergency contacts reached: ${result.contacts_notified}/${result.emergency_contacts_count}.`
      : result.notification_status === 'partial'
        ? `Some emergency contacts were reached: ${result.contacts_notified}/${result.emergency_contacts_count}.`
        : `Emergency contacts reached: ${result.contacts_notified}/${result.emergency_contacts_count}.`;

  return result.sos_event.status_note ? `${headline} ${result.sos_event.status_note}` : headline;
}

function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function SafetyPage() {
  const [alerts, setAlerts] = useState<NearbySafetyAlert[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [sosEvents, setSosEvents] = useState<SosAlert[]>([]);
  const [trailSafety, setTrailSafety] = useState<TrailSafety | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isTriggeringSos, setIsTriggeringSos] = useState(false);
  const [contactDraft, setContactDraft] = useState<ContactDraft | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportType, setReportType] = useState('other');
  const [reportSeverity, setReportSeverity] = useState('medium');
  const [reportDescription, setReportDescription] = useState('');
  const [sosMessage, setSosMessage] = useState('');
  const isGuest = !getAccessToken();

  const loadSafetyData = useCallback(async () => {
    if (isGuest) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void getNearbySafetyAlerts({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          radius: 5000,
        })
          .then(setAlerts)
          .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load nearby alerts.'));
      },
      () => setErrorMessage('Location permission is required for nearby safety alerts.'),
    );

    void getEmergencyContacts().then(setContacts).catch(() => setContacts([]));
    void getMySosEvents().then(setSosEvents).catch(() => setSosEvents([]));
  }, [isGuest]);

  useEffect(() => {
    void loadSafetyData();
  }, [loadSafetyData]);

  const handleTriggerSos = async () => {
    if (isGuest || isTriggeringSos) return;
    const confirmed = window.confirm(
      'Send an emergency SOS alert to admins and your emergency contacts? Only use this in a real emergency.',
    );
    if (!confirmed) return;

    setIsTriggeringSos(true);
    setErrorMessage('');
    setStatusMessage('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await createSos({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            message: sosMessage.trim() || undefined,
          });
          setStatusMessage(
            `SOS sent. ${getSosStatusMessage(result)}`,
          );
          setSosMessage('');
          const events = await getMySosEvents();
          setSosEvents(events);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to send SOS.');
        } finally {
          setIsTriggeringSos(false);
        }
      },
      () => {
        setErrorMessage('Location permission is required to send SOS.');
        setIsTriggeringSos(false);
      },
    );
  };

  const handleCancelSos = async (event: SosAlert) => {
    if (!window.confirm('Cancel this SOS alert?')) return;
    try {
      await updateSosStatus(event.id, { status: 'cancelled', note: 'Cancelled from web Safety Center' });
      setSosEvents(await getMySosEvents());
      setStatusMessage('SOS alert cancelled.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to cancel SOS.');
    }
  };

  const handleSaveContact = async () => {
    if (!contactDraft) return;
    const fullName = contactDraft.full_name.trim();
    if (fullName.length < 2) {
      setErrorMessage('Contact name must be at least 2 characters.');
      return;
    }
    if (!contactDraft.phone.trim()) {
      setErrorMessage('Add a phone number. Web emergency contacts currently rely on SMS delivery.');
      return;
    }

    setIsSavingContact(true);
    setErrorMessage('');
    try {
      const payload = {
        full_name: fullName,
        phone: contactDraft.phone.trim() || null,
        relationship: contactDraft.relationship.trim() || null,
        notify_on_sos: contactDraft.notify_on_sos,
        is_primary: contactDraft.is_primary,
      };

      if (contactDraft.id) {
        const updated = await updateEmergencyContact(contactDraft.id, payload);
        setContacts((current) => current.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await addEmergencyContact(payload);
        setContacts((current) => [created, ...current]);
      }
      setContactDraft(null);
      setStatusMessage('Emergency contact saved.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save contact.');
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleDeleteContact = async (contact: EmergencyContact) => {
    if (!window.confirm(`Remove ${contactDisplayName(contact)} from emergency contacts?`)) return;
    try {
      await deleteEmergencyContact(contact.id);
      setContacts((current) => current.filter((c) => c.id !== contact.id));
      setStatusMessage('Emergency contact removed.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete contact.');
    }
  };

  const handleReport = async () => {
    if (isGuest) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const result = await reportSafetyIncident({
          incident_type: reportType,
          severity: reportSeverity,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          description: reportDescription.trim() || 'Reported from web Safety Center',
        });
        setStatusMessage(`Incident reported (${result.trust_level ?? result.moderation_status}). Pending moderation.`);
        setShowReportForm(false);
        setReportDescription('');
        void loadSafetyData();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to report incident.');
      }
    });
  };

  const handleFeedback = async (incidentId: string, action: 'confirm' | 'dispute') => {
    if (isGuest) return;
    try {
      const result = await submitIncidentFeedback(incidentId, { action });
      setAlerts((current) =>
        current.map((alert) =>
          alert.id === incidentId && alert.kind === 'incident'
            ? {
                ...alert,
                confirmations_count: result.incident.confirmations_count,
                disputes_count: result.incident.disputes_count,
              }
            : alert,
        ),
      );
      setStatusMessage(action === 'confirm' ? 'Incident confirmed.' : 'Incident disputed.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit feedback.');
    }
  };

  const loadTrailSafety = async (trailId: string) => {
    try {
      setTrailSafety(await getTrailSafety(trailId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load trail safety.');
    }
  };

  const activeSosCount = sosEvents.filter((e) => !TERMINAL_SOS_STATUSES.has(e.status)).length;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="mb-2">Safety Center</h1>
          <p className="text-secondary">Emergency SOS, contacts, nearby alerts, and community incident reporting.</p>
        </div>

        {isGuest && (
          <div className="bg-card rounded-xl border border-border p-6">
            <p className="text-secondary">Sign in to use safety features tied to your account.</p>
          </div>
        )}

        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{errorMessage}</div>}
        {statusMessage && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">{statusMessage}</div>}

        {!isGuest && (
          <section className="bg-destructive/10 rounded-xl border border-destructive/30 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-destructive" />
              <h2 className="text-lg font-semibold text-destructive">Emergency SOS</h2>
            </div>
            <p className="text-sm text-secondary">
              Alerts platform admins and your emergency contacts with your current location.
              {activeSosCount > 0 ? ` You have ${activeSosCount} active SOS event${activeSosCount === 1 ? '' : 's'}.` : ''}
            </p>
            <input
              value={sosMessage}
              onChange={(e) => setSosMessage(e.target.value)}
              placeholder="Optional message for responders"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={isTriggeringSos}
              onClick={() => void handleTriggerSos()}
              className="w-full px-4 py-3 rounded-lg bg-destructive text-white font-medium disabled:opacity-60"
            >
              {isTriggeringSos ? 'Sending SOS…' : 'Send Emergency SOS'}
            </button>
          </section>
        )}

        <section className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Emergency contacts</h2>
            </div>
            {!isGuest && (
              <button
                type="button"
                onClick={() => setContactDraft(emptyContactDraft)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/20"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            )}
          </div>

          {contactDraft && (
            <div className="mb-4 rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{contactDraft.id ? 'Edit contact' : 'New contact'}</h3>
                <button type="button" onClick={() => setContactDraft(null)} className="text-secondary hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                value={contactDraft.full_name}
                onChange={(e) => setContactDraft({ ...contactDraft, full_name: e.target.value })}
                placeholder="Full name"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={contactDraft.phone}
                onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })}
                placeholder="Phone (+972…)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={contactDraft.relationship}
                onChange={(e) => setContactDraft({ ...contactDraft, relationship: e.target.value })}
                placeholder="Relationship (optional)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-secondary">SMS is the active SOS channel on web. Push-only contacts need a linked Traces account.</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={contactDraft.notify_on_sos}
                  onChange={(e) => setContactDraft({ ...contactDraft, notify_on_sos: e.target.checked })}
                />
                Notify on SOS
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={contactDraft.is_primary}
                  onChange={(e) => setContactDraft({ ...contactDraft, is_primary: e.target.checked })}
                />
                Primary contact
              </label>
              <button
                type="button"
                disabled={isSavingContact}
                onClick={() => void handleSaveContact()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-60"
              >
                {isSavingContact ? 'Saving…' : 'Save contact'}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {contacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between gap-3 text-sm rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{contactDisplayName(contact)}</p>
                  <p className="text-secondary text-xs">
                    {[contact.phone, contact.relationship].filter(Boolean).join(' · ') || 'No phone saved'}
                    {contact.notify_on_sos ? ' · SOS alerts on' : ''}
                  </p>
                </div>
                {!isGuest && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setContactDraft({
                          id: contact.id,
                          full_name: contactDisplayName(contact),
                          phone: contact.phone ?? '',
                          relationship: contact.relationship ?? '',
                          notify_on_sos: contact.notify_on_sos ?? true,
                          is_primary: contact.is_primary ?? false,
                        })
                      }
                      className="px-2 py-1 rounded border border-border text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteContact(contact)}
                      className="px-2 py-1 rounded border border-border text-xs text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!contacts.length && <p className="text-secondary text-sm">No emergency contacts saved yet.</p>}
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-lg font-semibold">Nearby alerts</h2>
          </div>
          <div className="space-y-3">
            {alerts.length ? alerts.map((alert) => (
              <div key={`${alert.kind}-${alert.id}`} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex justify-between gap-2">
                  <p className="font-medium">{alertTitle(alert)}</p>
                  <span className="text-xs text-secondary shrink-0">{formatDistance(alert.distance_meters)} away</span>
                </div>
                {alert.verification_label && (
                  <p className="text-xs text-secondary">{alert.verification_label}</p>
                )}
                {alert.kind === 'incident' && (
                  <div className="flex items-center gap-2 text-xs text-secondary">
                    {alert.confirmations_count != null && <span>{alert.confirmations_count} confirms</span>}
                    {alert.disputes_count != null && <span>{alert.disputes_count} disputes</span>}
                  </div>
                )}
                {!isGuest && alert.kind === 'incident' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleFeedback(alert.id, 'confirm')}
                      className="px-2 py-1 rounded border border-border text-xs"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleFeedback(alert.id, 'dispute')}
                      className="px-2 py-1 rounded border border-border text-xs"
                    >
                      Dispute
                    </button>
                  </div>
                )}
              </div>
            )) : <p className="text-secondary text-sm">No nearby alerts right now.</p>}
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold mb-4">Recent SOS events</h2>
          <div className="space-y-2">
            {sosEvents.map((event) => (
              <div key={event.id} className="text-sm flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p>{new Date(event.occurred_at ?? event.created_at).toLocaleString()}</p>
                  {event.contacts_notified != null && (
                    <p className="text-xs text-secondary">{event.contacts_notified} contacts notified</p>
                  )}
                  {event.status_note && <p className="text-xs text-secondary">{event.status_note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-secondary capitalize">{getDisplayedSosStatus(event)}</span>
                  {!isGuest && !TERMINAL_SOS_STATUSES.has(event.status) && (
                    <button
                      type="button"
                      onClick={() => void handleCancelSos(event)}
                      className="px-2 py-1 rounded border border-border text-xs"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!sosEvents.length && <p className="text-secondary text-sm">No SOS events on record.</p>}
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Trail safety lookup</h2>
          </div>
          <div className="flex gap-2">
            <input
              id="trail-safety-id"
              placeholder="Trail UUID"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const input = document.getElementById('trail-safety-id') as HTMLInputElement | null;
                if (input?.value) void loadTrailSafety(input.value.trim());
              }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
            >
              Check
            </button>
          </div>
          {trailSafety && (
            <div className="mt-3 text-sm space-y-1">
              <p>Score <strong>{trailSafety.safety_score}</strong> · Risk <strong>{trailSafety.risk_level}</strong></p>
              {trailSafety.nearest_settlement && (
                <p className="text-secondary">Nearest settlement: {trailSafety.nearest_settlement.name} ({formatDistance(trailSafety.nearest_settlement.distance_meters)})</p>
              )}
              {trailSafety.nearest_checkpoint && (
                <p className="text-secondary">Nearest checkpoint: {trailSafety.nearest_checkpoint.name} ({formatDistance(trailSafety.nearest_checkpoint.distance_meters)})</p>
              )}
              {trailSafety.warnings.length > 0 && (
                <ul className="list-disc pl-5 text-secondary">
                  {trailSafety.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              )}
            </div>
          )}
        </section>

        {!isGuest && (
          <section className="bg-card rounded-xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Report safety incident</h2>
              <button
                type="button"
                onClick={() => setShowReportForm((v) => !v)}
                className="text-sm text-primary"
              >
                {showReportForm ? 'Hide form' : 'Show form'}
              </button>
            </div>
            {showReportForm && (
              <div className="space-y-3">
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {INCIDENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <select
                  value={reportSeverity}
                  onChange={(e) => setReportSeverity(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {SEVERITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="What happened? (optional)"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleReport()}
                  className="w-full px-4 py-3 rounded-lg bg-destructive text-white"
                >
                  Report at current location
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
