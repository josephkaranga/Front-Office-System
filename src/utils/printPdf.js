export default function printPdf({ settings, title, subtitle, tableHeaders, tableRows, summaryRows, formatCurrency }) {
  const logo = settings.hotel_logo || '';
  const name = settings.hotel_name || 'Hotel';
  const tagline = settings.hotel_tagline || '';
  const address = settings.hotel_address || '';
  const phone = settings.hotel_phone || '';
  const email = settings.hotel_email || '';
  const tin = settings.hotel_tin || '';
  const country = settings.country || '';
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const html = `<!DOCTYPE html><html><head><title>${title} — ${name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;padding:20px 30px;color:#1e293b;max-width:900px;margin:0 auto}
.header{display:flex;align-items:center;gap:16px;padding-bottom:12px;border-bottom:3px solid #1e293b;margin-bottom:6px}
.logo{max-width:70px;max-height:50px;object-fit:contain}
.hotel-info{flex:1}
.hotel-name{font-size:20px;font-weight:bold;letter-spacing:0.5px;color:#1e293b}
.hotel-detail{font-size:10px;color:#64748b;margin-top:1px}
.report-meta{text-align:right;font-size:10px;color:#64748b}
.report-title{font-size:15px;font-weight:bold;color:#1e293b;margin:12px 0 4px}
.report-sub{font-size:10px;color:#64748b;margin-bottom:12px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th{background:#f1f5f9;text-align:left;padding:6px 8px;font-size:10px;font-weight:600;text-transform:uppercase;color:#475569;border-bottom:2px solid #e2e8f0}
td{padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:11px}
tr:nth-child(even){background:#fafbfc}
.num{text-align:right}
.bold{font-weight:bold}
.summary{margin-top:16px;border-top:2px solid #1e293b;padding-top:8px}
.summary-row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
.summary-row.total{font-size:14px;font-weight:bold;border-top:1px solid #cbd5e1;padding-top:6px;margin-top:4px}
.footer{margin-top:24px;padding-top:10px;border-top:1px solid #e2e8f0;text-align:center;font-size:9px;color:#94a3b8}
@media print{@page{size:A4;margin:12mm}body{padding:0}}
</style></head><body>
<div class="header">
${logo ? `<img src="${logo}" class="logo" alt=""/>` : ''}
<div class="hotel-info">
<div class="hotel-name">${name}</div>
${tagline ? `<div class="hotel-detail">${tagline}</div>` : ''}
${address ? `<div class="hotel-detail">${address}</div>` : ''}
${[phone, email].filter(Boolean).length ? `<div class="hotel-detail">${[phone, email].filter(Boolean).join(' | ')}</div>` : ''}
${tin ? `<div class="hotel-detail">TIN: ${tin}</div>` : ''}
${country ? `<div class="hotel-detail">${country}</div>` : ''}
</div>
<div class="report-meta">
<div>Printed: ${now}</div>
</div>
</div>
<div class="report-title">${title}</div>
${subtitle ? `<div class="report-sub">${subtitle}</div>` : ''}
<table>
<thead><tr>${tableHeaders.map(h => `<th${h.align === 'right' ? ' class="num"' : ''}>${h.label}</th>`).join('')}</tr></thead>
<tbody>
${tableRows.map(row => `<tr>${row.map((cell, i) => `<td${tableHeaders[i]?.align === 'right' ? ' class="num"' : ''}>${cell}</td>`).join('')}</tr>`).join('')}
</tbody>
</table>
${summaryRows?.length > 0 ? `<div class="summary">
${summaryRows.map(s => `<div class="summary-row${s.total ? ' total' : ''}"><span>${s.label}</span><span>${s.value}</span></div>`).join('')}
</div>` : ''}
<div class="footer">
<div>${name}${tagline ? ' — ' + tagline : ''}</div>
<div>Generated on ${now}</div>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}
