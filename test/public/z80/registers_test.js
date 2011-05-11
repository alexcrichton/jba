module('Z80 - Registers');

test('initialized values', function() {
  var reg = new Z80.Registers();

  equals(reg.a, 0x01);
  equals(reg.f, 0xb0);
  equals(reg.b, 0x00);
  equals(reg.c, 0x13);
  equals(reg.d, 0x00);
  equals(reg.e, 0xd8);
  equals(reg.h, 0x01);
  equals(reg.l, 0x4d);

  equals(reg.pc, 0x100);
  equals(reg.sp, 0xfffe);
});
