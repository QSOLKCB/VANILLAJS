// Local verification launcher: select the already installed native Chromium.
// The repository's Racing Lab assertions and harness remain unchanged.
import {createRequire} from 'node:module';
const require=createRequire('/home/trent/vanillajs-horizon-001/scripts/racing-smoke.mjs');
const {chromium}=require('playwright');
if(!process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)throw Error('Explicit existing browser executable required');
const launch=chromium.launch.bind(chromium);
chromium.launch=options=>launch({...options,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
