/* eslint-disable @next/next/no-img-element */
import React from 'react';

interface PrintHeaderProps {
  subtitle: string;
  logos?: { quality?: string; university?: string; college?: string };
}

export function PrintHeader({ subtitle, logos }: PrintHeaderProps) {
  return (
    <header className="print-header">
      <div className="print-header__logo">
        {logos?.quality && <img src={logos.quality} alt="Quality" />}
      </div>
      <h2 className="print-header__title">{subtitle}</h2>
      <div className="print-header__logo">
        {logos?.college && <img src={logos.college} alt="College" />}
      </div>
    </header>
  );
}
