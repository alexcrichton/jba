var Z = 0x80, N = 0x40, H = 0x20, C = 0x10;

module('Z80 - Instructions', {
  setup: function() {
    var cpu = new JBA.CPU();
    var arr = new Array(0xffff);
    window.reg = cpu.registers;
    window.cpu = cpu;
    window.mem = {
      rb: function(addr) { return arr[addr]; },
      rw: function(addr) { return this.rb(addr) + (this.rb(addr + 1) << 8); },
      wb: function(addr, val) { arr[addr] = val; },
      ww: function(addr, val) {
        this.wb(addr, val & 0xff); this.wb(addr + 1, (val >> 8) & 0xff);
      }
    };
    cpu.memory = window.mem;
  },

  teardown: function() {
    delete window.mem;
    delete window.reg;
  }
});

function opcode_test(opcode, pc_diff, cycles, callback) {
  var prev = reg.pc;
  mem.wb(reg.pc, opcode);
  var ret = cpu.exec();
  callback();
  equals(reg.pc - prev, pc_diff, "Program counter changed by " + pc_diff);
  equals(ret, 4 * cycles, "Cycles taken by instruction: " + (4 * cycles));
}

function stub_next_word(val) {
  mem.ww(reg.pc + 1, val);
}

function stub_next_byte(val) {
  mem.wb(reg.pc + 1, val);
}

/******************************************************************************/
/**   0x00                                                                    */
/******************************************************************************/
test('nop', function() {
  // Just making sure the pc changed by 1
  opcode_test(0x00, 1, 1, function(){});
});

test('ld BC, nn', function() {
  stub_next_word(0xf892);

  opcode_test(0x01, 3, 3, function() {
    equals(reg.b, 0xf8);
    equals(reg.c, 0x92);
  });
});

test('ld (BC), A', function() {
  reg.a = 0xf3;
  reg.b = 0x42;
  reg.c = 0x02;

  opcode_test(0x02, 1, 2, function() {
    equals(mem.rb(0x4202), 0xf3);
  });
});

test('inc BC', function() {
  reg.b = 0x33;
  reg.c = 0x48;

  opcode_test(0x03, 1, 2, function() {
    equals(reg.b, 0x33);
    equals(reg.c, 0x49);
  });
});

test('inc B', function() {
  // Generic incrementing
  // reg.b = 0x33;
  // reg.f = 0x10;
  // opcode_test(0x04, 1, 1, function() {
  //   equals(reg.b, 0x34);
  //   equals(reg.f, 0x10);
  // });

  // Low 4 bits carry
  // reg.b = 0x3f;
  // reg.f = 0x10;
  // opcode_test(0x04, 1, 1, function() {
  //   equals(reg.f, 0x30);
  // });

  // Zero Flag
  reg.b = 0xff;
  reg.f = 0x00;
  opcode_test(0x04, 1, 1, function() {
    equals(reg.b, 0x00);
    // equals(reg.f, 0xa0);
  });
});

test('dec B', function() {
  // Generic decrementing
  reg.b = 0x33;
  reg.f = 0x10;
  opcode_test(0x05, 1, 1, function() {
    equals(reg.b, 0x32);
    equals(reg.f, 0x50);
  });

  // Low 4 bits carry
  reg.b = 0x30;
  reg.f = 0x10;
  opcode_test(0x05, 1, 1, function() {
    equals(reg.b, 0x2f);
    equals(reg.f, 0x70);
  });

  // Zero flag
  reg.b = 0x01;
  reg.f = 0x00;
  opcode_test(0x05, 1, 1, function() {
    equals(reg.b, 0x00);
    equals(reg.f, 0xc0);
  });

  // Wrap around
  reg.b = 0x00;
  reg.f = 0x10;
  opcode_test(0x05, 1, 1, function() {
    equals(reg.b, 0xff);
    equals(reg.f, 0x70);
  });
});

test('ld B, n', function() {
  stub_next_byte(0x36);

  opcode_test(0x06, 2, 2, function() { equals(reg.b, 0x36); });
});

test('rlca', function() {
  reg.a = 0x01;
  opcode_test(0x07, 1, 1, function() {
    equals(reg.a, 0x02);
    equals(reg.f, 0x00);
  });

  reg.a = 0x8f;
  opcode_test(0x07, 1, 1, function() {
    equals(reg.a, 0x1f);
    equals(reg.f, 0x10);
  });
});

