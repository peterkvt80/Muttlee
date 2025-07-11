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

const commandLineArgs = require('command-line-args')
const commandLineUsage = require('command-line-usage')
const colorette = require('colorette')

const svn = require('@taiyosen/easy-svn')
const git = require('simple-git')
git().clean(git.CleanOptions.FORCE)

const deletedDiff = require('deep-object-diff').deletedDiff
const xxhash = require('@pacote/xxhash')

// import package.json so we can get the current version
const PACKAGE_JSON = JSON.parse(
  fs.readFileSync('./package.json')
)

// import constants and config for use server-side
const CONST = require('./constants.js')
const CONFIG = require('./config.js')

// variables
const PAGE_FILE_EXT = '.tti'

const FILE_ENCODING_INPUT = CONST.ENCODING_ASCII
const FILE_ENCODING_OUTPUT = CONST.ENCODING_ASCII

const FILE_CHAR_REPLACEMENTS = {
  '\x8d': '\x1bM'
}

const DESCRIPTION_NULLIFY = [
  'Description goes here'
]

// parse command line options
const availableOptions = [
  {
    name: 'help',
    description: 'Print this usage guide.',
    alias: 'h',
    type: Boolean
  },

  {
    name: 'silent',
    description: 'No log messages output to the console.',
    alias: 's',
    type: Boolean
  },
  {
    name: 'verbose',
    description: 'Verbose log messages output to the console.',
    alias: 'v',
    type: Boolean
  },

  {
    name: 'force',
    description: 'Force an update of all services, regardless of last update time',
    alias: 'f',
    type: Boolean
  }
]

const options = commandLineArgs(availableOptions)

if (options.help) {
  const usage = commandLineUsage(
    [
      {
        header: 'update-service-pages.js',
        content: 'Fetches / updates teletext services pages from remote repositories to a local location (as defined in config.js)'
      },
      {
        header: 'Options',
        optionList: availableOptions
      }
    ]
  )

  console.log(usage)

  process.exit(0)
}

// initialise hasher
const hasher = xxhash.xxh64(2654435761)

let global_changed = []

/** For editable services, write back the pages
 */
async function readBackServices () {
  // For all the services
  global_changed = new Array() // If an editable service changed, then add it to the list of services not to be overwritten
  for (const serviceId in CONFIG[CONST.CONFIG.SERVICES_AVAILABLE]) {
    const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][serviceId]
    // Filter only the editable services
    if (serviceData.isEditable) {
      console.log('[readBackServices] editable Service id = ' + serviceId)
      // cd /var/www/teletext-services
      // cp /var/www/private/onair/<service>/*.tti .

      /// /// copy changed onair pages back to teletext-service //////
      const serviceRepoDir = path.join(
        CONFIG[CONST.CONFIG.SERVICE_PAGES_DIR],
        serviceId
      )

      const serviceOnairDir = path.join(
        CONFIG[CONST.CONFIG.SERVICE_PAGES_SERVE_DIR],
        serviceId
      )
      console.log('from:' + serviceOnairDir + ' to ' + serviceRepoDir)
      const util = require('util')
      const exec = util.promisify(require('child_process').exec)

      // Copy updated files
      async function cp (src, dest) {
        // const { stdout, stderr } = await exec('cp --update -v ' + src + ' ' + dest + '2>/dev/null || :') //fail silently the first time this is run
        const { stdout, stderr } = await exec('cp --update -v ' + src + ' ' + dest)
        console.log('src:', src)
        console.log('dest:', dest)
        console.log('stdout:', stdout)
        console.log('stderr:', stderr)
        if (stdout.length > 0) {
          console.log('A page file changed')
          global_changed.push(serviceId)
        }
      }
      cp(serviceOnairDir + '/*.tti', serviceRepoDir)

      /// /// Add pages to repo. Warning. Only Git repos can be made editable //////
      console.log('Destination URL = ' + serviceData.updateUrl)
      git(serviceRepoDir)
        .add('*.tti')
        .commit('Muttlee auto commit v1', ['-a'])
        .push()
    } // editable service
  } // for each service
} // readBackServices

