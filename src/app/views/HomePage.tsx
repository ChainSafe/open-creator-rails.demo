import { Link } from 'react-router-dom'
import { appConfig } from '../config'

export function HomePage() {
  return (
    <div>
      <h1>Open Creator Rails Demo</h1>
      <p>
        Registry address:{' '}
        <code>{appConfig.registryAddress ?? 'Set VITE_REGISTRY_ADDRESS to start'}</code>
      </p>
      <p>
        Indexer URL: <code>{appConfig.indexerUrl}</code>
      </p>

      <ul>
        <Link to="/registry">Go to creator (registry) page</Link>
      </ul>
    </div>
  )
}

