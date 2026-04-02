import { NavLink, Outlet } from 'react-router-dom'
import styles from './AppLayout.module.scss'

function TopLink(props: { to: string; label: string }) {
  return (
    <NavLink
      to={props.to}
      className={styles.link}
      style={({ isActive }) => (isActive ? { outline: '2px solid var(--accent)' } : undefined)}
    >
      {props.label}
    </NavLink>
  )
}

export function AppLayout() {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <TopLink to="/" label="Home" />
          <TopLink to="/registry" label="Creator (Registry)" />
          <TopLink to="/me/assets" label="Your Assets" />
          <TopLink to="/me/subscriptions" label="Your Subscriptions" />
        </nav>
        <div className={styles.note}>Anvil demo</div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

