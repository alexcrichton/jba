require File.expand_path('../lib/z80/generator', __FILE__)
require File.expand_path('../lib/jba/utils', __FILE__)

class JBA < Thor
  include Thor::Actions
  include Z80::Generator
  include ::JBA::Utils

  def self.source_root
    File.expand_path('../src/z80/templates', __FILE__)
  end

  desc 'gen_z80', 'Generate the instructions for the z80 processor in JS'
  def gen_z80
    @instructions = StringIO.new.tap{ |io| generate_z80 io }.string
    template 'instructions.tt', 'src/z80/instructions.js', :force => true
  end

  desc 'check', 'Check the js with Google closure compiler'
  def check
    args = '--warning_level VERBOSE ' + js_args.join(' ')
    args << ' --js_output_file /dev/null'

    exec 'closure ' + args
  end

  desc 'minify', 'Minify all of the JS into one file'
  def minify
    exec "closure #{js_args.join(" ")} --js_output_file jba.min.js" \
      " --compilation_level ADVANCED_OPTIMIZATIONS"
  end

  desc 'server', 'Run the testing server and the "guard" command'
  def server
    pids = []
    pids << fork { exec 'guard' }
    pids << fork { exec 'shotgun test/server.rb' }
    pids.each{ |p| Process.waitpid p }
  end

  protected

  def js_args
    js_files.map{ |s|
      '--js src/' + s
    } << '--externs lib/jba/jquery-1.4.3.externs.js'
  end
end
