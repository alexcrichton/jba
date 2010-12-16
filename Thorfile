require File.expand_path('../lib/z80/generator', __FILE__)
require File.expand_path('../lib/js/utils', __FILE__)

class JBA < Thor
  include Thor::Actions
  include Z80::Generator
  include JS::Utils

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
    js = js_files.map{ |s| 'src/' + s }
    args = '--warning_level VERBOSE ' + js.map{ |s| "--js #{s}" }.join(' ')
    args << ' --js_output_file /dev/null'

    system 'closure ' + args
  end
end
