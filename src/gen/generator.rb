# For a list of instructions, see:
#   http://nocash.emubase.de/pandocs.htm#cpuinstructionset

require 'active_support/core_ext/string/strip'

regs = %w(b c d e h l a)

hl = "(r.h << 8) | r.l"
bc = "(r.b << 8) | r.c"
de = "(r.d << 8) | r.e"
af = "(r.a << 8) | r.f"

Z = 0x80
N = 0x40
H = 0x20
C = 0x10

pairs = {'hl' => hl, 'bc' => bc, 'de' => de, 'af' => af}

hlpp = "r.l = (r.l + 1) & 0xff; if (!r.l) r.h = (r.h + 1) & 0xff"        # hl++
hlmm = "r.l = (r.l - 1) & 0xff; if (r.l == 0xff) r.h = (r.h - 1) & 0xff" # hl--

@out = STDOUT

def section desc
  @out.puts "// #{desc}"
  yield
  @out.puts
end

section '8 bit loading between registers' do
  regs.each{ |i|
    regs.each{ |j| 
      print "ld_#{i}#{j}: function(r){ "
      print "r.#{i} = r.#{j}; " if i != j
      @out.puts "r.m = 1; },"
    }
  }
end

section '8 bit loading immediate values' do
  regs.each{ |i|
    @out.puts "ld_#{i}n: function(r, m){ r.#{i} = m.rb(r.pc); r.pc++; r.m = 2; },"
  }
end

section '8 bit loading from HL' do
  regs.each{ |i|
    @out.puts "ld_#{i}hlm: function(r, m){ r.#{i} = m.rb(#{hl}); r.m = 2; },"
  }
end

section '8 bit writing to HL' do
  regs.each{ |i|
    @out.puts "ld_hlm#{i}: function(r, m){ m.wb(#{hl}, r.#{i}); r.m = 2; },"
  }
end

