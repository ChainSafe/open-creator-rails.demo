import { NavLink, Outlet } from 'react-router-dom'
import styles from './AppLayout.module.scss'

function TopLink(props: { to: string; label: string }) {
  return (
    <NavLink to={props.to} className={({ isActive }) => (isActive ? `${styles.link} ${styles.activeLink}` : styles.link)}>
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
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

