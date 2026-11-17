// SPDX-License-Identifier: Apache-2.0
// Keep the HTTP entry URLs from the packager. On disk Chromium can load
// classic sibling scripts, but cannot fetch sibling ES modules from file URLs.
(() => {
  function fail(message) {
    document.documentElement.dataset.labReady = 'failed';
    document.getElementById('race-status').textContent = message;
  }
  function startModule(src, required = true) {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = src;
    if (required) script.onerror = () => fail('Race startup failed. Check that the complete folder was extracted, then reload.');
    document.head.append(script);
  }
  if (location.protocol !== 'file:') {
    const entries = document.getElementById('race-entries').content.querySelectorAll('script');
    for (const entry of entries) startModule(entry.getAttribute('src'), entry === entries[0]);
    return;
  }
  const data = document.createElement('script');
  data.src = './race-file.js';
  data.onerror = () => fail('Local race files are missing. Extract the complete ZIP to one folder, then reopen index.html.');
  data.onload = () => {
    try {
      const {entry, sources} = horizonFileModules;
      const imports = {};
      for (const [path, source] of Object.entries(sources)) {
        imports['horizon-file/' + path] = URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
      }
      // The document owns these URLs until unload, including lazy imports.
      const map = document.createElement('script');
      map.type = 'importmap';
      map.textContent = JSON.stringify({imports});
      document.head.append(map);
      startModule(imports['horizon-file/' + entry]);
    } catch (error) {
      fail('Local race startup failed: ' + error.message);
    }
  };
  document.head.append(data);
})();
