module('No MBC', {
  setup: function() {
    window.mem = new JBA.Memory();
    mem.mbc = JBA.Memory.MBC.NONE;
  },
  teardown: function() {
    delete window.mem;
  }
});

function dummy_nombc_data() {
  var dummy = {0x0147: 0x00};
  return dummy;
}

test('reads addresses below 0x7fff from rom', function() {
  var dummy = dummy_nombc_data();
  dummy[0x2283] = 0x31;
  dummy[0x998]  = 0x28;
  dummy[0x7fff] = 0x24;
  mem.load_cartridge(dummy);

  equals(mem.rb(0x2283), 0x31);
  equals(mem.rb(0x998), 0x28);
  equals(mem.rb(0x7fff), 0x24);
});

test('reads addresses above 0xa000 from ram when enabled', function() {
  mem.ramon = 1;
  equals(mem.rb(0xa042), 0x00);

  mem.wb(0xa042, 0xa3);
  equals(mem.rb(0xa042), 0xa3);

  mem.ww(0xa042, 0xdead);
  equals(mem.rw(0xa042), 0xdead);
});
