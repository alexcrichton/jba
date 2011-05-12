module('MBC3', {
  setup: function() {
    window.mem = new JBA.Memory();
    mem.mbc = JBA.Memory.MBC.MBC3;
  },
  teardown: function() {
    delete window.mem;
  }
});

function dummy_mbc3_data() {
  var dummy = {0x0147: 0x0f};
  return dummy;
}

test('switching between ROM banks', function() {
  var dummy = dummy_mbc3_data();
  dummy[0x7ffe] = 0x90;
  dummy[0x8024] = 0x94;
  dummy[0xd428] = 0x91;
  dummy[0x1fe3ea] = 0x28;
  mem.load_cartridge(dummy);

  equals(mem.rb(0x7ffe), 0x90);

  mem.wb(0x2000, 0x2); // enable the 2nd rom bank
  equals(mem.rb(0x4024), 0x94);

  mem.wb(0x2000, 0x3); // enable the 3rd rom bank
  equals(mem.rb(0x5428), 0x91);

  mem.wb(0x2000, 0xff); // enable the 256th rom bank
  equals(mem.rb(0x63ea), 0x28);
});

test('reading from RTC', function() {
  mem.wb(0x0000, 0xa); // enable ram

  mem.rtc.regs[0] = 0x34;
  mem.wb(0x4000, 0x8);
  equals(mem.rb(0xa000), 0x34);

  mem.rtc.regs[4] = 0x33;
  mem.wb(0x4000, 0xc);
  equals(mem.rb(0xa000), 0x33);
});

test('swapping in ram banks', function() {
  mem.wb(0x0000, 0xa); // enable ram

  mem.wb(0x4000, 0x3);
  mem.wb(0xa000, 0x42);
  equals(mem.rb(0xa000), 0x42);

  mem.wb(0x4000, 0x0);
  mem.wb(0xa000, 0x41);
  equals(mem.rb(0xa000), 0x41);

  mem.wb(0x4000, 0x3);
  equals(mem.rb(0xa000), 0x42);
});
