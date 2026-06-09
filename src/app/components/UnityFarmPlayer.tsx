import { useCallback, useEffect, useRef } from 'react'

import { appConfig } from '../config'
import type { UnityPetState } from '../petShop/unityBridge'
import { postSubscriptionsToUnity } from '../petShop/unityBridge'
import styles from './UnityFarmPlayer.module.scss'

type Props = {
  pets: UnityPetState[]
  wallet: string | null
}

const UNITY_REPOLL_MS = 3_000

export function UnityFarmPlayer({ pets, wallet }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const activeCount = pets.filter((p) => p.active).length

  const post = useCallback(() => {
    postSubscriptionsToUnity(iframeRef.current, {
      type: 'ocr:subscriptions',
      wallet,
      pets,
    })
  }, [pets, wallet])

  useEffect(() => {
    post()

    const intervalId = window.setInterval(post, UNITY_REPOLL_MS)

    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) {
        return
      }

      if (event.data?.type === 'ocr:unity-ready') {
        post()
      }
    }

    window.addEventListener('message', onMessage)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('message', onMessage)
    }
  }, [post])

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>Your farm</span>
        <span className={styles.toolbarHint}>
          Unity WebGL · sending {activeCount} active
        </span>
      </div>
      <iframe
        ref={iframeRef}
        className={styles.frame}
        src={appConfig.unityPlayerUrl}
        title="OCR Pet Shop farm"
        allow="autoplay; fullscreen"
        onLoad={post}
      />
    </div>
  )
}
