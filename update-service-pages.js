// update-service-pages.js
//   - Fetches / updates teletext services pages from remote repositories to a local location (as defined in config.js)
// How to auto run this...
// pm2 start update-service-pages.js --cron "*/5 * * * *" --no-autorestart
// by Danny Allen (me@dannya.com)
//
// When problem solving, remove the pm2 process and run this manually and see if it crashes.
// $ pm2 delete update-service-pages.js
// $ node update-service-pages.js -v
'use strict'

const fs = require('fs')
const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

const commandLineArgs = require('command-line-args')
const commandLineUsage = require('command-line-usage')
const colorette = require('colorette')

const svn = require('@taiyosen/easy-svn')
const simpleGit = require('simple-git')

const { deletedDiff } = require('deep-object-diff')
const xxhash = require('@pacote/xxhash')

// import package.json so we can get the current version
const PACKAGE_JSON = JSON.parse(fs.readFileSync('./package.json'))

// import constants and config for use server-side
const CONST = require('./constants.js')
const CONFIG = require('./config.js')

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_FILE_EXT = '.tti'
const FILE_ENCODING_INPUT = CONST.ENCODING_ASCII
const FILE_ENCODING_OUTPUT = CONST.ENCODING_ASCII

const FILE_CHAR_REPLACEMENTS = {
  '\x8d': '\x1bM'
}

const DESCRIPTION_NULLIFY = ['Description goes here']

// SVN flags used on every svn command so self-signed / expired certs don't block us
const SVN_TRUST_ARGS = [
  '--non-interactive',
  '--trust-server-cert-failures=cn-mismatch,unknown-ca,expired'
]

// ── CLI options ──────────────────────────────────────────────────────────────

const availableOptions = [
  { name: 'help',    description: 'Print this usage guide.',                                      alias: 'h', type: Boolean },
  { name: 'silent',  description: 'No log messages output to the console.',                       alias: 's', type: Boolean },
  { name: 'verbose', description: 'Verbose log messages output to the console.',                  alias: 'v', type: Boolean },
  { name: 'force',   description: 'Force an update of all services, regardless of last update time', alias: 'f', type: Boolean }
]

const options = commandLineArgs(availableOptions)

if (options.help) {
  console.log(commandLineUsage([
    {
      header: 'update-service-pages.js',
      content: 'Fetches / updates teletext services pages from remote repositories to a local location (as defined in config.js)'
    },
    { header: 'Options', optionList: availableOptions }
  ]))
  process.exit(0)
}

// ── Hasher ───────────────────────────────────────────────────────────────────

const hasher = xxhash.xxh64(2654435761)

// ── Helpers ──────────────────────────────────────────────────────────────────

function log (msg)        { if (!options.silent)  console.log(msg) }
function logVerbose (msg) { if (options.verbose)  console.log(msg) }
function logError (msg)   { if (!options.silent)  console.error(msg) }

/** Copy files with --update (only overwrites if src is newer).
 *  Returns true if any file was actually copied. */
async function cpUpdate (src, dest) {
  const { stdout, stderr } = await exec(`cp --update -v ${src} ${dest}`)
  if (stderr) logError(`cp stderr: ${stderr}`)
  logVerbose(`cp stdout: ${stdout}`)
  return stdout.length > 0
}

/** Return a git client rooted at the given directory. */
function gitAt (dir) {
  return simpleGit(dir)
}

// ── readBackServices ─────────────────────────────────────────────────────────

/** For editable services, copy on-air pages back to the repo and push.
 *  Returns a Set of serviceIds that had changes (these must not be
 *  overwritten by the subsequent updateServices pass). */
async function readBackServices () {
  const changed = new Set()

  for (const serviceId in CONFIG[CONST.CONFIG.SERVICES_AVAILABLE]) {
    const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][serviceId]
    if (!serviceData.isEditable) continue

    log(`[readBackServices] editable service id = ${serviceId}`)

    const serviceRepoDir = path.join(CONFIG[CONST.CONFIG.SERVICE_PAGES_DIR],       serviceId)
    const serviceOnairDir = path.join(CONFIG[CONST.CONFIG.SERVICE_PAGES_SERVE_DIR], serviceId)

    log(`from: ${serviceOnairDir}  to: ${serviceRepoDir}`)

    try {
      // Copy updated .tti files from on-air dir back into the repo dir
      const anyCopied = await cpUpdate(`${serviceOnairDir}/*.tti`, `${serviceRepoDir}/`)
      if (anyCopied) {
        log('[readBackServices] one or more page files changed')
        changed.add(serviceId)
      }
    } catch (err) {
      // cp exits non-zero when the glob matches nothing — treat that as "no changes"
      logVerbose(`[readBackServices] cp skipped for ${serviceId}: ${err.message}`)
    }

    // Only Git repos are editable; stage, commit and push any changes
    logVerbose(`[readBackServices] pushing ${serviceId} → ${serviceData.updateUrl}`)
    try {
      await gitAt(serviceRepoDir)
        .add('*.tti')
        .commit('Muttlee auto commit v1', ['-a', '--allow-empty'])
        .push()
    } catch (err) {
      logError(`[readBackServices] git push failed for ${serviceId}: ${err.message}`)
      // Don't rethrow — a push failure shouldn't abort the whole run
    }
  }

  return changed
}

