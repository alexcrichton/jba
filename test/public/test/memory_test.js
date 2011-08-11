module('Memory', {
  setup: function() {
    window.mem = new JBA.Memory();
    mem.gpu = new JBA.GPU();
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

test('reading/writing to OAM', function() {
  mem.wb(0xfe03, 0x32);
  equals(mem.rb(0xfe03), 0x32);

  mem.wb(0xfe9f, 0x33);
  equals(mem.rb(0xfe9f), 0x33);
});

/**
 * 0xc000-0xcfff is wram bank 0
 * 0xd000-0xdfff is wram bank 1 (switchable 1-7 if CGB)
 */
test('reading/writing to WRAM banks', function() {
  /* If not CGB, don't swap out banks */
  mem.cgb = 0;
  mem.wb(0xff70, 0x01);
  mem.wb(0xd000, 0x54);
  mem.wb(0xff70, 0x02); /* if CGB, would switch banks */
  equals(mem.rb(0xd000), 0x54);

  mem.cgb = 1;
  mem.wb(0xff70, 0x02); /* now switch WRAM banks */
  equals(mem.rb(0xd000), 0x00);

  mem.wb(0xff70, 0x01); /* back to first bank */
  equals(mem.rb(0xd000), 0x54);

  /* make sure bank 0 is never visible in 0xd000 */
  mem.wb(0xc000, 0x23);
  mem.wb(0xff70, 0x00);
  equals(mem.rb(0xd000), 0x54);
});
