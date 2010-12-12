module('Instructions', {
  setup: function() {
    window.reg = new JBA.Registers();
    window.mem = new JBA.Memory();
    window.inst = new JBA.Instructions(reg, mem);
  },

  teardown: function() {
    delete window.inst;
    delete window.mem;
    delete window.reg;
  }
});

function pc_change(amount, callback) {
  var old_counter = reg.program_counter;
  callback();
  equals(reg.program_counter, old_counter + amount,
    'Changes the program counter by ' + amount);
}

test('nop', function() {
  pc_change(1, function(){ inst.nop(); });
});

test('ld r1 <- r2', function() {
  // Generic register to register
  pc_change(1, function() {
    reg.set(JBA.Reg.A, 0x02);
    reg.set(JBA.Reg.B, 0x04);
    inst.ld_r1_r2(JBA.Reg.A, JBA.Reg.B);
    equals(reg.get(JBA.Reg.A), 0x04);
  });

  // Second register is c_HL
  pc_change(1, function() {
    mem.write(0x8098, 0x76);
    reg.set(JBA.Reg.HL, 0x8098);
    inst.ld_r1_r2(JBA.Reg.A, JBA.Reg.c_HL);
    equals(reg.get(JBA.Reg.A), 0x76);
  });

  // First register is c_HL
  pc_change(1, function() {
    inst.ld_r1_r2(JBA.Reg.c_HL, JBA.Reg.B);
    equals(mem.read(0x8098), 0x4);
  });

  // First register is c_HL, second is $
  reg.program_counter = 0x9013;
  pc_change(2, function() {
    mem.write(reg.program_counter + 1, 0x31);
    inst.ld_r1_r2(JBA.Reg.c_HL, JBA.Reg.$);
    equals(mem.read(0x8098), 0x31);
  });
});

test('ld A <- n', function() {
  // Loading an arbitrary register
  pc_change(1, function() {
    reg.set(JBA.Reg.B, 0x32);
    inst.ld_A_n(JBA.Reg.B);
    equals(reg.get(JBA.Reg.A), 0x32);
  });

  // Loading c_HL
  pc_change(1, function() {
    mem.write(0x8013, 0x31);
    reg.set(JBA.Reg.HL, 0x8013);
    inst.ld_A_n(JBA.Reg.c_HL);
    equals(reg.get(JBA.Reg.A), 0x31);
  });

  // Loading c_DE
  pc_change(1, function() {
    mem.write(0x8014, 0x30);
    reg.set(JBA.Reg.DE, 0x8014);
    inst.ld_A_n(JBA.Reg.c_DE);
    equals(reg.get(JBA.Reg.A), 0x30);
  });

  // Loading c_BC
  pc_change(1, function() {
    mem.write(0x8015, 0x29);
    reg.set(JBA.Reg.BC, 0x8015);
    inst.ld_A_n(JBA.Reg.c_BC);
    equals(reg.get(JBA.Reg.A), 0x29);
  });

  // Loading c_$$
  reg.program_counter = 0x9000;
  pc_change(3, function() {
    mem.write(0x9001, 0x29);
    mem.write(0x9002, 0x84);
    mem.write(0x8429, 0xae);
    inst.ld_A_n(JBA.Reg.c_$$);
    equals(reg.get(JBA.Reg.A), 0xae);
  });

  // Loading $
  reg.program_counter = 0x9000;
  pc_change(2, function() {
    inst.ld_A_n(JBA.Reg.$);
    equals(reg.get(JBA.Reg.A), 0x29);
  });
});

test('ld n <- A', function() {
  reg.set(JBA.Reg.A, 0x21);

  // Generic Loading
  pc_change(1, function() {
    inst.ld_n_A(JBA.Reg.C);
    equals(reg.get(JBA.Reg.C), 0x21);
  });

  // Load into c_HL
  pc_change(1, function() {
    reg.set(JBA.Reg.HL, 0x9000);
    inst.ld_n_A(JBA.Reg.c_HL);
    equals(mem.read(0x9000), 0x21);
  });

  // Load into c_BC
  pc_change(1, function() {
    reg.set(JBA.Reg.BC, 0x9001);
    inst.ld_n_A(JBA.Reg.c_BC);
    equals(mem.read(0x9001), 0x21);
  });

  // Load into c_DE
  pc_change(1, function() {
    reg.set(JBA.Reg.DE, 0x9002);
    inst.ld_n_A(JBA.Reg.c_DE);
    equals(mem.read(0x9002), 0x21);
  });

  // Load into c_$$
  reg.program_counter = 0x8000;
  pc_change(3, function() {
    mem.write(0x8001, 0x46);
    mem.write(0x8002, 0x80);
    inst.ld_n_A(JBA.Reg.c_$$);
    equals(mem.read(0x8046), 0x21);
  });
});