async function updateServices () {
  for (const serviceId in CONFIG[CONST.CONFIG.SERVICES_AVAILABLE]) {
    // console.log("Service id = " + serviceId);

    // If the read back changed something, then DO NOT let the repo update
    // or we risk losing a few keystrokes
    if (global_changed.includes(serviceId)) { // It changed?
      if (options.verbose) {
        console.log("Skipping update of " + serviceId) // Updating could overwrite, so don't do it
      }
      continue
    }

    const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][serviceId]

    const serviceTargetDir = path.join(
      CONFIG[CONST.CONFIG.SERVICE_PAGES_DIR],
      serviceId
    )

    const serviceServeDir = path.join(
      CONFIG[CONST.CONFIG.SERVICE_PAGES_SERVE_DIR],
      serviceId
    )

    const serviceManifestFile = path.join(
      serviceServeDir,
      'manifest.json'
    )

    // read / initialise service manifest file
    let serviceManifest = {}

    if (fs.existsSync(serviceManifestFile)) {
      serviceManifest = JSON.parse(
        fs.readFileSync(serviceManifestFile)
      )
    } else {
      // initialise
      serviceManifest.id = serviceId
    }

    if (!serviceManifest.pages) {
      serviceManifest.pages = {}
    }

    let shouldUpdate = false

    // if service has an update URL...
    if (serviceData.updateUrl) {
      // ...and was last updated outside of its updateInterval...
      shouldUpdate = (
        !serviceData.updateInterval ||
        !serviceManifest.lastUpdated
      )

      if (serviceManifest.lastUpdated) {
        shouldUpdate = ((Date.parse(serviceManifest.lastUpdated) + (serviceData.updateInterval * 1000 * 60)) < Date.now())
        if (options.verbose) {
          console.log(
            'Service id = ' + serviceId +
              ' shouldUpdate = ' + shouldUpdate +
              ' mins to next update = ' + parseInt(((Date.parse(serviceManifest.lastUpdated) + (serviceData.updateInterval * 1000 * 60)) - Date.now()) / 60000) // minutes to next update
          )
        }
      }

      if (shouldUpdate || options.force) {
        // ...use Subversion (or git) to checkout / update pages...
        const svnClient = new svn.SVNClient()
        svnClient.setConfig({
          silent: !options.verbose
        })

        if (!fs.existsSync(serviceTargetDir)) {
          if (!options.silent) {
            console.log(
              colorette.blueBright(
                `First time checkout of '${serviceId}' service page files (to ${serviceTargetDir})...`
              )
            )
          }
          if (serviceData.repoType === 'svn') {
            // checkout svn service pages...
            await svnClient.checkout(
              serviceData.updateUrl,
              serviceTargetDir
            )
          } else {
            // checkout git service pages...
            await git().clone(
              serviceData.updateUrl,
              serviceTargetDir
            )
          }
        } else {
          if (!options.silent) {
            console.log(
              `Updating '${serviceId}' service page files...`
            )
          }
          // update service pages...
          if (serviceData.repoType === 'svn') {
            await svnClient.update(
              serviceTargetDir
            )
          } else {
            await git().pull(
            )
          }
        } // update or pull repo
      } // if shouldupdate
    } // if has updateURL

    // The repos have now been updated
    // Now update the service folders

    // ensure service serve directory exists
    if (!fs.existsSync(serviceServeDir)) {
      // create directory
      if (options.verbose) {
        console.log(
          `Creating ${serviceServeDir} output directory`
        )
      }

      fs.mkdirSync(serviceServeDir, { recursive: true })
    }

    // copy service pages to serve directory, renamed to be compatible with server expectations
    if (!options.silent) {
      console.log(
        `\nChecking '${serviceId}' for updates...`
      )
    }

    const recalculatedManifestPages = {}

    const servicePageFiles = fs.readdirSync(serviceTargetDir)
    let manifestChanged = false // Flag if the manifest needs rewriting

    for (const filename of servicePageFiles) {
      // if (options.verbose) {
      //  console.log(
      //  `\nChecking 'file ${filename}' for updates...`
      //  )
      // }
      if (filename.endsWith(PAGE_FILE_EXT)) {
        // determine full source filepath
        const sourceFilePath = path.join(
          serviceTargetDir,
          filename
        )

        // read file content as a string
        let fileContent = fs.readFileSync(
          sourceFilePath,
          FILE_ENCODING_INPUT
        ).toString()

        // hash the original file content string
        hasher.reset()
        const fileContentHash = hasher.update(fileContent).digest('hex')

        // make specified character replacements
        for (const char in FILE_CHAR_REPLACEMENTS) {
          fileContent = fileContent.replace(char, FILE_CHAR_REPLACEMENTS[char])
        }

        // hash the modified (above) file content string
        hasher.reset()
        const fileContentUpdatedHash = hasher.update(fileContent).digest('hex')

        // attempt to extract useful data items from the file content...
        let description
        let pageNumber

        const fileContentLines = fileContent.split('\n')

        for (const i in fileContentLines) {
          if (fileContentLines[i].startsWith('DE,')) {
            description = fileContentLines[i].slice(3)
          }

          if (fileContentLines[i].startsWith('PN,')) {
            pageNumber = fileContentLines[i].slice(3, 6)
          }
        }

        // normalise the description data item
        if (!description) {
          description = null
        } else {
          description = description.trim()

          if (!description || DESCRIPTION_NULLIFY.includes(description)) {
            description = null
          }
        }

        // if we have a valid page number...
        if (pageNumber) {
          if (recalculatedManifestPages[pageNumber]) {
            console.log(
              colorette.redBright(
                `ERROR: p${pageNumber} already defined in ${recalculatedManifestPages[pageNumber].f}, please fix this in ${filename} (change to an unused page number)`
              )
            )

            continue // next service page file
          }

          // if no changes to this page file, no further processing needed...
          if (serviceManifest.pages[pageNumber] && (serviceManifest.pages[pageNumber].oh === fileContentHash)) {
            // add unmodified manifest page object into processed data structure
            recalculatedManifestPages[pageNumber] = serviceManifest.pages[pageNumber]

            continue // next service page file
          }
          manifestChanged = true // something changed

          // if changes have been made to this page file, freshly recreate its manifest page object
          const manifestPageEntry = {
            f: filename,
            p: pageNumber,
            oh: fileContentHash
          }

          if (fileContentUpdatedHash !== fileContentHash) {
            manifestPageEntry.nh = fileContentUpdatedHash
          }

          if (description) {
            manifestPageEntry.d = description
          }

          recalculatedManifestPages[pageNumber] = manifestPageEntry

          // determine new filename and target file path
          const targetFilePath = path.join(
            serviceServeDir,
            filename
          )

          // write file contents out to file
          try {
            fs.writeFileSync(
              targetFilePath,
              fileContent,
              FILE_ENCODING_OUTPUT
            )

            if (options.verbose) {
              console.log(
                `p${pageNumber} (${filename}) has changed, copied to live`
              )
            }
          } catch (err) {
            if (!options.silent) {
              console.error(err)
            }
          }

          // update the last modified timestamp
          serviceManifest.lastModified = new Date() // [!] Not sure if we need to do something with manifestChanged at this point
        } else {
          // page number could not be extracted
          if (!options.silent) {
            console.log(`ERROR: Page number could not be extracted from ${sourceFilePath}`)
          }
        }
      }
    } // for all servicePageFiles  (continue resumes here)

    // if pages have been removed from the repository since the last run, also delete them from the target directory
    const deletedPageFiles = deletedDiff(serviceManifest.pages, recalculatedManifestPages)

    if (Object.keys(deletedPageFiles).length > 0) {
      for (const pageNumber in deletedPageFiles) {
        try {
          fs.unlinkSync(
            path.join(serviceServeDir, serviceManifest.pages[pageNumber].f)
          )

          if (options.verbose) {
            console.log(
              `Page removed from source, deleting p${pageNumber} (${serviceManifest.pages[pageNumber].f})`
            )
          }
        } catch (err) {}
      }

      // update the last modified timestamp
      serviceManifest.lastModified = new Date()
      manifestChanged = true
    }

    // update manifest fields
    if (manifestChanged) {
      serviceManifest.systemName = PACKAGE_JSON.name
      serviceManifest.systemVersion = PACKAGE_JSON.version
      serviceManifest.lastUpdated = new Date()
      if (options.verbose) {
        console.log(
          'Manifest updated - lastUpdated = ' + serviceManifest.lastUpdated
        )
      }

      if (serviceData.updateInterval) {
        serviceManifest.updateInterval = serviceData.updateInterval
      }

      serviceManifest.pages = recalculatedManifestPages

      // write out updated service file manifest
      fs.writeFileSync(
        serviceManifestFile,
        JSON.stringify(
          serviceManifest
        )
      ) // write out manifest
    }
  } // for each service (contnue here if there are no manifest updates)
} // updateServices

// For editable pages, write them back to the repo
const changed = readBackServices()
// run update function
updateServices(changed)
