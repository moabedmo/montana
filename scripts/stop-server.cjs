'use strict';

const { execSync } = require('child_process');

const port = String(process.env.PORT || 3000);

function findPids() {
  const pids = new Set();
  try {
    const out = execSync('netstat -ano | findstr ":' + port + '" | findstr LISTENING', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    out.split(/\r?\n/).forEach(function (line) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
    });
  } catch (e) {
    /* nothing listening */
  }
  return [...pids];
}

const pids = findPids();
if (!pids.length) {
  console.log('No process listening on port ' + port);
  process.exit(0);
}

pids.forEach(function (pid) {
  try {
    execSync('taskkill /PID ' + pid + ' /F', { stdio: 'ignore' });
    console.log('Stopped process ' + pid + ' on port ' + port);
  } catch (e) {
    console.error('Could not stop PID ' + pid);
  }
});
