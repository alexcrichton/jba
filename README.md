# JBA

An emulator for the Gameboy and Gameboy Color written in Javascript.

Nowhere close to working yet and is very much a work in progress. Will keep notes here as necessary

## Development

### Prerequisites
You need:

  * ruby
  * the `bundler` gem

Then, run `bundle` in the checked out directory

### Running Tests

Run the `guard` command and then visit `http://localhost:3000` in a web browser to run all of the tests

Before you run the tests, make sure that you regenerate generated files (see below).

If you have the [livereload](https://github.com/mockko/livereload) extension, you can connect to the livereload server (run through `guard`) and the page will be automatically refreshed whenever a file changes

### Regenerating files

To optimize slightly, the z80 instruction set is a generated javascript file. To change this, modify one of:

  * `src/z80/templates/instructions.tt`
  * `lib/z80/generator.rb`

The ruby file has the meat of the generation. After modifying the files, file can be regenerated by running

<pre>thor jba:gen_z80</pre>

Or, if you would like the file automatically regenerated when the above files are modified, you can run

<pre>guard</pre>

in the root directory

### Generating `jba.min.js`

To generate the minified form of the javascript (for the main reason of having all of the javascript in one file), run

<pre>thor jba:minify</pre>