test('jp_nn', function() {
  mem.write(0x8001, 0x76);
  mem.write(0x8002, 0x32);
  reg.program_counter = 0x8000;
  inst.jp_nn();

  equals(reg.program_counter, 0x3276);
});

test('ldh A <- n', function() {
  reg.program_counter = 0x8000;

  pc_change(2, function() {
    mem.write(0x8001, 0x29);
    mem.write(0xff29, 0x32);
    inst.ldh_A_n();

    equals(reg.get(JBA.Reg.A), 0x32);
  });
});

test('ldh c$ <- A', function() {
  reg.program_counter = 0x8000;
  pc_change(2, function() {
    mem.write(0x8001, 0x29);
    reg.set(JBA.Reg.A, 0x32);
    inst.ldh_c$_A();

    equals(mem.read(0xff29), 0x32);
  });
});

test('ccf', function() {
  pc_change(1, function() {
    reg.set_flag(JBA.Reg.f_C, 1);
    inst.ccf();

    equals(reg.get_flag(JBA.Reg.f_N), 0);
    equals(reg.get_flag(JBA.Reg.f_N), 0);
    equals(reg.get_flag(JBA.Reg.f_C), 0);
  });

  reg.set_flag(JBA.Reg.f_C, 0);
  inst.ccf();
  equals(reg.get_flag(JBA.Reg.f_C), 1);
});

test('cp n', function() {
  reg.set(JBA.Reg.A, 0x20);

  // Comparing with other register
  pc_change(1, function() {
    reg.set(JBA.Reg.B, 0x19);
    inst.cp_n(JBA.Reg.B);

    equal(reg.get_flag(JBA.Reg.f_Z), 0);
    equal(reg.get_flag(JBA.Reg.f_N), 1);
    equal(reg.get_flag(JBA.Reg.f_H), 1);
    equal(reg.get_flag(JBA.Reg.f_C), 0);
  });

  // Comparing with c_HL
  pc_change(1, function() {
    reg.set(JBA.Reg.HL, 0x8080);
    mem.write(0x8080, 0x21);
    inst.cp_n(JBA.Reg.c_HL);

    equal(reg.get_flag(JBA.Reg.f_Z), 0);
    equal(reg.get_flag(JBA.Reg.f_N), 1);
    equal(reg.get_flag(JBA.Reg.f_H), 1);
    equal(reg.get_flag(JBA.Reg.f_C), 1);
  });

  // Comparing with $
  reg.program_counter = 0x807f;
  pc_change(2, function() {
    mem.write(0x8080, 0x20);
    inst.cp_n(JBA.Reg.$);

    equal(reg.get_flag(JBA.Reg.f_Z), 1);
    equal(reg.get_flag(JBA.Reg.f_N), 1);
    equal(reg.get_flag(JBA.Reg.f_H), 0);
    equal(reg.get_flag(JBA.Reg.f_C), 0);
  });
});

test('cpl', function() {
  pc_change(1, function() {
    reg.set(JBA.Reg.A, 0x77);
    inst.cpl();

    equal(reg.get(JBA.Reg.A), 0x88);
    equal(reg.get_flag(JBA.Reg.f_N), 1);
    equal(reg.get_flag(JBA.Reg.f_H), 1);
  });

  pc_change(1, function() {
    reg.set(JBA.Reg.A, 0x34);
    inst.cpl();

    equal(reg.get(JBA.Reg.A), 0xcb);
    equal(reg.get_flag(JBA.Reg.f_N), 1);
    equal(reg.get_flag(JBA.Reg.f_H), 1);
  });
});

test('ld n <- nn', function() {
  mem.write(0x8001, 0xad);
  mem.write(0x8002, 0xde);

  reg.program_counter = 0x8000;
  pc_change(3, function() {
    inst.ld_n_nn(JBA.Reg.DE);

    equals(reg.get(JBA.Reg.DE), 0xdead);
  });

  reg.program_counter = 0x8000;
  pc_change(3, function() {
    inst.ld_n_nn(JBA.Reg.SP);

    equals(reg.get(JBA.Reg.DE), 0xdead);
  });

  raises(function(){ inst.ld_n_nn(JBA.Reg.A); });
  raises(function(){ inst.ld_n_nn(JBA.Reg.AF); });
});

