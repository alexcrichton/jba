module('RTC', {
  setup: function() {
    window.rtc = new JBA.RTC();
  },

  teardown: function() {
    delete window.rtc;
  }
});

test('latching the values into the registers', function() {
  rtc.s = 0x20;
  rtc.h = 0x10;
  rtc.m = 0x08;
  rtc.d = 0x49;
  rtc.carry = 1;
  rtc.stop = 0;

  // Initially 0, no latching
  rtc.latch(0);
  for (var i = 0; i < 8; i++) equals(rtc.regs[1], 0x00);

  // Random number, still no latching
  rtc.latch(0x10);
  for (var i = 0; i < 8; i++) equals(rtc.regs[1], 0x00);

  // Actually do the latching
  rtc.latch(0);
  rtc.latch(1);

  equals(rtc.regs[0], 0x20);
  equals(rtc.regs[1], 0x08);
  equals(rtc.regs[2], 0x10);
  equals(rtc.regs[3], 0x49);
  equals(rtc.regs[4], 0x80);
  equals(rtc.regs[5], 0xff);
  equals(rtc.regs[6], 0xff);
  equals(rtc.regs[7], 0xff);

  rtc.stop = 1;
  rtc.d    = 0x1ff;

  rtc.latch(0);
  rtc.latch(1);

  equals(rtc.regs[3], 0xff);
  equals(rtc.regs[4], 0xc1);
});

test('writing values into registers', function() {
  rtc.current = 0x8;
  rtc.wb(0x22);
  equals(rtc.s, 0x22);
  equals(rtc.regs[0], 0x22);

  rtc.current = 0x9;
  rtc.wb(65);
  equals(rtc.m, 5);
  equals(rtc.regs[1], 5);

  rtc.current = 0xa;
  rtc.wb(25);
  equals(rtc.h, 1);
  equals(rtc.regs[2], 1);

  rtc.current = 0xb;
  rtc.wb(0xff);
  equals(rtc.d, 0xff);
  equals(rtc.regs[3], 0xff);

  rtc.d = 0x100;
  rtc.wb(0xae);
  equals(rtc.d, 0x1ae);
  equals(rtc.regs[3], 0xae);

  rtc.current = 0xc;
  rtc.wb(0xc1);
  equals(rtc.d & 0x100, 0x100);
  equals(rtc.carry, 1);
  equals(rtc.stop, 1);

  rtc.wb(0x80);
  equals(rtc.d & 0x100, 0);
  equals(rtc.carry, 1);
  equals(rtc.stop, 0);
});
