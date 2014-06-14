#!/usr/bin/env node

var nomnom = require('nomnom')
  .option('paths', {
    position: 0,
    list: true,
    required: true,
    help: 'Markdown files(s), or directory containing Markdown files, from which to build the Playground(s)'
  })
  .option('destination', {
    abbr: 'd',
    help: 'Directory in which to output the Playground(s)'
  })
  .option('platform', {
    abbr: 'p',
    choices: ['ios', 'osx'],
    default: 'osx',
    help: 'Specifies which platform\'s frameworks can be imported in the Playground(s)'
  })
  .option('noReset', {
    full: 'noreset',
    abbr: 'n',
    flag: true,
    help: 'Don\'t allow edited code to be reset from the "Editor → Reset Playground" menu'
  })
  .option('stylesheet', {
    abbr: 's',
    help: 'Path to custom stylesheet'
  })
  .option('version', {
    abbr: 'v',
    flag: true,
    help: 'Print swift-playground-builder version and exit',
    callback: function() {
      return require('../package').version;
    }
  });

var opts = nomnom.nom();
var playground = require('./index');
playground.createFromFiles(opts.paths, {
  outputDirectory: opts.destination,
  allowsReset: !opts.noReset,
  platform: opts.platform,
  stylesheet: opts.stylesheet
}, function(err) {
  if (err) { throw err; }
});