test('ld (n), SP', function() {
  stub_next_word(0xf0f0);
  reg.sp = 0x7893;

  opcode_test(0x08, 3, 4, function() {
    equals(mem.rw(0xf0f0), 0x7893);
  });
});

test('add HL, BC', function() {
  reg.b = 0xf0;
  reg.c = 0xe0;
  reg.h = 0x87;
  reg.l = 0x10;
  reg.f = 0;

  // Carry, no half carry
  opcode_test(0x09, 1, 2, function() {
    equals(reg.l, 0xf0);
    equals(reg.h, 0x77);
    equals(reg.f, 0x10);
  });
});

test('ld A, (BC)', function() {
  reg.b = 0x78;
  reg.c = 0x80;
  mem.wb(0x7880, 0x93);

  opcode_test(0x0a, 1, 2, function() {
    equals(reg.a, 0x93);
  });
});

test('dec BC', function() {
  // Generic decrementing
  reg.b = 0x20;
  reg.c = 0x33;
  opcode_test(0x0b, 1, 2, function() {
    equals(reg.c, 0x32);
    equals(reg.b, 0x20);
  });

  // Wrap around
  reg.b = 0x01;
  reg.c = 0x00;
  opcode_test(0x0b, 1, 2, function() {
    equals(reg.b, 0x00);
    equals(reg.c, 0xff);
  });

  // Total wrap
  reg.b = 0x00;
  reg.c = 0x00;
  opcode_test(0x0b, 1, 2, function() {
    equals(reg.b, 0xff);
    equals(reg.c, 0xff);
  });
});

// test('inc C', function(){ });

// test('dec C', function(){ });

test('ld C, n', function() {
  stub_next_byte(0x20);
  opcode_test(0x0e, 2, 2, function() { equals(reg.c, 0x20); });
});

test('rrca', function() {
  reg.a = 0x02;
  reg.f = 0;
  opcode_test(0x0f, 1, 1, function() {
    equals(reg.a, 0x01);
    equals(reg.f, 0x00);
  });

  reg.a = 0x01;
  opcode_test(0x0f, 1, 1, function() {
    equals(reg.a, 0x80);
    equals(reg.f, 0x10);
  });
});

/******************************************************************************/
/**   0x10                                                                    */
/******************************************************************************/
test('ld DE, nn', function() {
  stub_next_word(0x8739);
  opcode_test(0x11, 3, 3, function() {
    equals(reg.d, 0x87);
    equals(reg.e, 0x39);
  });
});

test('ld (DE), A', function() {
  reg.a = 0x22;
  reg.d = 0x39;
  reg.e = 0x88;
  opcode_test(0x12, 1, 2, function() {
    equals(mem.rb(0x3988), 0x22);
  });
});

// test('inc DE', function() { });

// test('inc D', function() { });

// test('dec D', function() { });

// test('ld D, n', function() { });

test('rla', function() {
  reg.a = 0x01;
  reg.f = 0x10;
  opcode_test(0x17, 1, 1, function() {
    equals(reg.a, 0x03);
    equals(reg.f, 0x00);
  });

  reg.a = 0x8f;
  opcode_test(0x17, 1, 1, function() {
    equals(reg.a, 0x1e);
    equals(reg.f, 0x10);
  });
});

test('jr n', function() {
  /* This instruction is 2 bytes wide, so if we jump two bytes back, we should
     not change the PC at all */
  stub_next_byte(0xfe); // -2
  opcode_test(0x18, 0, 3, function() {});

  /* 2 byte instruction + jr of 2 bytes = total offset of 4 bytes */
  stub_next_byte(0x02);
  opcode_test(0x18, 4, 3, function() {});
});

/******************************************************************************/
/**   0x30                                                                    */
/******************************************************************************/

test('ld a, n', function() {
  reg.a = 0x01;
  stub_next_byte(0x20);
  opcode_test(0x3e, 2, 2, function() {
    equals(reg.a, 0x20);
  });
});

test('scf', function() {
  reg.f = 0x10;
  opcode_test(0x37, 1, 1, function() { equals(reg.f, 0x10); });

  reg.f = 0x60;
  opcode_test(0x37, 1, 1, function() { equals(reg.f, 0x10); });

  reg.f = 0x80;
  opcode_test(0x37, 1, 1, function() { equals(reg.f, 0x90); });
});

