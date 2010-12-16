require 'guard'
require 'guard/guard'
require File.expand_path('../../../test/server.rb', __FILE__)

module Guard
  class Sinatra < Guard
    def start
      @pid = fork{ JBAApp.run! :host => 'localhost', :port => 3000 }
    end

    def stop
      # The CTRL-C call was already proxied over to the pid, just wait for it
      # to die now
      Process.waitpid @pid
      true
    end

    def run_on_change paths
      Process.kill 'INT', @pid
      stop
      start
    end

  end
end
