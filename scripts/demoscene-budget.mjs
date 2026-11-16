// SPDX-License-Identifier: Apache-2.0
import {machineRemembers} from '../demos/demoscene-lab/preset.js';
import {portableDemo} from './demoscene-package.mjs';
if(process.argv.length>2)throw Error('usage: node scripts/demoscene-budget.mjs');
const {report}=await portableDemo(machineRemembers());console.log(JSON.stringify(report,null,2));
