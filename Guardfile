guard 'shell' do
  watch('src/z80/templates/instructions.tt') { `thor jba:gen_z80` }
  watch('lib/z80/generator.rb')              { `thor jba:gen_z80` }
end

guard 'livereload', :apply_js_live => false do
  watch(%r|test/.+\.js$|)
  watch(%r|src/.+\.js$|)
end
