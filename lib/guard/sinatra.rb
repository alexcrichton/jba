require 'guard'
require 'guard/guard'

module Guard
  class Sinatra < Guard
    def initialize *args
      super
      @file = File.expand_path(options[:file])
    end

    def start
      @pid = fork{
        require @file
        Dir.chdir options[:dir] if options[:dir]
        JBAApp.run! :host => 'localhost', :port => 3000
      }
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
