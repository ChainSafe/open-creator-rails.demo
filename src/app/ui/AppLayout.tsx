import { NavLink, Outlet } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

import { Button } from '../components/Button'
import styles from './AppLayout.module.scss'

function shortenAddress(address: string, headChars = 6, tailChars = 4): string {
  if (address.length <= headChars + tailChars + 1) return address
  return `${address.slice(0, headChars)}…${address.slice(-tailChars)}`
}

function TopLink(props: { to: string; label: string }) {
  return (
    <NavLink to={props.to} className={({ isActive }) => (isActive ? `${styles.link} ${styles.activeLink}` : styles.link)}>
      {props.label}
    </NavLink>
  )
}

function HeaderWallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()

  return (
    <div className={styles.wallet}>
      {!isConnected ? (
        <Button variant="primary" size="sm" onClick={() => connect({ connector: connectors[0]! })} disabled={isConnecting}>
          {isConnecting ? 'Connecting…' : 'Connect wallet'}
        </Button>
      ) : (
        <>
          {address ? (
            <code className={styles.walletAddress} title={address}>
              {shortenAddress(address)}
            </code>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => disconnect()}>
            Disconnect
          </Button>
        </>
      )}
    </div>
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
        <div className={styles.walletRow}>
          <HeaderWallet />
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

