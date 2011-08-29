/**
 * Adapter to run JBA in a browser. Binds UI elements and performs necessary
 * persistent storage of snapshots/battery saves.
 */
$(function() {
  var storage = window.localStorage;
  var current_filename;
  var update_snapshots = function() {};
  var frame_interval = null;

  function start_frames() {
    var interval = 16; // 16ms between frames ~ 60fps
    interval /= $('.slider.speed input[type=range]').val();
    frame_interval = setInterval(function() {
      try {
        gb.frame();
      } catch (e) {
        stop_frames();
        throw e;
      }
    }, interval);
  }

  function stop_frames() {
    clearInterval(frame_interval);
    frame_interval = null;
  }

  // Run the gameboy, doing some UI tweaks as well
  function run(filename, rom) {
    save_ram_image();
    stop_frames();
    if (filename && rom) {
      gb.reset();
      gb.load_rom(rom);
      var image = storage[filename + 'Battery'];
      if (image) {
        gb.load_ram_image(image);
      }
      current_filename = filename;
      update_snapshots();
    }
    start_frames();
    $('button').prop('disabled', false);
    $('button.run').text('Stop');
    $('.state').text('running');
  }

  function load_remote_rom(url) {
    $.ajax({
      url: url,
      /* Force the browser to interpret this as binary data instead of unicode
         which produces incorrect charCodeAt() return values */
      beforeSend: function(xhr) {
        xhr.overrideMimeType('text/plain; charset=x-user-defined');
      },
      context: this,
      success: function(data) {
        var segments = url.split('/');
        run(segments[segments.length - 1], data);
      }
    });
  }

  function save_ram_image() {
    if (current_filename) {
      var image = gb.ram_image();
      if (image.length > 0) storage[current_filename + 'Battery'] = image;
    }
  }

  function implement_snapshots() {
    function keyFor(num) { return 'gbSnapshot' + num; }

    update_snapshots = function() {
      $('.snapshot').each(function(_, el) {
        var key = current_filename + $(el).data('num');
        $(el).find('.load, .missing').show();
        if (storage[key]) {
          $(el).find('.load').text(storage[key + 'Date']);
          $(el).find('.missing').hide();
        } else {
          $(el).find('.load').hide();
        }
      });
    };
    update_snapshots();

    $('.snapshot a.save').click(function() {
      var key = current_filename + $(this).closest('li').data('num');
      var date = new Date().toString();
      storage[key] = gb.snapshot();
      storage[key + 'Date'] = date;
      $(this).siblings('.missing').hide();
      $(this).siblings('.load').show().text(date);
      return false;
    });

    $('.snapshot a.load').click(function() {
      var key = current_filename + $(this).closest('li').data('num');
      stop_frames();
      try {
        gb.load_snapshot(storage[key]);
        run();
      } catch (e) {
        alert(e);
      }
      return false;
    });

    setInterval(save_ram_image, 1000);
  }

  function implement_load_custom_roms() {
    $('.rom a').click(function() {
      $('input[type=file]').click();
      return false;
    });

    $('.rom input[type=file]').change(function() {
      var file = this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onloadend = function() {
        try {
          run(file.name, reader.result);
        } catch (e) {
          alert("Invalid ROM: " + e);
        }
      };
      reader.readAsBinaryString(file);
    });
    $('#nofilereader').hide();
  }

  // If we don't have a canvas, then this entire project is just flat out
  // useless
  if (!Modernizr.canvas || !('Uint8Array' in window)) {
    $('#gb, #status, #controls').hide();
    return;
  }
  // Global JBA instance
  window.gb = new JBA();

  // Integrate the GB with the current window
  gb.set_canvas($('#gb')[0]);
  $(window).keydown(function(e) { gb.keydown(e.keyCode); });
  $(window).keyup(function(e) { gb.keyup(e.keyCode); });

  // If we can read local files, then bind the link. Otherwise, hide the
  // link.
  'FileReader' in window ? implement_load_custom_roms()
                         : $('.rom .local').hide();

  // Take snapshots of the GB state and load them into the GB.
  Modernizr.localstorage ? implement_snapshots() : $('#snapshots').hide();

  // Callback for selecting new ROMs in the dropdown menu.
  $('.rom select').change(function() {
    $('button').prop('disabled', true);
    $(this).blur();

    if ($(this).val() == '') {
      $('.state').text('waiting');
      return;
    }
    $('.state').text('loading');
    load_remote_rom($(this).val());
  });

  // Callback for the start/stop emulation button.
  $('button.run').click(function() {
    if ($(this).text() == 'Stop') {
      stop_frames();
      $(this).text('Run');
      $('.state').text('stopped');
    } else {
      start_frames();
      $(this).text('Stop');
      $('.state').text('running');
    }
  });

  // Callback for reset to the beginning of the rom (power on/off).
  $('button.reset').click(function() { $('.rom select').change(); });
  // Callback for the slider to resize the gameboy window.
  $('.size input[type=range]').change(function() {
    $('#gb').width($(this).val() * 160).height($(this).val() * 144);
    $('.size .val').text($(this).val());
  });
  $('.speed input[type=range]').change(function() {
    $('.speed .val').text($(this).val());
    if (frame_interval) {
      stop_frames();
      start_frames();
    }
  });
  // FPS updater
  setInterval(function() { $('.fps').text(gb.frames_count()); }, 1000);

  // Don't show non-pretty slider range unless it's supported
  if (!Modernizr.inputtypes.range) {
    $('.slider').hide();
  }

  // Please use chrome
  if (navigator.userAgent.match(/chrome/i)) {
    $('#nochrome').hide();
  }
});
