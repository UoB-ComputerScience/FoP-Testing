// Compare the complete list, retaining duplicate counts but ignoring display order.
export function assertExpected(report, expected) {
  if (report.complete !== (expected.check_complete === 'Yes')) {
    throw new Error('Unexpected completion');
  }
  const severity=report.findings.some(f=>f.status==='error')?'Critical':
    report.findings.some(f=>f.status==='warning')?'Advisory':'Pass';
  if (severity !== expected.expected_severity) throw new Error('Unexpected severity '+severity);
  const wanted=expected.expected_checks.split(';').map(s=>s.trim()).filter(Boolean).sort();
  const actual=report.findings.map(f=>f.id+':'+f.status).sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error('Findings differ. Expected '+JSON.stringify(wanted)+'; received '+JSON.stringify(actual));
  }
}
