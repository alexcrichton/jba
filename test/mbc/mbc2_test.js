module('MBC2', {
  setup: function() {
    window.mem = new JBA.Memory();
    mem.mbc = JBA.Memory.MBC.MBC2;
  },
  teardown: function() {
    delete window.mem;
  }
});

function dummy_mbc2_data() {
  var dummy = {0x0147: 0x05};
  dummy.charCodeAt = function(addr){ return dummy[addr]; };
  return dummy;
}

test('reads addresses below 0x7fff from rom', function() {
  var dummy = dummy_mbc2_data();
  dummy[0x2283] = 0x31;
  dummy[0x998]  = 0x28;
  dummy[0x7fff] = 0x24;
  mem.load_cartridge(dummy);

  equals(mem.rb(0x2283), 0x31);
  equals(mem.rb(0x998), 0x28);
  equals(mem.rb(0x7fff), 0x24);
});

test('writes only the lower 4 bits of bytes to ram', function() {
  mem.ramon = 1;
  equals(mem.rb(0xa042), 0x00);

  mem.wb(0xa042, 0xa3);
  equals(mem.rb(0xa042), 0x3);

  mem.ww(0xa042, 0xdead);
  equals(mem.rw(0xa042), 0x0e0d);
});

test('it toggles ram operation with only specific addresses', function() {
  mem.ramon = 0;
  mem.wb(0x0000, 0x42);
  equals(mem.ramon, 1);

  mem.wb(0x0100, 0x42);
  equals(mem.ramon, 1);

  mem.wb(0x0200, 0x42);
  equals(mem.ramon, 0);

  mem.wb(0x0300, 0x42);
  equals(mem.ramon, 0);
});

test('selecting the ROM bank number', function() {
  var dummy = dummy_mbc2_data();
  dummy[0xd429] = 0x28;
  dummy[0x8094] = 0x24;
  dummy[0x74ae] = 0x27;
  mem.load_cartridge(dummy);

  equals(mem.rb(0x74ae), 0x27);

  mem.wb(0x2100, 0xf2); // switch to the second bank
  equals(mem.rb(0x4094), 0x24);
  mem.wb(0x2000, 0xf0); // make sure bank switch ignored
  equals(mem.rb(0x4094), 0x24);

  mem.wb(0x2100, 0xf3); // switch to the third bank
  equals(mem.rb(0x5429), 0x28);
});
