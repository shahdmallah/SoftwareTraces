import { useEffect, useState } from 'react';
import { AlertTriangle, MapPin, Shield } from 'lucide-react';
import { getAccessToken } from '../api/client';
import { getNearbySafetyAlerts, getTrailSafety, reportSafetyIncident, type NearbySafetyAlert } from '../api/safety';
import { getEmergencyContacts, getMySosEvents, type EmergencyContact, type SosAlert } from '../api/sos';

export function SafetyPage() {
  const [alerts, setAlerts] = useState<NearbySafetyAlert[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [sosEvents, setSosEvents] = useState<SosAlert[]>([]);
  const [trailSafety, setTrailSafety] = useState<{ score: number; risk: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const isGuest = !getAccessToken();

  useEffect(() => {
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

  const handleReport = async () => {
    if (isGuest) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await reportSafetyIncident({
          incident_type: 'other',
          severity: 'medium',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          description: 'Reported from web Safety Center',
        });
        setStatusMessage('Incident reported for moderation.');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to report incident.');
      }
    });
  };

  const loadTrailSafety = async (trailId: string) => {
    try {
      const data = await getTrailSafety(trailId);
      setTrailSafety({ score: data.safety_score, risk: data.risk_level });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load trail safety.');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="mb-2">Safety Center</h1>
          <p className="text-secondary">Nearby alerts, SOS history, emergency contacts, and incident reporting.</p>
        </div>

        {isGuest && (
          <div className="bg-card rounded-xl border border-border p-6">
            <p className="text-secondary">Sign in to use safety features tied to your account.</p>
          </div>
        )}

        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{errorMessage}</div>}
        {statusMessage && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">{statusMessage}</div>}

        <section className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-lg font-semibold">Nearby alerts</h2>
          </div>
          <div className="space-y-3">
            {alerts.length ? alerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-border p-3">
                <p className="font-medium">{alert.kind === 'location' ? alert.name : alert.headline || alert.incident_type}</p>
                <p className="text-sm text-secondary">{Math.round(alert.distance_meters)}m away</p>
              </div>
            )) : <p className="text-secondary text-sm">No nearby alerts right now.</p>}
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Emergency contacts</h2>
          </div>
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div key={contact.id} className="flex justify-between text-sm">
                <span>{contact.name}</span>
                <span className="text-secondary">{contact.phone}</span>
              </div>
            ))}
            {!contacts.length && <p className="text-secondary text-sm">No emergency contacts saved yet.</p>}
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold mb-4">Recent SOS events</h2>
          <div className="space-y-2">
            {sosEvents.map((event) => (
              <div key={event.id} className="text-sm flex justify-between">
                <span>{new Date(event.created_at).toLocaleString()}</span>
                <span className="text-secondary">{event.status}</span>
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
            <p className="mt-3 text-sm">
              Score <strong>{trailSafety.score}</strong> · Risk <strong>{trailSafety.risk}</strong>
            </p>
          )}
        </section>

        {!isGuest && (
          <button type="button" onClick={() => void handleReport()} className="w-full px-4 py-3 rounded-lg bg-destructive text-white">
            Report safety incident at current location
          </button>
        )}
      </div>
    </div>
  );
}
