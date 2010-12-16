require 'sinatra/base'
require 'active_support/json'
require 'active_support/ordered_hash'
require 'erb'

require File.expand_path('../../lib/js/utils', __FILE__)

class JBAApp < Sinatra::Base
  set :public, File.dirname(__FILE__) + '/public'
  mime_type :gb, 'application/octet-stream'

  get '/' do
    erb :runtests
  end

  get '/roms' do
    erb :roms
  end

  get '/roms2/:rom' do
    content_type :json
    data = nil
    file = File.join(settings.public + '/roms', params[:rom])
    File.open(file, 'rb'){ |f| data = f.read }
    ActiveSupport::JSON.encode(:file => data)
  end

  helpers do
    include JS::Utils

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

end
