import { useEffect, useRef } from 'react'

import { appConfig } from '../config'
import type { UnityPetState } from '../petShop/unityBridge'
import { postSubscriptionsToUnity } from '../petShop/unityBridge'
import styles from './UnityFarmPlayer.module.scss'

type Props = {
  pets: UnityPetState[]
  wallet: string | null
}

export function UnityFarmPlayer({ pets, wallet }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    postSubscriptionsToUnity(iframeRef.current, {
      type: 'ocr:subscriptions',
      wallet,
      pets,
    })
  }, [pets, wallet])

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>Your farm</span>
        <span className={styles.toolbarHint}>Unity WebGL player</span>
      </div>
      <iframe
        ref={iframeRef}
        className={styles.frame}
        src={appConfig.unityPlayerUrl}
        title="OCR Pet Shop farm"
        allow="autoplay; fullscreen"
      />
    </div>
  )
}
