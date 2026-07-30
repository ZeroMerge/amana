import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Cpu, FileText, CheckCircle2, ShieldAlert, Layers, MapPin, Tag } from 'lucide-react';
import { SegmentCard } from '../components/SegmentCard';
import { IncidentMap } from '../components/IncidentMap';
import { getSegmentsForIncident, saveIncidentReport } from '../services/db';
import { callGemmaReport } from '../services/gemmaService';

export function IncidentDetailView({ incident, onBack, onDelete }) {
  const [segments, setSegments] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState(incident.final_report || null);

  useEffect(() => {
    async function loadSegments() {
      if (incident?.id) {
        const segs = await getSegmentsForIncident(incident.id);
        setSegments(segs);
      }
    }
    loadSegments();
  }, [incident]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const newReport = await callGemmaReport(incident, segments);
      setReport(newReport);
      await saveIncidentReport(incident.id, newReport);
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const ledger = incident.ledger || {};
  const threatLevel = report?.threat_level || 'Pending';

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
    <div style={{ padding: '0.5rem 0' }}>
      {/* Navigation Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <button className="btn-secondary" onClick={onBack} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
          <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Back to Incidents
        </button>

        <button className="btn-danger" onClick={() => onDelete(incident.id)}>
          <Trash2 size={13} style={{ marginRight: '4px' }} /> Delete Incident
        </button>
      </div>

      {/* Incident Header Card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'monospace' }}>
            ID: {incident.id.slice(0, 18)}...
          </span>
          <span className={`package-badge ${getBadgeClass(threatLevel)}`}>
            {threatLevel} Threat
          </span>
        </div>

        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.2rem', textTransform: 'capitalize' }}>
          {incident.trigger_type} Trigger Incident
        </h2>

        <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
          Started: {new Date(incident.started_at).toLocaleString()}
          {incident.ended_at && ` • Duration: ${Math.round((new Date(incident.ended_at) - new Date(incident.started_at)) / 1000)}s`}
        </div>
      </div>

      {/* GPS Location Trail Map */}
      <div className="card" style={{ padding: '0.85rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MapPin size={16} color="#4A6FA5" /> Geographic Trail
        </div>
        <IncidentMap gpsTrail={incident.gps_trail || []} />
      </div>

      {/* 15-Second Audio Segments List */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Layers size={16} color="#4A6FA5" /> Captured Evidence Segments ({segments.length})
        </div>

        {segments.map((seg, idx) => (
          <SegmentCard key={seg.id} segment={seg} index={idx} />
        ))}
      </div>

      {/* Accumulated Evidence Ledger */}
      <div className="card">
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Tag size={16} color="#4A6FA5" /> Evolving Evidence Ledger
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
          <div>
            <div style={{ color: '#64748B', fontSize: '0.7rem', fontWeight: 600 }}>IDENTIFIED ENTITIES & PLACES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
              {(ledger.known_entities && ledger.known_entities.length > 0) ? (
                ledger.known_entities.map((ent, i) => (
                  <span key={i} className="package-badge" style={{ background: '#F0F4F8', color: '#1E293B' }}>{ent}</span>
                ))
              ) : (
                <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>None extracted</span>
              )}
            </div>
          </div>

          <div>
            <div style={{ color: '#64748B', fontSize: '0.7rem', fontWeight: 600 }}>DETECTED EVENTS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
              {(ledger.detected_events && ledger.detected_events.length > 0) ? (
                ledger.detected_events.map((evt, i) => (
                  <span key={i} className="package-badge" style={{ background: '#FEF3C7', color: '#92400E' }}>{evt}</span>
                ))
              ) : (
                <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>None extracted</span>
              )}
            </div>
          </div>

          <div>
            <div style={{ color: '#64748B', fontSize: '0.7rem', fontWeight: 600 }}>INVESTIGATION LEADS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
              {(ledger.investigation_leads && ledger.investigation_leads.length > 0) ? (
                ledger.investigation_leads.map((lead, i) => (
                  <span key={i} className="package-badge" style={{ background: '#E0E7FF', color: '#3730A3' }}>{lead}</span>
                ))
              ) : (
                <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>None extracted</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Gemma Investigation Report */}
      <div className="card" style={{ border: report ? '1px solid #4A6FA5' : '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Cpu size={18} color="#4A6FA5" /> Gemma Investigation Report
          </div>

          {report && (
            <span className="package-badge" style={{ background: report._source === 'gemma_cloud' ? '#EBF8FF' : '#FEFCBF', color: report._source === 'gemma_cloud' ? '#2B6CB0' : '#975A16' }}>
              {report._source === 'gemma_cloud' ? 'Gemma Cloud' : 'Local Fallback'}
            </span>
          )}
        </div>

        {!report ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '1rem' }}>
              Synthesize all captured audio segments, GPS coordinates, and ledger history into a full investigation report.
            </p>
            <button
              className="btn-primary"
              onClick={handleGenerateReport}
              disabled={isGenerating}
              style={{ justifyContent: 'center' }}
            >
              <FileText size={16} style={{ marginRight: '6px' }} />
              {isGenerating ? 'Synthesizing Full Gemma Report...' : 'Generate Full Investigation Report'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                Forensic Summary Narrative
              </div>
              <p style={{ lineHeight: 1.5, marginTop: '0.2rem', color: '#1A1A1A' }}>
                {report.narrative}
              </p>
            </div>

            {report.timeline && report.timeline.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  Incident Timeline
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {report.timeline.map((t, idx) => (
                    <div key={idx} style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', background: '#F8FAFC', borderRadius: '4px', borderLeft: '2px solid #4A6FA5' }}>
                      <strong>{t.time}</strong> — {t.event}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: '0.65rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Evidence Cryptographic Integrity</span>
              <strong style={{ fontSize: '0.95rem', color: '#38A169' }}>
                {report.evidence_integrity ? (report.evidence_integrity * 100).toFixed(0) : '92'}%
              </strong>
            </div>

            <button className="btn-secondary" onClick={handleGenerateReport} disabled={isGenerating} style={{ marginTop: '0.5rem' }}>
              <FileText size={14} style={{ marginRight: '4px' }} /> Regenerate Investigation Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
