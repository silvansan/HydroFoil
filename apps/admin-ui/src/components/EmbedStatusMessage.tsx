import React from 'react';

export interface EmbedStatusMessageProps {
  title: string;
  subtitle?: string;
}

/** Turquoise gradient status card for embed iframe states. */
export const EmbedStatusMessage: React.FC<EmbedStatusMessageProps> = ({ title, subtitle }) => (
  <div className="hf-embed-status" role="status">
    <p className="hf-embed-status__title">{title}</p>
    {subtitle ? <p className="hf-embed-status__subtitle">{subtitle}</p> : null}
  </div>
);
