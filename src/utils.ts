import http from 'http'
import https from 'https'

function getModule(protocol: string) {
  return protocol === 'https:' ? https : http
}

export function fetch(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const parsedURL = new URL(url)
    const mod = getModule(parsedURL.protocol).request

    const req = mod(
      {
        host: parsedURL.hostname,
        path: parsedURL.pathname + parsedURL.search,
        origin: parsedURL.origin,
        port: parsedURL.port,
        method: 'GET'
      },
      (res) => {
        res.on('error', reject)

        let data = ''
        res.on('data', (val) => {
          data += val
        })

        res.on('end', () => resolve(data))
      }
    ).end()

    req.on('error', reject)
  })
}
