const { runLabubuJob } = require('./src/jobs/xhs-labubu');

async function main() {
  const logger = {
    info: console.log,
    success: console.log,
  }
  await runLabubuJob(logger)
}

main() 