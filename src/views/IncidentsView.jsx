import React from 'react';
import { Shield, FolderArchive, Trash2, Info, ChevronRight, CheckCircle2, Clock } from 'lucide-react';

export function IncidentsView({ incidents = [], onSelectIncident, onClearAll }) {
  return (
    <div style={{ padding: '0.5rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Preserved Incidents</h2>
          <p style={{ fontSize: '0.75rem', color: '#64748B' }}>
            {incidents.length} {incidents.length === 1 ? 'incident' : 'incidents'} stored in local IndexedDB
          </p>
        </div>

        {incidents.length > 0 && (
          <button
            className="btn-secondary"
            onClick={onClearAll}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', color: '#E53E3E' }}
          >
            <Trash2 size={12} style={{ marginRight: '4px' }} /> Clear All
          </button>
        )}
      </div>

      {/* Offline Storage Notice */}
      <div className="card" style={{ background: '#F0F4F8', border: '1px solid #CBD5E1', padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: '#334155' }}>
          <Info size={16} color="#4A6FA5" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Adaptive evidence packages are stored locally in IndexedDB. Hashed audio recordings and sensor metadata remain on device.
          </span>
        </div>
      </div>

      {/* Empty State */}
      {incidents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.25rem' }}>
          <div style={{ margin: '0 auto 1rem', width: '48px', height: '48px', background: '#F0F2F5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FolderArchive size={24} color="#64748B" />
          </div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1A1A1A', marginBottom: '0.4rem' }}>
            No preserved incidents yet
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#64748B', maxWidth: '320px', margin: '0 auto' }}>
            Amana runs in passive monitoring mode. When a sound or motion signature triggers, evidence collection will execute automatically.
          </p>
        </div>
      ) : (
        <div>
          {incidents.map((incident) => {
            const dateStr = new Date(incident.started_at).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            const windowCount = incident.ledger?.collection_window || 1;
            const threatLevel = incident.final_report?.threat_level || 'Unreviewed';

            const getBadgeClass = (level) => {
              switch (level) {
                case 'High':
                case 'Critical':
                  return 'badge-high';
                case 'Medium':
                  return 'badge-medium';
                case 'Low':
                  return 'badge-low';
                default:
                  return '';
              }
            };

            return (
              <div
                key={incident.id}
                className="package-item"
                onClick={() => onSelectIncident(incident.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    <Shield size={16} color="#4A6FA5" />
                    <span style={{ textTransform: 'capitalize' }}>{incident.trigger_type} Incident</span>
                  </div>

                  <span className={`package-badge ${getBadgeClass(threatLevel)}`}>
                    {threatLevel}
                  </span>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <span>{dateStr}</span>
                  <span>•</span>
                  <span>{windowCount} {windowCount === 1 ? 'window' : 'windows'} ({windowCount * 15}s audio)</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#4A6FA5' }}>
                  <span style={{ fontFamily: 'monospace' }}>
                    ID: {incident.id.slice(0, 14)}...
                  </span>

                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: incident.final_report ? '#38A169' : '#4A6FA5' }}>
                    {incident.final_report ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                    {incident.final_report ? 'Report Ready' : 'Pending Review'}
                    <ChevronRight size={14} style={{ marginLeft: '4px' }} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
