require 'sinatra'
require 'active_support/json'
require 'active_support/ordered_hash'
require 'erb'

require File.expand_path('../../lib/jba/utils', __FILE__)

set :public, File.expand_path('../public', __FILE__)
mime_type :gb, 'application/octet-stream'

get '/' do
  erb :runtests
end

get '/debug' do
  erb :debug
end

get '/roms' do
  @js_include = jba_js_include
  erb :roms
end

get '/min' do
  @js_include = javascript_include_tag 'jba.min.js'
  erb :roms
end

get '/jba.min.js' do
  content_type :js
  file = File.expand_path('../../jba.min.js', __FILE__)

  if File.exist? file
    File.read(file)
  else
    "alert('please run `thor jba:minify` \\nfrom: #{File.dirname(file)}');"
  end
end

helpers do
  include JBA::Utils

  def jba_js_include
    javascript_include_tag js_files.map{ |s| 'src/' + s }
  end

  def js_test_includes
    js = Dir[File.expand_path('../public', __FILE__) + '/**/*.js']
    js = js.select{ |s| s !~ /\/src\// }
    js = js.map{ |s| s.gsub(/^.+?public\//, '') }
    javascript_include_tag js
  end

  def javascript_include_tag *sources
    sources.flatten.map{ |s|
      s += '.js' unless s.end_with?('.js')
      "<script type='text/javascript' src='/#{s}'></script>"
    }.join("\n")
  end
end