section 'Other loading commands' do
  @out.puts <<-JS.strip_heredoc
    ld_hlmn: function(r, m){ m.wb(#{hl}, m.rb(r.pc)); r.pc++; r.m = 3; },
    ld_abc: function(r, m){ r.a = m.rb(#{bc}); r.m = 2; },
    ld_ade: function(r, m){ r.a = m.rb(#{de}); r.m = 2; },
    ld_an: function(r, m){ r.a = m.rb(m.rw(r.pc)); r.pc += 2; r.m = 4; },

    ld_bca: function(r, m){ m.wb(#{bc}, r.a); r.m = 2; },
    ld_dea: function(r, m){ m.wb(#{de}, r.a); r.m = 2; },
    ld_na: function(r, m){ m.wb(m.rw(r.pc), r.a); r.pc += 2; r.m = 4; },
    ld_nsp: function(r, m){ m.ww(m.rw(r.pc), r.sp); r.pc += 2; r.m = 4; },

    ld_aIOn: function(r, m){ r.a = m.rb(0xff00 | m.rb(r.pc++)); r.m = 3; },
    ld_IOna: function(r, m){ m.wb(0xff00 | m.rb(r.pc++), r.a); r.m = 3; },
    ld_aIOc: function(r, m){ r.a = m.rb(0xff00 | r.c); r.m = 3; },
    ld_IOca: function(r, m){ m.wb(0xff00 | r.c, r.a); r.m = 3; },

    ldi_hlma: function(r, m){ m.wb(#{hl}, r.a); #{hlpp}; r.m = 2; },
    ldi_ahlm: function(r, m){ r.a = m.rb(#{hl}); #{hlpp}; r.m = 2; },
    ldd_hlma: function(r, m){ m.wb(#{hl}, r.a); #{hlmm}; r.m = 2; },
    ldd_ahlm: function(r, m){ r.a = m.rb(#{hl}); #{hlmm}; r.m = 2; },
  JS
end

section '16 bit loading commands' do
  %w(bc de hl).each do |p|
    u = p.bytes.to_a[0].chr
    l = p.bytes.to_a[1].chr
    @out.puts "ld_#{p}n: function(r, m){ r.#{l} = m.rb(r.pc++); " + 
      "r.#{u} = m.rb(r.pc++); r.m = 3; },"
  end
  @out.puts "ld_spn: function(r, m){ r.sp = m.rw(r.pc); r.pc += 2; r.m = 3; },"
  @out.puts "ld_sphl: function(r, m){ r.sp = #{hl}; r.m = 2; },"

  %w(bc de hl af).each do |p|
    u = p.bytes.to_a[0].chr
    l = p.bytes.to_a[1].chr
    @out.puts "push_#{p}: function(r, m){ m.wb(--r.sp, r.#{u}); " +
      "m.wb(--r.sp, r.#{l}); r.m = 4; },"
    @out.puts "pop_#{p}: function(r, m){ r.#{l} = m.rb(r.sp++); " +
      "r.#{u} = m.wb(r.sp++); r.m = 3; },"
  end
end

section '8 bit addition' do
  def add var, name, cycles
    @out.puts <<-JS.strip_heredoc
      add_a#{name}: function(r, m) {
        var i = r.a, j = #{var};
        r.a += j;
        r.f = r.a > 0xff ? #{C} : 0;
        r.a &= 0xff;
        if (!r.a) { r.f |= #{Z}; }
        if ((r.a ^ j ^ i) & 0x10) { r.f |= #{H}; }
        r.m = #{cycles};
      },
    JS
  end
  regs.each{ |i| add "r.#{i}", i, 1 }
  add "m.rb(#{hl})", 'hlm', 2
  add 'm.rb(r.pc++)', 'n', 2

  def adc var, name, cycles
    @out.puts <<-JS.strip_heredoc
      adc_a#{name}: function(r, m){
        var i = r.a, j = #{var};
        r.a += j + ((r.f & #{C}) >> 4);
        r.f = r.a > 0xff ? #{C} : 0;
        r.a &= 0xff;
        if (!r.a) r.f |= #{Z};
        if ((r.a ^ j ^ i) & 0x10) r.f |= #{H};
        r.m = #{cycles};
      },
    JS
  end
  regs.each{ |i| adc "r.#{i}", i, 1 }
  adc "m.rb(#{hl})", 'hlm', 2
  adc 'm.rb(r.pc++)', 'n', 2
end

section '8 bit subtraction' do
  def sub var, name, cycles
    @out.puts <<-JS.strip_heredoc
      sub_a#{name}: function(r, m){
        var a = r.a;
        var b = #{var};
        r.a -= b;
        r.f = #{N} | (r.a < 0 ? #{C} : 0);
        r.a &= 0xff;
        if (!r.a) r.f |= #{Z};
        if ((r.a ^ b ^ a) & 0x10) r.f |= #{H};
        r.m = #{cycles};
      },
    JS
  end
  regs.each{ |i| sub "r.#{i}", i, 1 }
  sub "m.rb(#{hl})", 'hlm', 2
  sub 'm.rb(r.pc++)', 'n', 2

  def sbc var, name, cycles
    @out.puts <<-JS.strip_heredoc
      sbc_a#{name}: function(r, m){
        var a = r.a;
        var b = #{var};
        r.a -= b + ((r.f & #{C}) >> 4);
        r.f = r.a > 0xff ? #{C} : 0;
        r.a &= 0xff;
        if (!r.a) r.f |= #{Z};
        if ((r.a ^ b ^ a) & 0x10) r.f |= #{H};
        r.m = #{cycles};
      },
    JS
  end
  regs.each{ |i| sbc "r.#{i}", i, 1 }
  sbc "m.rb(#{hl})", 'hlm', 2
  sbc 'm.rb(r.pc++)', 'n', 2
end

section '8 bit bit-ops' do
  def anda var, name, cycles
    @out.puts <<-JS.strip_heredoc
      and_a#{name}: function(r, m){
        #{var == 'r.a' ? '' : "r.a &= #{var};"}
        r.f = (r.a ? 0 : #{Z}) | #{H};
        r.m = #{cycles};
      },
    JS
  end
  regs.each{ |i| anda "r.#{i}", i, 1 }
  anda "m.rb(#{hl})", 'hlm', 2
  anda 'm.rb(r.pc++)', 'n', 2
  @out.puts

  def xora var, name, cycles
    @out.puts <<-JS.strip_heredoc
      xor_a#{name}: function(r, m){
        #{var == 'r.a' ? "r.a = 0; r.f = #{Z};" :
            "r.a ^= #{var}; r.f = r.a ? 0 : #{Z};"}
        r.m = #{cycles};
      },
    JS
  end
  regs.each{ |i| xora "r.#{i}", i, 1 }
  xora "m.rb(#{hl})", 'hlm', 2
  xora 'm.rb(r.pc++)', 'n', 2
  @out.puts

  def ora var, name, cycles
    @out.puts <<-JS.strip_heredoc
      or_a#{name}: function(r, m){
        #{var == 'r.a' ? '' : "r.a |= #{var};"}
        r.f = r.a ? 0 : #{Z};
        r.m = #{cycles};
      },
    JS
  end
  regs.each{ |i| ora "r.#{i}", i, 1 }
  ora "m.rb(#{hl})", 'hlm', 2
  ora 'm.rb(r.pc++)', 'n', 2
end

section '8 bit comparisons' do
  def cp var, name, cycles
    @out.puts <<-JS.strip_heredoc
      cp_a#{name}: function(r, m){
        var a = r.a;
        var b = #{var};
        var i = a - b;
        r.f = #{N} | (r.a < 0 ? #{C} : 0);
        i &= 0xff;
        if (!i) r.f |= #{Z};
        if ((a ^ b ^ i) & 0x10) r.f |= #{H};
        r.m = #{cycles};
      },
    JS
  end
  
  regs.each{ |i| cp "r.#{i}", i, 1 }
  cp "m.rb(#{hl})", 'hlm', 2
  cp 'm.rb(r.pc++)', 'n', 2
end

section '8 bit increments/decrements' do
  regs.each{ |i|
    @out.puts "inc_#{i}: function(r){ r.#{i} = (r.#{i} + 1) & 0xff; " + 
      "r.f = r.#{i} ? 0 : #{Z}; r.m = 1; },"
  }
  @out.puts "inc_hlm: function(r, m){ var hl = #{hl}, k = (m.rb(hl) + 1) & 0xff;" +
    " m.wb(hl, k); r.f = k ? 0 : #{Z}; r.m = 3; },"
  @out.puts

  regs.each{ |i|
    @out.puts "dec_#{i}: function(r){ r.#{i} = (r.#{i} - 1) & 0xff; " + 
      "r.f = (r.#{i} ? 0 : #{Z}) | #{N}; r.m = 1; },"
  }
  @out.puts "dec_hlm: function(r, m){ var hl = #{hl}, k = (m.rb(hl) - 1) & 0xff;" +
    " m.wb(hl, k); r.f = (k ? 0 : #{Z}) | #{N}; r.m = 3; },"
end

section 'Miscellaneous 8 bit arithmetic' do
  # WTF is this function?!
  @out.puts <<-JS.strip_heredoc
    daa: function(r, m) {
      var a = r.a;
      if ((r.f & #{H}) || ((r.a & 0xf) > 9)) r.a += 6;
      r.f &= 0xef;
      if ((r.f & #{H}) || (a > 0x99)) {
        r.a += 0x60;
        r.f |= #{C};
      }
      r.m = 1;
    },
  JS

  @out.puts "cpl: function(r){ r.a ^= 0xff; r.f = #{N} | #{C}; r.m = 1; },"
end

section '16 bit arithmetic' do
  def add_hl name, add_in, hl
    @out.puts <<-JS.strip_heredoc
      add_hl#{name}: function(r){
        var hl = (#{hl}) + (#{add_in});
        if (hl > 0xfff) r.f |= #{C}; else r.f &= #{~C & 0xff};
        r.l = hl & 0xff;
        r.h = (hl >> 8) & 0xff;
        r.m = 2;
      },
    JS
  end
  %w(hl bc de).each{ |p| add_hl p, pairs[p], hl }
  add_hl 'sp', 'r.sp', hl
  @out.puts

  %w(bc de hl).each{ |p|
    u, l = p.split('')
    
    @out.puts "inc_#{p}: function(r){ r.#{l} = (r.#{l} + 1) & 0xff; " +
      "if (!r.#{l}) r.#{u} = (r.#{u} + 1) & 0xff; r.m = 2; },"
    @out.puts "dec_#{p}: function(r){ r.#{l} = (r.#{l} - 1) & 0xff; " +
      "if (r.#{l} == 0xff) r.#{u} = (r.#{u} - 1) & 0xff; r.m = 2; },"
  }
  @out.puts 'inc_sp: function(r){ r.sp = (r.sp + 1) & 0xffff; r.m = 2; },'
  @out.puts 'dec_sp: function(r){ r.sp = (r.sp - 1) & 0xffff; r.m = 2; },'

  @out.puts <<-JS.strip_heredoc
    add_spn: function(r, m) {
      var i = m.rb(r.pc++);
      if (i > 127) i = ~i + 1;
      r.sp += i;
      r.m = 4;
    },
    
    ld_hlspn: function(r, m) {
      var i = m.rb(r.pc++);
      if (i > 127) i = ~i + 1;
      i += r.sp;
      r.h = (i >> 8) & 0xff;
      r.l = i & 0xff;
      r.m = 3;
    },
  JS
end

section 'Rotating left' do
  def rlc name, var, cy
    @out.puts <<-JS.strip_heredoc
      rlc#{name}: function(r, m) {
        var ci = (#{var} & 0x80) >> 7;
        #{var} = ((#{var} << 1) | ci) & 0xff;
        r.f = (#{var} ? 0 : #{Z}) | (ci << 4);
        r.m = #{cy};
      },
    JS
  end

  def rl name, var, cy
    @out.puts <<-JS.strip_heredoc
      rl#{name}: function(r, m) {
        var ci = (r.f & 0x10) >> 4;
        var co = (#{var} & 0x80) >> 3;
        #{var} = ((#{var} << 1) | ci) & 0xff;
        r.f = (#{var} ? 0 : #{Z}) | co;
        r.m = #{cy};
      },
    JS
  end
  
  rlc 'a', 'r.a', 1
  rl 'a', 'r.a', 1
  regs.each{ |r|
    rlc "_#{r}", "r.#{r}", 2
    rl "_#{r}", "r.#{r}", 2
  }
  @out.puts <<-JS.strip_heredoc
    rlc_hlm: function(r, m) {
      var hl = m.rb(#{hl});
      var ci = (hl & 0x80) >> 7;
      hl = ((hl << 1) | ci) & 0xff;
      m.wb(#{hl}, hl);
      r.f = (hl ? 0 : #{Z}) | (ci << 4);
      r.m = 4;
    },
  JS
  @out.puts <<-JS.strip_heredoc
    rl_hlm: function(r, m) {
      var hl = m.rb(#{hl});
      var ci = (r.f & 0x10) >> 4;
      var co = (hl & 0x80) >> 3;
      hl = ((hl << 1) | ci) & 0xff;
      m.wb(#{hl}, hl);
      r.f = (hl ? 0 : #{Z}) | co;
      r.m = 4;
    },
  JS
end

section 'Rotating right' do
  def rrc name, var, cy
    @out.puts <<-JS.strip_heredoc
      rrc#{name}: function(r, m) {
        var ci = (#{var} & 1) << 7;
        #{var} = (#{var} >> 1) | ci;
        r.f = (#{var} ? 0 : #{Z}) | (ci >> 3);
        r.m = #{cy};
      },
    JS
  end

  def rr name, var, cy
    @out.puts <<-JS.strip_heredoc
      rr#{name}: function(r, m) {
        var ci = (r.f & 0x10) << 3;
        var co = (#{var} & 1) << 4;
        #{var} = (#{var} >> 1) | ci;
        r.f = (#{var} ? 0 : #{Z}) | co;
        r.m = #{cy};
      },
    JS
  end
  
  rrc 'a', 'r.a', 1
  rr 'a', 'r.a', 1
  regs.each{ |r|
    rrc "_#{r}", "r.#{r}", 2
    rr "_#{r}", "r.#{r}", 2
  }
  @out.puts <<-JS.strip_heredoc
    rrc_hlm: function(r, m) {
      var hl = m.rb(#{hl});
      var ci = (hl & 1) << 7;
      hl = (hl >> 1) | ci;
      m.wb(#{hl}, hl);
      r.f = (hl ? 0 : #{Z}) | (ci >> 3);
      r.m = 4;
    },
  JS
  @out.puts <<-JS.strip_heredoc
    rr_hlm: function(r, m) {
      var hl = m.rb(#{hl});
      var ci = (r.f & 0x10) << 3;
      var co = (hl & 0x80) << 4;
      hl = (hl >> 1) | ci;
      m.wb(#{hl}, hl);
      r.f = (hl ? 0 : #{Z}) | co;
      r.m = 4;
    },
  JS
end

section 'Shifting arithmetically left' do
  regs.each do |reg|
    @out.puts <<-JS.strip_heredoc
      sla_#{reg}: function(r) {
        var co = (r.#{reg} & 0x80) >> 7;
        r.#{reg} = (r.#{reg} << 1) & 0xff;
        r.f = (r.#{reg} ? 0 : #{Z}) | co;
        r.m = 2;
      },
    JS
  end

  @out.puts <<-JS.strip_heredoc
    sla_hlm: function(r, m) {
      var hl = m.rb(#{hl});
      var co = (hl & 0x80) >> 7;
      hl = (hl << 1) & 0xff;
      m.wb(#{hl}, hl);
      r.f = (hl ? 0 : #{Z}) | co;
      r.m = 4;
    },
  JS
end

section 'Swapping' do
  regs.each do |reg|
    @out.puts <<-JS.strip_heredoc
      swap_#{reg}: function(r){
        var t = r.#{reg}; r.#{reg} = ((t & 0xf) << 4) | ((t & 0xf0) >> 4);
        r.f = t ? 0 : #{Z}; r.m = 2;
      },
    JS
  end

  @out.puts <<-JS.strip_heredoc
    swap_hlm: function(r, m){
      var t = m.rb(#{hl}); m.wb(#{hl}, ((t & 0xf) << 4) | ((t & 0xf0) >> 4));
      r.f = t ? 0 : #{Z}; r.m = 4;
    },
  JS
end

section 'Shifting arithmetically right' do
  regs.each do |reg|
    @out.puts <<-JS.strip_heredoc
      sra_#{reg}: function(r) {
        var co = (r.#{reg} & 1) << 3;
        r.#{reg} = (r.#{reg} >> 1) | (r.#{reg} & 0x80);
        r.f = (r.#{reg} ? 0 : #{Z}) | co;
        r.m = 2;
      },
    JS
  end

  @out.puts <<-JS.strip_heredoc
    sra_hlm: function(r, m) {
      var hl = m.rb(#{hl});
      var co = (hl & 1) << 3;
      hl = (hl >> 1) | (hl & 0x80);
      m.wb(#{hl}, hl);
      r.f = (hl ? 0 : #{Z}) | co;
      r.m = 4;
    },
  JS
end

section 'Shifting logically right' do
  regs.each do |reg|
    @out.puts <<-JS.strip_heredoc
      srl_#{reg}: function(r) {
        var co = (r.#{reg} & 1) << 3;
        r.#{reg} >>= 1;
        r.f = (r.#{reg} ? 0 : #{Z}) | co;
        r.m = 2;
      },
    JS
  end

  @out.puts <<-JS.strip_heredoc
    srl_hlm: function(r, m) {
      var hl = m.rb(#{hl});
      var co = (hl & 1) << 3;
      hl >>= 1;
      m.wb(#{hl}, hl);
      r.f = (hl ? 0 : #{Z}) | co;
      r.m = 2;
    },
  JS
end

section 'Bit checking' do
  def bitcmp pos, name, reader, cy
    @out.puts "bit_#{pos}#{name}: function(r, m){ r.f = (r.f & 0x1f) | #{H} " +
    "| ((#{reader} & 0x#{(1 << pos).to_s(16)})" +
    "#{pos == 7 ? '' : " << #{7 - pos}"}); r.m = #{cy}; },"
  end

  (0..7).each do |pos|
    regs.each{ |reg| bitcmp pos, reg, "r.#{reg}", 2 }
    bitcmp pos, 'hlm', "m.rb(#{hl})", 3

    @out.puts
  end
end

section 'Bit setting/resetting' do
  (0..7).each do |pos|
    mask = '0x' + (1 << pos).to_s(16)
    regs.each{ |reg|
      @out.puts "set_#{pos}#{reg}: function(r){ r.#{reg} |= #{mask}; " +
        "r.m = 2; },"
    }
    @out.puts "set_#{pos}hlm: function(r, m){ m.wb(#{hl}, m.rb(#{hl}) | " +
      " #{mask}); r.m = 4; },"

    @out.puts
  end

  (0..7).each do |pos|
    mask = '0x' + (~(1 << pos) & 0xff).to_s(16)
    regs.each{ |reg|
      @out.puts "res_#{pos}#{reg}: function(r){ r.#{reg} &= #{mask};" +
        " r.m = 2; },"
    }
    @out.puts "res_#{pos}hlm: function(r, m){ m.wb(#{hl}, m.rb(#{hl}) &" +
      " #{mask}); r.m = 4; },"

    @out.puts
  end
end

section 'CPU control commands' do
  @out.puts <<-JS.strip_heredoc
    ccf: function(r){ r.f = r.f & 0x8f & ((r.f & #{C}) ^ #{C}); r.m = 1; },
    scf: function(r){ r.f = (r.f & 0x8f) | #{C}; r.m = 1; },
    nop: function(r){ r.m = 1; },
    halt: function(r){ r.halt = 1; r.m = 1; },
    stop: function(r){ r.stop = 1; r.m = 1; },
    di: function(r){ r.ime = 0; r.m = 1; },
    ei: function(r){ r.ime = 1; r.m = 1; },
  JS
end

section 'Jump commands' do
  @out.puts <<-JS.strip_heredoc
    jp_n: function(r, m){ r.pc = m.rw(r.pc); r.m = 4; },
    jp_hl: function(r, m){ r.pc = #{hl}; r.m = 1; },
  JS

  def jp_n name, cond
    @out.puts "jp_#{name}_n: function(r, m){ " +
      "if (#{cond}) { r.pc = m.rw(r.pc); r.m = 4; } " +
      "else { r.pc += 2; r.m = 3; } },"
  end
  
  jp_n 'nz', "!(r.f & #{Z})"
  jp_n 'z', "r.f & #{Z}"
  jp_n 'nc', "!(r.f & #{C})"
  jp_n 'c', "r.f & #{C}"

  @do_jr = "var i = m.rb(r.pc++); if (i > 127) i = ~i + 1; r.pc += i; r.m = 3;"
  @out.puts "\njr_n: function(r, m){ #{@do_jr} },"
  
  def jr_n name, cond
    @out.puts "jr_#{name}_n: function(r, m){ " +
      "if (#{cond}) { #{@do_jr} } " +
      "else { r.pc++; r.m = 2; } },"
  end

  jr_n 'nz', "!(r.f & #{Z})"
  jr_n 'z', "r.f & #{Z}"
  jr_n 'nc', "!(r.f & #{C})"
  jr_n 'c', "r.f & #{C}"
end

section 'Call/return commands' do
  @do_call = "r.sp -= 2; m.ww(r.sp, r.pc + 2); r.pc = m.rw(r.pc); r.m = 6;"
  @out.puts "call_n: function(r, m){ #{@do_call} },"

  def call_f_n name, cond
    @out.puts "call_#{name}_n: function(r, m){ if (#{cond}) { #{@do_call} } " +
      "else { r.m = 3; r.pc += 2; } },"
  end

  call_f_n 'nz', "!(r.f & #{Z})"
  call_f_n 'z', "r.f & #{Z}"
  call_f_n 'nc', "!(r.f & #{C})"
  call_f_n 'c', "r.f & #{C}"

  @do_ret = "r.pc = m.rw(r.sp); r.sp += 2;"
  @out.puts "\nret: function(r, m){ #{@do_ret} r.m = 4; },"

  def ret_f name, cond
    @out.puts "ret_#{name}: function(r, m){ " +
      "if (#{cond}) { #{@do_ret} r.m = 5; } else { r.m = 2; } },"
  end

  ret_f 'nz', "!(r.f & #{Z})"
  ret_f 'z', "r.f & #{Z}"
  ret_f 'nc', "!(r.f & #{C})"
  ret_f 'c', "r.f & #{C}"

  @out.puts "\nreti: function(r, m){ r.ime = 1; r.restore(); #{@do_ret} " +
    "r.m = 4; },"
end

section 'Resetting' do
  %w(00 08 10 18 20 28 30 38 40 48 50 58 60).each do |code|
    @out.puts "rst_#{code}: function(r, m){ r.save(); r.sp -= 2; " +
      "m.ww(r.sp, r.pc); r.pc = 0x#{code}; r.m = 4; },"
  end
end
