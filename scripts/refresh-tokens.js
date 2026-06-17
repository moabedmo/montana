'use strict';

try {
  require('dotenv').config();
} catch (e) { /* optional */ }

const { refreshExpiringTokens } = require('../api/lib/token-refresh');

refreshExpiringTokens()
  .then(function (result) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.failed > 0 ? 1 : 0);
  })
  .catch(function (err) {
    console.error(err.message || err);
    process.exit(1);
  });