test('ccf', function() {
  reg.f = 0x10;
  opcode_test(0x3f, 1, 1, function() { equals(reg.f, 0x00); });

  reg.f = 0x60;
  opcode_test(0x3f, 1, 1, function() { equals(reg.f, 0x10); });

  reg.f = 0x80;
  opcode_test(0x3f, 1, 1, function() { equals(reg.f, 0x90); });
});

/******************************************************************************/
/**   0xb0                                                                    */
/******************************************************************************/
test('cp b', function() {
  // zero flag
  reg.a = 0x1;
  reg.b = 0x1;
  opcode_test(0xb8, 1, 1, function() {
    equals(reg.f, Z | N);
  });

  // no flags other than N
  reg.a = 0x2;
  reg.b = 0x1;
  opcode_test(0xb8, 1, 1, function() {
    equals(reg.f, N);
  });

  // H and C flags
  reg.a = 0x0;
  reg.b = 0x1;
  opcode_test(0xb8, 1, 1, function() {
    equals(reg.f, N | H | C);
  });

  // just carry flag
  reg.a = 0x00;
  reg.b = 0x10;
  opcode_test(0xb8, 1, 1, function() {
    equals(reg.f, N | C);
  });
});

/******************************************************************************/
/**   0xc0                                                                    */
/******************************************************************************/

test('pop bc', function() {
  reg.b = 0x01;
  reg.c = 0x01;
  reg.sp = 0x1111;
  mem.ww(0x1111, 0x1234);
  opcode_test(0xc1, 1, 3, function() {
    equals(reg.b, 0x12);
    equals(reg.c, 0x34);
    equals(reg.sp, 0x1113);
  });
});

test('rlc b', function() {
  // Regular shift
  reg.b = 0x01;
  stub_next_byte(0x00);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.b, 0x02);
    equals(reg.f, 0x00);
  });

  // Zero flag
  reg.b = 0x00;
  stub_next_byte(0x00);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.b, 0x00);
    equals(reg.f, 0x80);
  });

  // Carry flag
  reg.b = 0x81;
  stub_next_byte(0x00);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.b, 0x03);
    equals(reg.f, 0x10);
  });
});

test('rl b', function() {
  // Regular shift
  reg.b = 0x01;
  reg.f = 0x00;
  stub_next_byte(0x10);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.b, 0x02);
    equals(reg.f, 0x00);
  });

  // Zero flag
  reg.b = 0x00;
  stub_next_byte(0x10);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.b, 0x00);
    equals(reg.f, 0x80);
  });

  // Carry flag
  reg.b = 0x81;
  reg.f = 0;
  stub_next_byte(0x10);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.b, 0x02);
    equals(reg.f, 0x10);
  });
  reg.b = 0x81;
  reg.f = 0x10;
  stub_next_byte(0x10);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.b, 0x03);
    equals(reg.f, 0x10);
  });
});

test('sla e', function() {
  // Regular shift
  reg.e = 0x01;
  stub_next_byte(0x23);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.e, 0x02);
    equals(reg.f, 0x00);
  });

  // Zero flag
  reg.e = 0x00;
  stub_next_byte(0x23);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.e, 0x00);
    equals(reg.f, 0x80);
  });

  // Carry flag
  reg.e = 0x81;
  stub_next_byte(0x23);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.e, 0x02);
    equals(reg.f, 0x10);
  });
});

test('sra a', function() {
  reg.a = 0x81;
  stub_next_byte(0x2f);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.a, 0xc0);
    equals(reg.f, 0x10);
  });

  reg.a = 0x00;
  stub_next_byte(0x2f);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.a, 0x00);
    equals(reg.f, 0x80);
  });
});

test('srl a', function() {
  reg.a = 0x81;
  stub_next_byte(0x3f);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.a, 0x40);
    equals(reg.f, 0x10);
  });

  reg.a = 0x00;
  stub_next_byte(0x3f);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.a, 0x00);
    equals(reg.f, 0x80);
  });
});

test('bit 0, b', function() {
  reg.b = 0x01;
  reg.f = 0;
  stub_next_byte(0x40);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.f, 0x20);
  });

  reg.b = 0x00;
  reg.f = 0x10;
  stub_next_byte(0x40);
  opcode_test(0xcb, 2, 2, function() {
    equals(reg.f, 0xb0);
  });
});