// ── updateServices ───────────────────────────────────────────────────────────

async function updateServices (changed) {
  for (const serviceId in CONFIG[CONST.CONFIG.SERVICES_AVAILABLE]) {
    // If readBackServices detected local changes, skip pulling this service
    // so we don't overwrite edits that haven't been pushed yet
    if (changed.has(serviceId)) {
      logVerbose(`Skipping update of ${serviceId} (local changes detected)`)
      continue
    }

    const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][serviceId]

    const serviceTargetDir  = path.join(CONFIG[CONST.CONFIG.SERVICE_PAGES_DIR],       serviceId)
    const serviceServeDir   = path.join(CONFIG[CONST.CONFIG.SERVICE_PAGES_SERVE_DIR],  serviceId)
    const serviceManifestFile = path.join(serviceServeDir, 'manifest.json')

    // ── Read / initialise manifest ──────────────────────────────────────────

    let serviceManifest = { id: serviceId }
    if (fs.existsSync(serviceManifestFile)) {
      try {
        serviceManifest = JSON.parse(fs.readFileSync(serviceManifestFile, 'utf8'))
      } catch (err) {
        logError(`WARNING: Could not parse manifest for ${serviceId}, reinitialising. (${err.message})`)
        serviceManifest = { id: serviceId }
      }
    }

    if (!serviceManifest.pages) serviceManifest.pages = {}

    // ── Decide whether to pull from remote ─────────────────────────────────

    let shouldUpdate = false

    if (serviceData.updateUrl) {
      if (!serviceData.updateInterval || !serviceManifest.lastUpdated) {
        shouldUpdate = true
      } else {
        const nextUpdateAt = Date.parse(serviceManifest.lastUpdated) + (serviceData.updateInterval * 60 * 1000)
        shouldUpdate = nextUpdateAt < Date.now()
        logVerbose(
          `Service ${serviceId}: shouldUpdate=${shouldUpdate}, ` +
          `mins to next update=${Math.round((nextUpdateAt - Date.now()) / 60000)}`
        )
      }

      if (shouldUpdate || options.force) {
        const svnClient = new svn.SVNClient()
        svnClient.setConfig({ silent: !options.verbose })

        if (!fs.existsSync(serviceTargetDir)) {
          // ── First-time checkout ───────────────────────────────────────────
          log(colorette.blueBright(
            `First time checkout of '${serviceId}' service page files (to ${serviceTargetDir})...`
          ))

          if (serviceData.repoType === 'svn') {
            await svnClient.cmd('checkout', [serviceData.updateUrl, serviceTargetDir, ...SVN_TRUST_ARGS])
          } else {
            await gitAt('.').clone(serviceData.updateUrl, serviceTargetDir)
          }
        } else {
          // ── Subsequent update ─────────────────────────────────────────────
          log(`Updating '${serviceId}' service page files...`)

          if (serviceData.repoType === 'svn') {
            try {
              await svnClient.cmd('update', [serviceTargetDir, ...SVN_TRUST_ARGS])
            } catch (err) {
              if (err.message.includes('E155017')) {
                // Checksum mismatch — nuke and re-checkout
                logError(`Checksum mismatch for ${serviceId}. Performing fresh checkout...`)
                fs.rmSync(serviceTargetDir, { recursive: true, force: true })
                await svnClient.cmd('checkout', [serviceData.updateUrl, serviceTargetDir, ...SVN_TRUST_ARGS])
              } else {
                logError(`SVN update failed for ${serviceId}: ${err.message}`)
                continue // Skip this service rather than crashing the whole run
              }
            }
          } else {
            // Pull in the correct repo directory
            await gitAt(serviceTargetDir).pull()
          }
        }
      }
    }

    // ── Ensure serve directory exists ───────────────────────────────────────

    if (!fs.existsSync(serviceServeDir)) {
      logVerbose(`Creating ${serviceServeDir} output directory`)
      fs.mkdirSync(serviceServeDir, { recursive: true })
    }

    // ── Scan and sync page files ────────────────────────────────────────────

    log(`\nChecking '${serviceId}' for updates...`)

    const recalculatedManifestPages = {}
    let manifestChanged = false

    let servicePageFiles
    try {
      servicePageFiles = fs.readdirSync(serviceTargetDir)
    } catch (err) {
      logError(`Could not read ${serviceTargetDir}: ${err.message}`)
      continue
    }

    if (servicePageFiles.length <= 1) {
      logError(`WARNING: '${serviceId}' appears to have no page files — skipping sync.`)
      continue
    }

    for (const filename of servicePageFiles) {
      if (!filename.endsWith(PAGE_FILE_EXT)) continue

      const sourceFilePath = path.join(serviceTargetDir, filename)

      let fileContent
      try {
        fileContent = fs.readFileSync(sourceFilePath, FILE_ENCODING_INPUT).toString()
      } catch (err) {
        logError(`Could not read ${sourceFilePath}: ${err.message}`)
        continue
      }

      // Hash original content
      hasher.reset()
      const fileContentHash = hasher.update(fileContent).digest('hex')

      // Apply character replacements
      for (const [from, to] of Object.entries(FILE_CHAR_REPLACEMENTS)) {
        fileContent = fileContent.replace(from, to)
      }

      // Hash post-replacement content
      hasher.reset()
      const fileContentUpdatedHash = hasher.update(fileContent).digest('hex')

      // Extract metadata from file
      let description = null
      let pageNumber = null

      for (const line of fileContent.split('\n')) {
        if (line.startsWith('DE,')) {
          const raw = line.slice(3).trim()
          description = (raw && !DESCRIPTION_NULLIFY.includes(raw)) ? raw : null
        }
        if (line.startsWith('PN,')) {
          pageNumber = line.slice(3, 6)
        }
      }

      if (!pageNumber) {
        log(`ERROR: Page number could not be extracted from ${sourceFilePath}`)
        continue
      }

      if (recalculatedManifestPages[pageNumber]) {
        logError(colorette.redBright(
          `ERROR: p${pageNumber} already defined in ${recalculatedManifestPages[pageNumber].f}, ` +
          `please fix this in ${filename} (change to an unused page number)`
        ))
        continue
      }

      // If the file is unchanged, carry the existing manifest entry forward as-is
      if (
        serviceManifest.pages[pageNumber] &&
        serviceManifest.pages[pageNumber].oh === fileContentHash
      ) {
        recalculatedManifestPages[pageNumber] = serviceManifest.pages[pageNumber]
        continue
      }

      // File is new or changed — rebuild its manifest entry
      manifestChanged = true

      const manifestPageEntry = { f: filename, p: pageNumber, oh: fileContentHash }
      if (fileContentUpdatedHash !== fileContentHash) manifestPageEntry.nh = fileContentUpdatedHash
      if (description) manifestPageEntry.d = description

      recalculatedManifestPages[pageNumber] = manifestPageEntry

      // Write updated file to serve directory
      const targetFilePath = path.join(serviceServeDir, filename)
      try {
        fs.writeFileSync(targetFilePath, fileContent, FILE_ENCODING_OUTPUT)
        logVerbose(`p${pageNumber} (${filename}) has changed, copied to live`)
      } catch (err) {
        logError(`Could not write ${targetFilePath}: ${err.message}`)
      }

      serviceManifest.lastModified = new Date()
    }

    // ── Remove pages deleted from the repo ──────────────────────────────────

    const deletedPages = deletedDiff(serviceManifest.pages, recalculatedManifestPages)

    if (Object.keys(deletedPages).length > 0) {
      for (const pageNumber of Object.keys(deletedPages)) {
        const filename = serviceManifest.pages[pageNumber]?.f
        if (!filename) continue
        try {
          fs.unlinkSync(path.join(serviceServeDir, filename))
          logVerbose(`Page removed from source, deleting p${pageNumber} (${filename})`)
        } catch (err) {
          logVerbose(`Could not delete ${filename}: ${err.message}`)
        }
      }
      serviceManifest.lastModified = new Date()
      manifestChanged = true
    }

    // ── Write manifest if anything changed ──────────────────────────────────

    if (manifestChanged) {
      serviceManifest.systemName     = PACKAGE_JSON.name
      serviceManifest.systemVersion  = PACKAGE_JSON.version
      serviceManifest.lastUpdated    = new Date()
      if (serviceData.updateInterval) serviceManifest.updateInterval = serviceData.updateInterval
      serviceManifest.pages = recalculatedManifestPages

      logVerbose(`Manifest updated — lastUpdated = ${serviceManifest.lastUpdated}`)

      try {
        fs.writeFileSync(serviceManifestFile, JSON.stringify(serviceManifest))
      } catch (err) {
        logError(`Could not write manifest for ${serviceId}: ${err.message}`)
      }
    }
  }

  log('updateServices completed')
}

// ── Entry point ──────────────────────────────────────────────────────────────

async function main () {
  const changed = await readBackServices()
  await updateServices(changed)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
