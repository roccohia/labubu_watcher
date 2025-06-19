const { defineConfig } = require('browser-use');

module.exports = defineConfig({
  name: 'labubu xhs watcher',
  jobs: ['xhs-labubu'],
});

declare module 'browser-use' {
    interface JobConfig {
      name: string;
      jobs: string[];
    }
  
    export function defineConfig(config: JobConfig): JobConfig;
  }
  