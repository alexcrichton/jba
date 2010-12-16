require 'sinatra'
require 'erb'

get '/' do
  erb :runtests
end

get '/roms' do
  erb :roms
end

def javascript_include_tag *sources
  sources.map{ |s|
    s += '.js' unless s.end_with?('.js')
    "<script type='text/javascript' src='/public/#{s}'></script>"
  }.join("\n")
end
