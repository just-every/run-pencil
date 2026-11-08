import base from '/home/agent/rer-consolidation/work/sd-pencil-c-f27/run-pencil/playwright.config'
const root='/home/agent/rer-consolidation/work/sd-pencil-c-f27/run-pencil'
export default {...base,testDir:root+'/tests/e2e',use:{...base.use,launchOptions:{headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-mock-keychain','--password-store=basic']}},webServer:[{...(base.webServer as any[])[0],cwd:root}]}
