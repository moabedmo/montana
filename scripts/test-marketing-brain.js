const { getMarketingDashboardData } = require('../lib/marketingBrain');

async function test() {
  const data = await getMarketingDashboardData();
  console.log('MARKETING DASHBOARD DATA:', JSON.stringify(data, null, 2));
}

test().catch(console.error);
