import React from 'react';
import { Volume2, Smartphone, Zap, FileText, CheckCircle2 } from 'lucide-react';

export function PackageCard({ pkg, onClick }) {
  const dateStr = new Date(pkg.timestamp_start).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const getTriggerIcon = (type) => {
    switch (type) {
      case 'motion':
        return <Smartphone size={16} color="#D69E2E" />;
      case 'combined':
        return <Zap size={16} color="#E53E3E" />;
      default:
        return <Volume2 size={16} color="#4A6FA5" />;
    }
  };

  const threatLevel = pkg.gemma_report?.threat_level || 'Unreviewed';
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
    <div className="package-item" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
          {getTriggerIcon(pkg.trigger_type)}
          <span style={{ textTransform: 'capitalize' }}>{pkg.trigger_type} Trigger</span>
        </div>

        <span className={`package-badge ${getBadgeClass(threatLevel)}`}>
          {threatLevel}
        </span>
      </div>

      <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.5rem' }}>
        {dateStr}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#4A6FA5' }}>
        <span style={{ fontFamily: 'monospace' }}>
          SHA-256: {pkg.local_hash?.slice(0, 10)}...
        </span>

        {pkg.gemma_report ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#38A169' }}>
            <CheckCircle2 size={13} /> Report Ready
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <FileText size={13} /> Pending Report
          </span>
        )}
      </div>
    </div>
  );
}
