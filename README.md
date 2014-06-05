# Swift Playground Builder

> Create Xcode Playgrounds for the Swift programming language with rich documentation generated from Markdown

![Playground example](screenshot.png)

## Usage

```js
var playground = require('swift-playground');

// Create "Example.playground" in the same directory
playground('./Example.md', /* options */, /* optional callback */);
```

### Options

* `allowsReset` - A Playground's code can be modified and saved. The Playground can be reset to its original code from the "Editor → Reset Playground" menu. This menu can be disabled for a Playground by setting this option to `false`. Default: `true`
* `platform` - Set the platform to `osx` or `ios` to be able to import each platform's respective frameworks. Default: 'osx'

## Markdown Format

Swift code is extracted from the Markdown with the same syntax used to specify languages for code blocks in GitHub-flavored Markdown:

    ```swift
    println("Hello, world!")
    ```


## TODO

* Command-line tool
* Better documentation and examples
* Improved default stylesheet
* Ability to pass custom stylesheet
* Tests
