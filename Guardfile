$LOAD_PATH << File.expand_path('../lib', __FILE__)

guard 'sinatra', :dir => 'test', :file => 'test/server.rb' do
  watch('test/server.rb')
end

guard 'shell' do
  watch('src/z80/templates/instructions.tt') { `thor jba:gen_z80` }
  watch('lib/z80/generator.rb')              { `thor jba:gen_z80` }
end

guard 'livereload', :apply_js_live => false do
  watch('test/runtests.html')
  watch('test/.+\.js$')
  watch('src/.+\.js$')
end
