module('MBC1', {
  setup: function() {
    window.mem = new JBA.Memory();
    mem.mbc = JBA.Memory.MBC.MBC1;
  },
  teardown: function() {
    delete window.mem;
  }
});

function dummy_mbc1_data() {
  var dummy = {0x0147: 0x01};
  dummy.charCodeAt = function(addr){ return dummy[addr]; };
  return dummy;
}

test('reads addresses below 0x7fff from rom', function() {
  var dummy = dummy_mbc1_data();
  dummy[0x2283] = 0x31;
  dummy[0x998]  = 0x28;
  dummy[0x7fff] = 0x24;
  mem.load_cartridge(dummy);

  equals(mem.rb(0x2283), 0x31);
  equals(mem.rb(0x998), 0x28);
  equals(mem.rb(0x7fff), 0x24);
});

test('switching the rom pages and reading from the new page', function() {
  var dummy = dummy_mbc1_data();
  dummy[0x80f3] = 0x24;
  dummy[0xd0e8] = 0x25;
  mem.load_cartridge(dummy);

  mem.wb(0x2001, 0x02); // Trigger the 2nd rom page
  equals(mem.rb(0x40f3), 0x24);

  mem.wb(0x2001, 0x03); // Trigger the 3rd rom page
  equals(mem.rb(0x50e8), 0x25);

  mem.wb(0x2001, 0xe2); // Ignore the upper bits
  equals(mem.rb(0x40f3), 0x24);
});

test('ram is disabled until an address under 0x1fff is written to', function() {
  mem.wb(0xa032, 0x24);
  equals(mem.rb(0xa032), 0xff);

  mem.wb(0x0032, 0x0e); // Must have lower 4 bits 0xa
  mem.wb(0xa032, 0x24);
  equals(mem.rb(0xa032), 0xff);

  mem.wb(0x0032, 0xa); // Must have lower 4 bits 0xa
  mem.wb(0xa032, 0x24);
  equals(mem.rb(0xa032), 0x24);
});

test('reads addresses above 0xa000 from ram when enabled', function() {
  mem.ramon = 1;
  equals(mem.rb(0xa042), 0x00);

  mem.wb(0xa042, 0xa3);
  equals(mem.rb(0xa042), 0xa3);

  mem.ww(0xa042, 0xdead);
  equals(mem.rw(0xa042), 0xdead);
});

test('switching out the ram banks', function() {
  mem.wb(0x0000, 0xa); // enable ram
  mem.wb(0x6000, 0x1); // enable ram bank selection mode

  mem.wb(0xa042, 0xa3);
  equals(mem.rb(0xa042), 0xa3);

  mem.wb(0x4000, 0x2); // switch to second bank
  equals(mem.rb(0xa042), 0x0);
  mem.wb(0xa043, 0xbe);
  equals(mem.rb(0xa043), 0xbe);

  mem.wb(0x4000, 0x0); // back to zeroth bank
  equals(mem.rb(0xa042), 0xa3);
  mem.wb(0x4000, 0x2); // back to second bank
  equals(mem.rb(0xa043), 0xbe);

  // Only uses lower 2 bits
  mem.wb(0x4000, 0xfc);
  equals(mem.rb(0xa042), 0xa3);
  mem.wb(0x4000, 0xfe);
  equals(mem.rb(0xa043), 0xbe);
});

test('switching out high rom banks', function() {
  // low 14 bits are address into bank
  // low 5 bits of bank address set via 0x2000-0x3fff
  // high 2 bits of bank address set via 0x4000-0x5fff
  // = 21 bits total
  var dummy = dummy_mbc1_data();
  // high 2 bits << 19, low 5 bits << 14, address << 0
  dummy[(0x2 << 19) | (0x14 << 14) | 0x0eef] = 0x43;
  dummy[(0x1 << 19) | (0x05 << 14) | 0x1bc4] = 0x78;
  mem.load_cartridge(dummy);

  mem.wb(0x2000, 0xf4); // low 5 bits, making sure extra chopped off
  mem.wb(0x4000, 0xfe); // high 2 bits, making sure extra chopped off

  equals(mem.rb(0x4eef), 0x43);

  mem.wb(0x2000, 0x05); // low 5 bits
  mem.wb(0x4000, 0x01); // high 2 bits

  equals(mem.rb(0x5bc4), 0x78);
});