test('ld nn <- SP', function() {
  mem.write(0x8001, 0x00);
  mem.write(0x8002, 0x85);

  reg.program_counter = 0x8000;
  pc_change(3, function() {
    reg.stack_pointer = 0x9067;
    inst.ld_nn_SP();

    equals(mem.read(0x8500), 0x67);
    equals(mem.read(0x8501), 0x90);
  });
});

test('jr', function() {
  mem.write(0x8001, 0x33);
  reg.program_counter = 0x8000;

  pc_change(0x35, function(){ inst.jr(); });
});

test('jr cc n (conditional jump)', function() {
  mem.write(0x8001, 0x33);
  reg.set_flag(JBA.Reg.f_Z, 1);
  reg.set_flag(JBA.Reg.f_N, 0);

  reg.program_counter = 0x8000;
  pc_change(0x35, function(){
    inst.jr_CC_n(JBA.Reg.f_Z, 1);
  });

  reg.program_counter = 0x8000;
  pc_change(2, function(){
    inst.jr_CC_n(JBA.Reg.f_Z, 0);
  });

  reg.program_counter = 0x8000;
  pc_change(0x35, function(){
    inst.jr_CC_n(JBA.Reg.f_N, 0);
  });

  reg.program_counter = 0x8000;
  pc_change(2, function(){
    inst.jr_CC_n(JBA.Reg.f_N, 1);
  });
});

test('call nn', function() {
  reg.program_counter = 0x8000;
  mem.write(0x8001, 0x89);
  mem.write(0x8002, 0x90);
  reg.stack_pointer = 0x8079;

  inst.call_nn();

  equals(reg.program_counter, 0x9089);
  equals(mem.read(0x8078), 0x80);
  equals(mem.read(0x8077), 0x03);
});

test('call cc nn (conditional call) making the jump', function() {
  reg.program_counter = 0x8000;
  mem.write(0x8001, 0x89);
  mem.write(0x8002, 0x90);
  reg.stack_pointer = 0x8079;

  reg.set_flag(JBA.Reg.f_Z, 1);
  inst.call_cc_nn(JBA.Reg.f_Z, 1);

  equals(reg.program_counter, 0x9089);
  equals(mem.read(0x8078), 0x80);
  equals(mem.read(0x8077), 0x03);
});

test('call cc nn (conditional call) not making the jump', function() {
  reg.program_counter = 0x8000;
  mem.write(0x8001, 0x89);
  mem.write(0x8002, 0x90);
  reg.stack_pointer = 0x8079;

  pc_change(3, function() {
    reg.set_flag(JBA.Reg.f_Z, 1);
    inst.call_cc_nn(JBA.Reg.f_Z, 0);
  });
});

test('ldi_A_cHL', function() {
  pc_change(1, function() {
    reg.set(JBA.Reg.HL, 0x8002);
    mem.write(0x8002, 0x92);

    inst.ldi_A_cHL();

    equals(reg.get(JBA.Reg.HL), 0x8003);
    equals(reg.get(JBA.Reg.A), 0x92);
  });
});

test('ldi_cHL_A', function() {
  pc_change(1, function() {
    reg.set(JBA.Reg.HL, 0x8002);
    reg.set(JBA.Reg.A, 0x92);

    inst.ldi_cHL_A();

    equals(reg.get(JBA.Reg.HL), 0x8003);
    equals(mem.read(0x8002), 0x92);
  });
});

test('ldd_A_cHL', function() {
  pc_change(1, function() {
    reg.set(JBA.Reg.HL, 0x8002);
    mem.write(0x8002, 0x92);

    inst.ldd_A_cHL();

    equals(reg.get(JBA.Reg.HL), 0x8001);
    equals(reg.get(JBA.Reg.A), 0x92);
  });
});

test('ldd_cHL_A', function() {
  pc_change(1, function() {
    reg.set(JBA.Reg.HL, 0x8002);
    reg.set(JBA.Reg.A, 0x92);

    inst.ldd_cHL_A();

    equals(reg.get(JBA.Reg.HL), 0x8001);
    equals(mem.read(0x8002), 0x92);
  });
});

test('ld SP <- HL', function() {
  pc_change(1, function() {
    reg.set(JBA.Reg.HL, 0x8318);
    inst.ld_SP_HL();

    equals(reg.stack_pointer, 0x8318);
  });
});
