// SPDX-License-Identifier: Apache-2.0
// Only dependency tokens identified in trusted source are replaced. Comments,
// authored data and quoted source inside the portable archive stay byte-exact.
export function fileModuleSource(text, links = []) {
  let result = '', cursor = 0;
  for (const [start, end, path] of links) {
    result += text.slice(cursor, start) + 'horizon-file/' + path;
    cursor = end;
  }
  return result + text.slice(cursor);
}

export function fileModuleArchive(entry, sources) {
  return '// SPDX-License-Identifier: Apache-2.0\n// Generated local-file module archive.\n' +
    'const horizonFileModules = ' + JSON.stringify({entry, sources}) + ';\n';
}
