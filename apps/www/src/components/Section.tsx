import type { ReactNode } from 'react';

export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="section">
      <div className="section-head">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {lead && <p className="section-lead">{lead}</p>}
      </div>
      {children}
    </section>
  );
}
