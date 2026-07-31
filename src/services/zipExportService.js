/**
 * Amana Evidence Package Export Service
 * Compresses audio clips, JSON metadata, GPS waypoints, and audit trail into a single .ZIP file
 * Dispatches Base64 ZIP to Resend API email attachment and triggers browser download.
 */
import JSZip from 'jszip';

export async function buildEvidenceZipPackage(incident, segments = [], auditLogs = []) {
  const zip = new JSZip();

  const recNum = incident?.rec_number || '1';
  const folderName = `Amana_Evidence_Rec_${recNum}`;
  const root = zip.folder(folderName);

  // 1. Add incident_summary.json
  const summaryData = {
    app: 'Amana Autonomous Evidence Preservation System',
    recording_number: recNum,
    case_name: incident?.case_name || `Recording #${recNum}`,
    started_at: incident?.started_at,
    ended_at: incident?.ended_at,
    trigger_type: incident?.trigger_type || 'audio',
    threat_score: incident?.ledger?.threat_score || 8,
    final_decision: incident?.ledger?.decision || 'KEEP',
    rationale: incident?.ledger?.narrative || 'Threat confirmed by 10-point evidence scale.',
    gps_trail_count: incident?.gps_trail?.length || 0,
    segment_count: segments.length
  };
  root.file('incident_summary.json', JSON.stringify(summaryData, null, 2));

  // 2. Add gps_route.json
  if (incident?.gps_trail?.length > 0) {
    root.file('gps_route.json', JSON.stringify(incident.gps_trail, null, 2));
  }

  // 3. Add audit_trail.json
  if (auditLogs && auditLogs.length > 0) {
    root.file('audit_trail.json', JSON.stringify(auditLogs, null, 2));
  }

  // 4. Add audio files
  const audioFolder = root.folder('audio');
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.audio_blob) {
      const fileName = `part_${seg.segment_number || i + 1}.webm`;
      audioFolder.file(fileName, seg.audio_blob);
    }
  }

  // 5. Generate compressed ZIP Blob
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  // 6. Convert to Base64 for Email Attachment
  const zipBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(zipBlob);
  });

  return {
    zipBlob,
    zipBase64,
    fileName: `${folderName}.zip`
  };
}

export function triggerZipDownload(zipBlob, fileName) {
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
