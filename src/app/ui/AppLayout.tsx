import { NavLink, Outlet } from 'react-router-dom'
import { useAccount, useDisconnect } from 'wagmi'

import { appConfig } from '../config'
import { Button } from '../components/Button'
import { useLocalAnvilWallet } from '../useLocalAnvilWallet'
import { ToastProvider } from '../toast/ToastContext'
import { useAssetOwnerGate } from '../useAssetOwnerGate'
import styles from './AppLayout.module.scss'

function shortenAddress(address: string, headChars = 6, tailChars = 4): string {
  if (address.length <= headChars + tailChars + 1) return address
  return `${address.slice(0, headChars)}\u2026${address.slice(-tailChars)}`
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
  const { disconnect } = useDisconnect()
  const {
    connectWallet,
    switchToAnvil,
    isConnecting,
    needsNetworkSwitch,
    isLocalAnvilDev,
  } = useLocalAnvilWallet()

  return (
    <div className={styles.wallet}>
      {!isConnected ? (
        <Button variant="primary" size="sm" onClick={connectWallet} disabled={isConnecting}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
          {isConnecting ? 'Connecting\u2026' : 'Connect Wallet'}
        </Button>
      ) : (
        <>
          {needsNetworkSwitch ? (
            <Button variant="primary" size="sm" onClick={switchToAnvil} disabled={isConnecting}>
              {isConnecting ? 'Switching\u2026' : 'Switch to Anvil'}
            </Button>
          ) : null}
          <code className={styles.walletAddress} title={address}>
            {address ? shortenAddress(address) : ''}
          </code>
          {isLocalAnvilDev && !needsNetworkSwitch ? (
            <span className={styles.chainBadge} title={`Chain ID ${appConfig.chain.id}`}>
              Anvil
            </span>
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
  const { isAssetOwner, gateReady } = useAssetOwnerGate()
  const showCreatorNav = gateReady && isAssetOwner

  return (
    <ToastProvider>
      <div className={styles.layout}>
        <header className={styles.header}>
          <nav className={styles.nav}>
            <span className={styles.brand}>
              <span className={`material-symbols-outlined ${styles.brandIcon}`}>hub</span>
              Open Creator Rails
            </span>
            <div className={styles.navGroup}>
              <TopLink to="/" label="Marketplace" />
              <TopLink to="/subscriptions" label="My Subscriptions" />
              {showCreatorNav ? <TopLink to="/creator-console" label="Creator Console" /> : null}
            </div>
            <div className={styles.walletSlot}>
              <HeaderWallet />
            </div>
          </nav>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </ToastProvider>
  )
}
