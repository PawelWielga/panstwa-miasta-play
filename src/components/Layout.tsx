import type { PropsWithChildren, ReactNode } from 'react';

export function Layout({ children, aside }: PropsWithChildren<{ aside?: ReactNode }>) {
  const logoUrl = `${import.meta.env.BASE_URL}logo-mark.svg`;

  return <div className="app-shell">
    <header className="brand-bar"><img className="brand-mark" src={logoUrl} alt="" aria-hidden="true" /><div><strong>Państwa Miasta</strong><span>gra rodzinna online</span></div></header>
    <main className={aside ? 'page-grid' : 'page-single'}><section>{children}</section>{aside ? <aside>{aside}</aside> : null}</main>
  </div>;
}

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}
