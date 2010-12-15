module('Memory', {
  setup: function() {
    window.mem = new JBA.Memory();
  },

  teardown: function() {
    delete window.mem;
  }
});

test('wram reading/writing mirrors correctly', function() {
  mem.wb(0xcae0, 0x31);
  equals(mem.rb(0xcae0), 0x31);
  equals(mem.rb(0xeae0), 0x31);

  mem.wb(0xd032, 0x32);
  equals(mem.rb(0xd032), 0x32);
  equals(mem.rb(0xf032), 0x32);

  mem.wb(0xe8a9, 0x33);
  equals(mem.rb(0xe8a9), 0x33);
  equals(mem.rb(0xc8a9), 0x33);
});

test('high RAM is accessible', function() {
  mem.wb(0xff89, 0x78);
  equals(mem.rb(0xff89), 0x78);

  mem.wb(0xfff3, 0x83);
  equals(mem.rb(0xfff3), 0x83);
});

test('reading/writing VRAM', function() {
  mem.wb(0xc089, 0x78);
  equals(mem.rb(0xc089), 0x78);

  mem.wb(0xd5f3, 0x83);
  equals(mem.rb(0xd5f3), 0x83);
});
