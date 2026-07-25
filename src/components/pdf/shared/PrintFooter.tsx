/* eslint-disable @next/next/no-img-element */
import React from 'react';

interface Signature {
  name: string;
  url: string;
}

interface PrintFooterProps {
  signatures?: Signature[];
}

export function PrintFooter({ signatures = [] }: PrintFooterProps) {
  return (
    <footer className="print-footer">
      <div className="print-footer__committee">
        إعداد
        <br />
        لجنة القياس والتقويم
      </div>
      <div className="print-footer__signatures">
        {signatures.length > 0 ? (
          signatures.map((sig) => (
            <div key={sig.name + sig.url} className="print-footer__signature">
              <p style={{ margin: '0 0 2mm' }}>{sig.name}</p>
              <img src={sig.url} alt={sig.name} />
            </div>
          ))
        ) : (
          <div className="print-footer__signature">
            <p style={{ margin: '0 0 2mm' }}>التوقيع المعتمد</p>
            <div style={{ borderBottom: '1px solid #000', width: '40mm', margin: '0 auto', height: '8mm' }} />
          </div>
        )}
      </div>
    </footer>
  );
}
