import React from 'react';

export default function Receipt({ data, formatCurrency, onClose }) {
  if (!data) return null;

  const logo = data.hotel?.hotel_logo || '';
  const hotelName = data.hotel?.hotel_name || 'HOTEL';
  const tagline = data.hotel?.hotel_tagline || '';
  const country = data.hotel?.country || '';
  const address = data.hotel?.hotel_address || '';
  const phone = data.hotel?.hotel_phone || '';
  const email = data.hotel?.hotel_email || '';
  const tin = data.hotel?.hotel_tin || '';

  const nightRate = data.charged_rate || data.room?.rate_per_night;
  const nights = data.nights || 1;

  const roomCharges = [];
  const checkinDate = new Date(data.checkin?.checkin_date);
  for (let i = 0; i < nights; i++) {
    const d = new Date(checkinDate);
    d.setDate(d.getDate() + i);
    roomCharges.push({ day: i + 1, date: d, amount: nightRate });
  }

  const buildReceiptHTML = () => `<!DOCTYPE html><html><head><title>Receipt ${data.receipt_number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;font-size:12px;padding:8px;max-width:320px;margin:0 auto;color:#000}
.c{text-align:center}
.r{text-align:right}
.b{font-weight:bold}
.sep{border-top:1px dashed #000;margin:6px 0}
.sep2{border-top:2px solid #000;margin:6px 0}
.row{display:flex;justify-content:space-between;padding:1px 0}
.indent{padding-left:12px}
.sm{font-size:10px;color:#444}
.logo{max-width:120px;max-height:60px;margin:0 auto 4px}
h1{font-size:16px;letter-spacing:1px}
@media print{@page{size:80mm auto;margin:2mm}body{padding:2px}}
</style></head><body>
<div class="c">
${logo ? `<img src="${logo}" class="logo" alt="logo"/>` : ''}
<h1>${hotelName}</h1>
${tagline ? `<div class="sm">${tagline}</div>` : ''}
${address ? `<div class="sm">${address}</div>` : ''}
${phone || email ? `<div class="sm">${[phone, email].filter(Boolean).join(' | ')}</div>` : ''}
${tin ? `<div class="sm">TIN: ${tin}</div>` : ''}
<div class="sm">${country}</div>
</div>
<div class="sep2"></div>
<div class="c b" style="font-size:13px;margin:4px 0">RECEIPT</div>
<div class="row"><span>No:</span><span class="b">${data.receipt_number}</span></div>
<div class="row"><span>Date:</span><span>${fmtDT(data.generated_at)}</span></div>
<div class="sep"></div>
<div class="row"><span>Guest:</span><span class="b">${data.guest?.first_name} ${data.guest?.last_name}</span></div>
<div class="row"><span>Room:</span><span>${data.room?.room_number} - ${data.room?.room_type}</span></div>
<div class="row"><span>Check-in:</span><span>${fmtD(data.checkin?.checkin_date)}</span></div>
<div class="row"><span>Check-out:</span><span>${data.checkin?.checkout_date ? fmtD(data.checkin.checkout_date) : 'In-House'}</span></div>
<div class="row"><span>Nights:</span><span>${nights}</span></div>
<div class="sep2"></div>
<div class="b">CHARGES</div>
${roomCharges.map(r => `<div class="row indent"><span>Room (Day ${r.day})</span><span>${fmtC(r.amount)}</span></div>`).join('')}
${data.has_discount ? `<div class="row indent" style="color:#16a34a"><span>Discount${data.discount_reason ? ' (' + data.discount_reason + ')' : ''}</span><span>-${fmtC(data.total_discount)}</span></div>` : ''}
${data.extras?.length > 0 ? data.extras.map(e => `<div class="row indent"><span>${e.item_name} x${e.quantity}</span><span>${fmtC(e.total_price)}</span></div>`).join('') : ''}
<div class="sep"></div>
<div class="row b"><span>Total Charges</span><span>${fmtC(data.grand_total)}</span></div>
<div class="sep2"></div>
<div class="b">PAYMENTS</div>
${data.payments?.length > 0 ? data.payments.map(p => `<div class="row indent"><span>${fmtD(p.payment_date)} - ${p.payment_method}</span><span>${fmtC(p.amount)}</span></div>`).join('') : '<div class="indent sm">No payments</div>'}
<div class="sep"></div>
<div class="row b"><span>Total Paid</span><span>${fmtC(data.paid_total)}</span></div>
<div class="sep2"></div>
${data.balance > 0 ? `<div class="row b" style="font-size:14px"><span>BALANCE DUE:</span><span>${fmtC(data.balance)}</span></div>` : '<div class="row b" style="font-size:13px"><span>STATUS:</span><span>PAID IN FULL</span></div>'}
<div class="sep2"></div>
<div class="sm c" style="margin-top:6px">
<div>Served by: ${data.served_by || '-'}</div>
${data.checked_in_by ? `<div>Check-in: ${data.checked_in_by}</div>` : ''}
${data.checked_out_by ? `<div>Check-out: ${data.checked_out_by}</div>` : ''}
<div style="margin-top:6px">Thank you for staying with us!</div>
<div class="b">${hotelName}</div>
<div>${fmtDT(data.generated_at)}</div>
</div>
</body></html>`;

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=350,height=700');
    w.document.write(buildReceiptHTML());
    w.document.close();
    w.onload = () => { w.focus(); w.print(); w.onafterprint = () => w.close(); };
  };

  const fmtC = (v) => formatCurrency(v);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-300 rounded p-4 font-mono text-[11px] max-h-[500px] overflow-y-auto shadow-inner mx-auto" style={{ maxWidth: 340 }}>
        {logo && <div className="text-center mb-2"><img src={logo} alt="logo" className="mx-auto" style={{ maxWidth: 100, maxHeight: 50 }} /></div>}
        <div className="text-center mb-1">
          <p className="text-sm font-bold tracking-wide">{hotelName}</p>
          {tagline && <p className="text-gray-500">{tagline}</p>}
          {address && <p className="text-gray-500">{address}</p>}
          {(phone || email) && <p className="text-gray-500">{[phone, email].filter(Boolean).join(' | ')}</p>}
          {tin && <p className="text-gray-500">TIN: {tin}</p>}
          <p className="text-gray-400">{country}</p>
        </div>
        <hr className="border-gray-900 border-double my-1.5" />
        <p className="text-center font-bold text-xs mb-1">RECEIPT</p>
        <Row l="No:" r={data.receipt_number} bold />
        <Row l="Date:" r={fmtDT(data.generated_at)} />
        <hr className="border-dashed border-gray-400 my-1" />
        <Row l="Guest:" r={`${data.guest?.first_name} ${data.guest?.last_name}`} bold />
        <Row l="Room:" r={`${data.room?.room_number} - ${data.room?.room_type}`} />
        <Row l="Check-in:" r={fmtD(data.checkin?.checkin_date)} />
        <Row l="Check-out:" r={data.checkin?.checkout_date ? fmtD(data.checkin.checkout_date) : 'In-House'} />
        <Row l="Nights:" r={nights} />
        <hr className="border-gray-900 border-double my-1.5" />

        {/* Charges Section */}
        <p className="font-bold">CHARGES</p>
        {roomCharges.map(r => (
          <Row key={r.day} l={`Room (Day ${r.day})`} r={fmtC(r.amount)} indent />
        ))}
        {data.has_discount && (
          <div className="flex justify-between pl-3 text-green-700">
            <span>Discount{data.discount_reason ? ` (${data.discount_reason})` : ''}</span>
            <span>-{fmtC(data.total_discount)}</span>
          </div>
        )}
        {data.extras?.length > 0 && data.extras.map((e, i) => (
          <Row key={i} l={`${e.item_name} x${e.quantity}`} r={fmtC(e.total_price)} indent />
        ))}
        <hr className="border-dashed border-gray-400 my-1" />
        <Row l="Total Charges" r={fmtC(data.grand_total)} bold />

        <hr className="border-gray-900 border-double my-1.5" />

        {/* Payments Section */}
        <p className="font-bold">PAYMENTS</p>
        {data.payments?.length > 0 ? data.payments.map((p, i) => (
          <Row key={i} l={`${fmtD(p.payment_date)} - ${p.payment_method}`} r={fmtC(p.amount)} indent />
        )) : <p className="pl-3 text-gray-400">No payments</p>}
        <hr className="border-dashed border-gray-400 my-1" />
        <Row l="Total Paid" r={fmtC(data.paid_total)} bold />

        <hr className="border-gray-900 border-double my-1.5" />

        {/* Balance */}
        {data.balance > 0
          ? <div className="flex justify-between font-bold text-red-700 text-xs"><span>BALANCE DUE:</span><span>{fmtC(data.balance)}</span></div>
          : <div className="flex justify-between font-bold text-green-700 text-xs"><span>STATUS:</span><span>PAID IN FULL</span></div>}

        <hr className="border-gray-900 border-double my-1.5" />
        <div className="text-center text-gray-500 mt-1.5 space-y-0.5">
          <p>Served by: <span className="text-gray-800 font-medium">{data.served_by}</span></p>
          <p className="mt-1">Thank you for staying with us!</p>
          <p className="font-bold text-gray-800">{hotelName}</p>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        {onClose && <button onClick={onClose} className="btn-secondary">Close</button>}
        <button onClick={handlePrint} className="btn-primary flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Print Now
        </button>
      </div>
    </div>
  );
}

function Row({ l, r, bold, indent }) {
  return (
    <div className={`flex justify-between ${indent ? 'pl-3' : ''} ${bold ? 'font-bold' : ''}`}>
      <span>{l}</span><span>{r}</span>
    </div>
  );
}

function fmtD(s) { if (!s) return '-'; return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtDT(s) { if (!s) return '-'; const d = new Date(s); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
