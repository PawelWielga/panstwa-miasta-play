import type { PropsWithChildren, ReactNode } from 'react';

export function Layout({ children, aside }: PropsWithChildren<{ aside?: ReactNode }>) {
  return <div className="app-shell">
    <header className="brand-bar"><div className="brand-mark" aria-hidden="true">PM</div><div><strong>Państwa Miasta</strong><span>gra rodzinna online</span></div></header>
    <main className={aside ? 'page-grid' : 'page-single'}><section>{children}</section>{aside ? <aside>{aside}</aside> : null}</main>
  </div>;
}

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}
