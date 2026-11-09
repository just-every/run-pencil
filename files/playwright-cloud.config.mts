import config from '/workspace/run-pencil/playwright.config.ts'
export default {
 ...config,
 testDir: '/workspace/run-pencil/tests/e2e',
 outputDir: '/tmp/pencil-embed-results',
 use: {...config.use, launchOptions:{...config.use?.launchOptions, executablePath:'/usr/bin/chromium', args:['--no-sandbox','--use-mock-keychain','--password-store=basic']}},
 webServer: (config.webServer as any[]).slice(0,1).map(server=>({...server,cwd:'/workspace/run-pencil'})),
}
