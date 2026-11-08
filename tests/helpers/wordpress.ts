import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execute = promisify(execFile)
const fixture = fileURLToPath(new URL('../fixtures/wordpress/compose.yml', import.meta.url))

/** Each journey owns an isolated real WordPress database and removes it on every exit. */
export async function wordpressHost(installation: string) {
  const project = `pencil-wordpress-${crypto.randomUUID()}`
  const env = { ...process.env, PENCIL_WORDPRESS_INSTALLATION_URL: installation }
  const compose = async (...args: string[]) => {
    const result = await execute('docker', ['compose', '-f', fixture, '-p', project, ...args], {
      env, timeout: 180_000, maxBuffer: 4 * 1024 * 1024,
    })
    return result.stdout.trim()
  }
  const wp = (...args: string[]) => compose('run', '--rm', '-T', 'cli', 'wp', ...args)
  const close = async () => {
    await compose('down', '--volumes', '--remove-orphans', '--timeout', '10')
    const remaining = await compose('ps', '--all', '--quiet')
    if (remaining) throw new Error('WordPress fixture left containers running after teardown.')
  }
  try {
    await compose('up', '-d', '--wait', 'wordpress')
    const address = await compose('port', 'wordpress', '80')
    if (!/^127\.0\.0\.1:\d+$/.test(address)) throw new Error('WordPress must publish only on loopback.')
    const origin = `http://${address}`
    // Apache copies the real WordPress distribution into its shared volume at startup.
    const deadline = Date.now() + 60_000
    while (true) {
      try {
        const response = await fetch(origin, { redirect: 'manual', signal: AbortSignal.timeout(2_000) })
        await response.body?.cancel()
        if (response.status < 500) break
      } catch { /* wait for this fixture's server */ }
      if (Date.now() > deadline) throw new Error('WordPress did not start within one minute.')
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    await wp('core', 'install', `--url=${origin}`, '--title=Pencil WordPress fixture', '--admin_user=synthetic-pencil-1', '--admin_password=synthetic-pencil-1', `--admin_email=${['synthetic-pencil-1', 'example.invalid'].join('@')}`, '--skip-email')
    await wp('plugin', 'activate', 'pencil')
    await wp('theme', 'activate', 'pencil-fixture')
    const createPage = async (title: string, shortcode: string) => {
      const id = await wp('post', 'create', '--post_type=page', '--post_status=publish', `--post_title=${title}`, `--post_content=${shortcode}`, '--porcelain')
      if (!/^\d+$/.test(id)) throw new Error('WordPress did not publish a page.')
      return `${origin}/?page_id=${id}`
    }
    return { origin, createPage, close }
  } catch (error) {
    await close()
    throw error
  }
}