/******************************************************************************/
/**   0x80                                                                    */
/******************************************************************************/

test('add a, b', function() {
  reg.a = 0x02;
  reg.b = 0x01;
  reg.f = Z | N | H | C;
  opcode_test(0x80, 1, 1, function() {
    equals(reg.a, 0x3);
    equals(reg.f, 0); // all flags cleared
  });

  // half carry
  reg.a = 0x0f;
  reg.b = 0x01;
  opcode_test(0x80, 1, 1, function() {
    equals(reg.a, 0x10);
    equals(reg.f & H, H);
  });

  // carry, zero
  reg.a = 0xf0;
  reg.b = 0x10;
  opcode_test(0x80, 1, 1, function() {
    equals(reg.a, 0x00);
    equals(reg.f & C, C);
    equals(reg.f & Z, Z);
  });
});

test('adc a, b', function() {
  reg.a = 0x02;
  reg.b = 0x01;
  reg.f = Z | N | H | C;
  opcode_test(0x88, 1, 1, function() {
    equals(reg.a, 0x4); // C carried through
    equals(reg.f, 0); // all flags cleared
  });

  // half carry
  reg.a = 0x0f;
  reg.b = 0x01;
  opcode_test(0x80, 1, 1, function() {
    equals(reg.a, 0x10);
    equals(reg.f, H);
  });

  // carry, zero
  reg.a = 0xf0;
  reg.b = 0x10;
  opcode_test(0x80, 1, 1, function() {
    equals(reg.a, 0x00);
    equals(reg.f, C | Z);
  });
});

/******************************************************************************/
/**   0x90                                                                    */
/******************************************************************************/

test('sub a, b', function() {
  reg.a = 0x02;
  reg.b = 0x01;
  reg.f = Z | N | H | C;
  opcode_test(0x90, 1, 1, function() {
    equals(reg.a, 0x1);
    equals(reg.f, N); // all flags cleared
  });

  // half carry
  reg.a = 0xf1;
  reg.b = 0x02;
  opcode_test(0x90, 1, 1, function() {
    equals(reg.a, 0xef);
    equals(reg.f, N | H);
  });

  // zero
  reg.a = 0x10;
  reg.b = 0x10;
  opcode_test(0x90, 1, 1, function() {
    equals(reg.a, 0x00);
    equals(reg.f, N | Z);
  });

  // carry
  reg.a = 0x10;
  reg.b = 0x20;
  opcode_test(0x90, 1, 1, function() {
    equals(reg.a, 0xf0);
    equals(reg.f, N | C);
  });
});

test('sbc a, b', function() {
  reg.a = 0x02;
  reg.b = 0x01;
  reg.f = Z | N | H | C;
  opcode_test(0x98, 1, 1, function() {
    equals(reg.a, 0x0); // carry flag also subtracted
    equals(reg.f, N | Z); // all flags cleared
  });

  // half carry
  reg.a = 0xf1;
  reg.b = 0x02;
  opcode_test(0x98, 1, 1, function() {
    equals(reg.a, 0xef);
    equals(reg.f, N | H);
  });

  // zero
  reg.a = 0x10;
  reg.b = 0x10;
  opcode_test(0x98, 1, 1, function() {
    equals(reg.a, 0x00);
    equals(reg.f, N | Z);
  });

  // carry
  reg.a = 0x10;
  reg.b = 0x20;
  opcode_test(0x98, 1, 1, function() {
    equals(reg.a, 0xf0);
    equals(reg.f, N | C);
  });
});

/******************************************************************************/
/**   0xe0                                                                    */
/******************************************************************************/

test('ld (nn), a', function() {
  reg.a = 0x01;
  stub_next_word(0x2020);
  mem.wb(0x2020, 0x02);

  opcode_test(0xea, 3, 4, function() {
    equals(mem.rb(0x2020), 0x01);
  });
});

/******************************************************************************/
/**   0xf0                                                                    */
/******************************************************************************/

test('ld a, (nn)', function() {
  reg.a = 0x01;
  stub_next_word(0x2020);
  mem.wb(0x2020, 0x44);

  opcode_test(0xfa, 3, 4, function() {
    equals(reg.a, 0x44);
  });
});
