// update-service-pages.js
//   - Fetches / updates teletext services pages from remote repositories to a local location (as defined in config.js)
// by Danny Allen (me@dannya.com)
const fs = require('fs');
const path = require('path');

const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');

const svn = require('@taiyosen/easy-svn');


// import constants and config for use server-side
const CONST = require('./constants.js');
const CONFIG = require('./config.js');


// variables
const PAGE_FILE_EXT = '.tti';

const FILE_ENCODING_INPUT = CONST.ENCODING_ASCII;
const FILE_ENCODING_OUTPUT = CONST.ENCODING_ASCII;

const FILE_CHAR_REPLACEMENTS = {
  '\x8d': '\x1bM',
};


// parse command line options
const availableOptions = [
  {
    name: 'help',
    description: 'Print this usage guide.',
    alias: 'h',
    type: Boolean,
  },

  {
    name: 'silent',
    description: 'No log messages output to the console.',
    alias: 's',
    type: Boolean,
  },
  {
    name: 'verbose',
    description: 'Verbose log messages output to the console.',
    alias: 'v',
    type: Boolean,
  },
];

const options = commandLineArgs(availableOptions);

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
  );

  console.log(usage);

  process.exit(0);
}


async function updateServices() {
  for (let serviceId in CONFIG[CONST.CONFIG.SERVICES_AVAILABLE]) {
    const serviceData = CONFIG[CONST.CONFIG.SERVICES_AVAILABLE][serviceId];

    const serviceTargetDir = path.join(
      CONFIG[CONST.CONFIG.SERVICE_PAGES_DIR],
      serviceId,
    );

    // if service has an update URL...
    if (serviceData.updateUrl) {
      // use Subversion to checkout / update pages...
      let svnClient = new svn.SVNClient();
      svnClient.setConfig({
        silent: !options.verbose,
      });

      if (!fs.existsSync(serviceTargetDir)) {
        if (!options.silent) {
          console.log(
            `First time checkout of '${serviceId}' service page files (to ${serviceTargetDir})...`
          );
        }

        // checkout service pages...
        await svnClient.checkout(
          serviceData.updateUrl,
          serviceTargetDir,
        );

      } else {
        if (!options.silent) {
          console.log(
            `Updating '${serviceId}' service page files...`
          );
        }

        // update service pages...
        await svnClient.update(
          serviceTargetDir,
        );
      }
    }

    // ensure service serve directory exists, and is emptied of existing files
    const serviceServeDir = path.join(
      CONFIG[CONST.CONFIG.SERVICE_PAGES_SERVE_DIR],
      serviceId,
    );

    if (!fs.existsSync(serviceServeDir)) {
      // create directory
      if (options.verbose) {
        console.log(
          `Creating ${serviceServeDir} output directory`
        );
      }

      fs.mkdirSync(serviceServeDir, { recursive: true });

    } else {
      // clean directory
      if (options.verbose) {
        console.log(
          `Cleaning ${serviceServeDir} output directory of existing page files...`
        );
      }

      const files = fs.readdirSync(serviceServeDir);

      for (const file of files) {
        fs.unlinkSync(
          path.join(serviceServeDir, file),
        );
      }
    }


    // copy service pages to serve directory, renamed to be compatible with server expectations
    if (!options.silent) {
      console.log(
        `Copying and renaming '${serviceId}' service page files...\n`
      );
    }

    const servicePageFiles = fs.readdirSync(serviceTargetDir);

    for (const filename of servicePageFiles) {
      if (filename.endsWith(PAGE_FILE_EXT)) {
        // determine full source filepath
        const sourceFilePath = path.join(
          serviceTargetDir,
          filename,
        );

        // read file content as a string
        let fileContent = fs.readFileSync(
          sourceFilePath,
          FILE_ENCODING_INPUT,
        ).toString();

        // make specified character replacements
        for (let char in FILE_CHAR_REPLACEMENTS) {
          fileContent = fileContent.replace(char, FILE_CHAR_REPLACEMENTS[char]);
        }

        // attempt to extract the page number from the file content
        let pageNumber;
        const fileContentLines = fileContent.split('\n');

        for (let i in fileContentLines) {
          if (fileContentLines[i].startsWith('PN,')) {
            pageNumber = fileContentLines[i].slice(3, 6);

            break;
          }
        }

        if (pageNumber) {
          // determine new filename and target file path
          const newFilename = 'p' + pageNumber + PAGE_FILE_EXT;
          const targetFilePath = path.join(
            serviceServeDir,
            newFilename,
          );

          // write file contents out to file
          try {
            fs.writeFileSync(
              targetFilePath,
              fileContent,
              FILE_ENCODING_OUTPUT,
            );

            if (options.verbose) {
              console.log(filename + ' > ' + newFilename);
            }

          } catch (err) {
            if (!options.silent) {
              console.error(err);
            }
          }

        } else {
          // page number could not be extracted
          if (!options.silent) {
            console.log('ERROR: Page number could not be extracted from ' + sourceFilePath);
          }
        }
      }
    }
  }
}


// run update function
updateServices();
