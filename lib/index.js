var fs     = require('fs-extra');
var path   = require('path');
var async  = require('async');
var marked = require('marked');
var xml    = require('xml');

var TEMPLATE_DIRECTORY  = path.join(__dirname, 'template');
var STYLESHEET_FILE     = path.join(TEMPLATE_DIRECTORY, 'stylesheet.css');
var HTML_TEMPLATE_FILE  = path.join(TEMPLATE_DIRECTORY, 'documentation.html');
var HTML_TEMPLATE       = fs.readFileSync(HTML_TEMPLATE_FILE, { encoding: 'utf8' });
var MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkdn', 'mkd'];

function PlaygroundBuilder(options) {
  options = options || {};
  this._setMarkdown(options.markdown);
  this.name = options.name || 'MyPlayground';
  this.sections = [];
  this.sectionsIndex = 0;
  this.inSwiftBlock = false;
  this.allowsReset = options.allowsReset;
  if (options.platform === 'osx') {
    this.platform = 'macosx';
  } else if (options.platform === 'ios') {
    this.platform = 'iphonesimulator';
  }
}

PlaygroundBuilder.prototype._setMarkdown = function(markdown) {
  if (typeof markdown !== 'string') {
    throw new Error('Expected markdown to be string, but got ' + typeof markdown);
  }
  this.markdown = markdown;
  this.lines    = markdown.split(/\n/);
  this.numLines = this.lines.length;
}

PlaygroundBuilder.prototype._extractSections = function(callback) {
  callback = (typeof callback === 'function') ? callback : function noop() {};

  for (var i = 0; i < this.numLines; i++) {
    var trimmedLine = this.lines[i].trim();

    if (trimmedLine === '```swift') {
      this.inSwiftBlock = true;
    } else if (trimmedLine === '```') {
      this.inSwiftBlock = false;
    }

    if (trimmedLine === '```swift' || trimmedLine === '```') {
      this._breakSection();
      continue;
    }

    this._createSectionWithType(this.inSwiftBlock ? 'code' : 'documentation');
    this._addLineToCurrentSection(this.lines[i]);
  }

  this._breakSection();

  callback(null, this.sections);
}

PlaygroundBuilder.prototype._createSectionWithType = function(type) {
  if (['documentation', 'code'].indexOf(type) === -1) {
    throw new Error('Section type must be "documentation" or "code"');
  }

  if (!this.sections[this.sectionsIndex]) {
    var name = 'section-' + this.sectionsIndex;
    var ext = type === 'documentation' ? '.html' : '.swift';
    this.sections[this.sectionsIndex] = {
      id: this.sectionsIndex + 1,
      type: type,
      filename: name + ext,
      content: []
    };
  }
}

PlaygroundBuilder.prototype._addLineToCurrentSection = function(line) {
  this.sections[this.sectionsIndex].content.push(line);
}

PlaygroundBuilder.prototype._breakSection = function() {
  if (!this.sections[this.sectionsIndex]) {
    return;
  }

  var content = this.sections[this.sectionsIndex].content.join('\n');
  this.sections[this.sectionsIndex].content = content;

  // Remove the section if it has no content
  if (!content) {
    this.sections.splice(this.sectionsIndex, 1);
  }

  this.sectionsIndex++;
}

PlaygroundBuilder.prototype._renderHTMLForSection = function(section) {
  return HTML_TEMPLATE
    .replace('{{title}}', 'Section ' + section.id)
    .replace('{{content}}', marked(section.content));
}

PlaygroundBuilder.prototype._getPlaygroundXML = function() {
  var xmlObject = {
    playground: [ { _attr: {
      'version': '3.0',
      'sdk': this.platform || 'macosx',
      'allows-reset': this.allowsReset === false ? 'NO' : 'YES'
    } } ]
  };

  xmlObject.playground.push({
    sections: this.sections.map(function(section) {
      if (section.type === 'documentation') {
        return { 'documentation': [{ _attr: { 'relative-path': section.filename }}] };
      }
      if (section.type === 'code') {
        return { 'code': [{ _attr: { 'source-file-name': section.filename }}] };
      }
    })
  });

  return xml(xmlObject, {
    indent: '    ',
    declaration: {
      standalone: 'yes',
      encoding: 'UTF-8'
    }
  });
}

PlaygroundBuilder.prototype._createPlaygroundFile = function(outputFile, callback) {
  var numSections  = this.sections.length;
  var filesToWrite = [];

  // Append .playground extension
  if (path.extname(outputFile) !== '.playground') {
    outputFile = outputFile + '.playground';
  }

  // Section files (documentation and code)
  this.sections.forEach(function(section) {
    if (section.type === 'documentation') {
      var html = this._renderHTMLForSection(section);
      filesToWrite.push({
        filename: path.join(outputFile, 'Documentation', section.filename),
        content: html
      });
    } else if (section.type === 'code') {
      filesToWrite.push({
        filename: path.join(outputFile, section.filename),
        content: section.content
      });
    }
  }.bind(this));

  // XML manifest file containing references to the docs and code
  filesToWrite.push({
    filename: path.join(outputFile, 'contents.xcplayground'),
    content: this._getPlaygroundXML()
  });

  // Copy template stylesheet to the Playground
  fs.copy(STYLESHEET_FILE, path.join(outputFile, 'Documentation', 'stylesheet.css'));

  async.parallel(filesToWrite.map(function(file) {
    return function(callback) {
      fs.outputFile(file.filename, file.content, callback);
    }
  }), callback);
}

PlaygroundBuilder.prototype.create = function(outputDirectory, callback) {
  if (typeof outputDirectory === 'function') {
    callback = outputDirectory;
    outputDirectory = null;
  }

  callback = typeof callback === 'function' ? callback : function noop() {};

  if (!outputDirectory) {
    outputDirectory = process.cwd();
  } else {
    outputDirectory = path.relative(process.cwd(), outputDirectory);
  }

  var outputFile = path.resolve(outputDirectory, this.name);

  this._extractSections(function(err) {
    if (err) { throw err; }
    this._createPlaygroundFile(outputFile, callback);
  }.bind(this));
};

function getMarkdownFiles(filesArray, filesOrDirectories) {
  if (typeof filesOrDirectories === 'string') {
    filesOrDirectories = [filesOrDirectories]
  }

  filesOrDirectories.forEach(function(filePath) {
    var stats = fs.lstatSync(filePath);
    if (stats.isDirectory()) {
      var files = fs.readdirSync(filePath).map(function(file) {
        return path.join(filePath, file);
      });
      getMarkdownFiles(filesArray, files);
      return;
    }
    if (stats.isFile()) {
      if (MARKDOWN_EXTENSIONS.indexOf(filePath.split('.').pop()) > -1) {
        filesArray.push(filePath);
      }
    }
  });
}

function createFromFiles(paths, options, callback) {
  if (!paths) {
    throw new Error('Input file or directory must be specified');
  }

  var files = [];
  getMarkdownFiles(files, paths);

  async.parallel(files.map(function(file) {
    return function(callback) {
      fs.readFile(file, { encoding: 'utf8' }, function(err, markdown) {
        if (err) { return callback(err); }
        options.name = path.basename(file.substr(0, file.lastIndexOf('.')));
        createFromString(markdown, options, callback);
      });
    };
  }), callback);
};

function createFromString(markdown, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  options = options || {};
  options.markdown = markdown;

  var builder = new PlaygroundBuilder(options);
  builder.create(options.outputDirectory, callback);
};

exports.createFromFile = createFromFiles;
exports.createFromFiles = createFromFiles;
exports.createFromString = createFromString;
