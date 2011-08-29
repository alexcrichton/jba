require 'sinatra'
require 'erb'
require 'rack/offline'

require File.expand_path('../utils', __FILE__)

use Rack::Static, :urls => ['/src'],
                  :root => File.expand_path('../..', __FILE__)
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

get '/jba' do
  @js_include = javascript_include_tag 'jba/jba.min.js'
  erb :roms
end

get '/jba/jba.min.js' do
  content_type :js
  file = File.expand_path('../../jba.min.js', __FILE__)

  if File.exist? file
    File.read(file)
  else
    "alert('please run `thor jba:minify` \\nfrom: #{File.dirname(file)}');"
  end
end

offline = Rack::Offline.configure(:cache_interval => 1) do
  cache '/jba/jba.min.js'
  cache '/jba/jba-browser.js'
  cache 'http://code.jquery.com/jquery.min.js'
  cache 'http://cdnjs.cloudflare.com/ajax/libs/modernizr/2.0.6/modernizr.min.js'

  public_path = File.expand_path('../public', __FILE__)
  Dir[public_path + '/jba/roms/*'].each do |file|
    cache file.gsub(public_path, '')
  end

  network "/"
end

get '/jba/jba.manifest' do
  offline.call env
end

helpers do
  include JBA::Utils

  def jba_js_include
    javascript_include_tag js_files.map{ |s| 'src/' + s }
  end

  def js_test_includes
    js = Dir[File.expand_path('../public/test', __FILE__) + '/**/*.js']
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
