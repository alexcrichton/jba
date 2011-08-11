module('StringIO', {
  setup: function() {
    window.io = new JBA.StringIO();
  },

  teardown: function() {
    delete window.io;
  }
});

test('writing a word and then reading it back', function() {
  io.ww(0xff43);
  io.rewind();
  equals(io.rw(), 0xff43);
});

test('writing a byte and then reading it back', function() {
  io.wb(0x43);
  io.rewind();
  equals(io.rb(), 0x43);
});

test('reading a byte/word with an empty string raises error', function() {
  raises(function() { io.rb(); });
  raises(function() { io.rw(); });
});

test('writing an invalid byte/word raises error', function() {
  raises(function() { io.wb(0xff1); });
  raises(function() { io.wb(-1); });
  raises(function() { io.ww(0x83029); });
  raises(function() { io.ww(-1); });
});
