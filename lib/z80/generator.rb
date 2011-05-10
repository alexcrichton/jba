# For a list of instructions, see:
#   http://nocash.emubase.de/pandocs.htm#cpuinstructionset

require 'active_support/core_ext/string/strip'

module Z80
  module Generator
    Z = 0x80
    N = 0x40
    H = 0x20
    C = 0x10

    def generate_z80 out = nil
      @out = out || STDOUT
      regs = %w(b c d e h l a)

      hl = "(r.h << 8) | r.l"
      bc = "(r.b << 8) | r.c"
      de = "(r.d << 8) | r.e"
      af = "(r.a << 8) | r.f"

      pairs = {'hl' => hl, 'bc' => bc, 'de' => de, 'af' => af}

      hlpp = "r.l = (r.l + 1) & 0xff; if (!r.l) r.h = (r.h + 1) & 0xff"
      hlmm = "r.l = (r.l - 1) & 0xff; if (r.l == 0xff) r.h = (r.h - 1) & 0xff"

      def sign_fix var
        "(#{var} > 127 ? -((~(#{var}) + 1) & 255) : #{var})"
      end

      @funs = {}

      section '8 bit loading between registers' do
        regs.each{ |i|
          regs.each{ |j|
            @funs["ld_#{i}#{j}"] = if i != j
              "r.#{i} = r.#{j}; r.m = 1;"
            else
              "r.m = 1;"
            end
          }
        }
      end

      section '8 bit loading immediate values' do
        regs.each{ |i| @funs["ld_#{i}n"] =  "r.#{i} = m.rb(r.pc++); r.m = 2;" }
      end

      section '8 bit loading from HL' do
        regs.each{ |i| @funs["ld_#{i}hlm"] = "r.#{i} = m.rb(#{hl}); r.m = 2;" }
      end

      section '8 bit writing to HL' do
        regs.each{ |i| @funs["ld_hlm#{i}"] = "m.wb(#{hl}, r.#{i}); r.m = 2;" }
      end

      section 'Other loading commands' do
        @funs['ld_hlmn'] = "m.wb(#{hl}, m.rb(r.pc++)); r.m = 3;"
        @funs['ld_abc'] = "r.a = m.rb(#{bc}); r.m = 2;"
        @funs['ld_ade'] = "r.a = m.rb(#{de}); r.m = 2;"
        @funs['ld_ann'] = "r.a = m.rb(m.rw(r.pc)); r.pc += 2; r.m = 4;"

        @funs['ld_bca'] = "m.wb(#{bc}, r.a); r.m = 2;"
        @funs['ld_dea'] = "m.wb(#{de}, r.a); r.m = 2;"
        @funs['ld_nna'] = "m.wb(m.rw(r.pc), r.a); r.pc += 2; r.m = 4;"
        @funs['ld_nnsp'] = "m.ww(m.rw(r.pc), r.sp); r.pc += 2; r.m = 4;"

        @funs['ld_aIOn'] = "r.a = m.rb(0xff00 | m.rb(r.pc++)); r.m = 3;"
        @funs['ld_IOan'] = "m.wb(0xff00 | m.rb(r.pc++), r.a); r.m = 3;"
        @funs['ld_aIOc'] = "r.a = m.rb(0xff00 | r.c); r.m = 2;"
        @funs['ld_IOca'] = "m.wb(0xff00 | r.c, r.a); r.m = 2;"

        @funs['ldi_hlma'] = "m.wb(#{hl}, r.a); #{hlpp}; r.m = 2;"
        @funs['ldi_ahlm'] = "r.a = m.rb(#{hl}); #{hlpp}; r.m = 2;"
        @funs['ldd_hlma'] = "m.wb(#{hl}, r.a); #{hlmm}; r.m = 2;"
        @funs['ldd_ahlm'] = "r.a = m.rb(#{hl}); #{hlmm}; r.m = 2;"
      end

      section '16 bit loading commands' do
        %w(bc de hl).each do |p|
          u = p.bytes.to_a[0].chr
          l = p.bytes.to_a[1].chr
          @funs["ld_#{p}nn"] = "r.#{l} = m.rb(r.pc++); " \
            "r.#{u} = m.rb(r.pc++); r.m = 3;"
        end
        @funs['ld_spnn'] = "r.sp = m.rw(r.pc); r.pc += 2; r.m = 3;"
        @funs['ld_sphl'] = "r.sp = #{hl}; r.m = 2;"

        %w(bc de hl af).each do |p|
          u = p.bytes.to_a[0].chr
          l = p.bytes.to_a[1].chr
          @funs["push_#{p}"] = "m.wb(--r.sp, r.#{u}); " \
            "m.wb(--r.sp, r.#{l}); r.m = 4;"
          @funs["pop_#{p}"] = "r.#{l} = m.rb(r.sp++); " \
            "r.#{u} = m.rb(r.sp++); r.m = 3;"
        end
      end

      section '8 bit addition' do
        def add var, name, cycles
          @funs["add_a#{name}"] = <<-JS.strip_heredoc
            var i = r.a, j = #{var};
            r.a += j;
            r.f = r.a > 0xff ? #{C} : 0;
            r.a &= 0xff;
            if (!r.a) { r.f |= #{Z}; }
            if ((r.a ^ j ^ i) & 0x10) { r.f |= #{H}; }
            r.m = #{cycles};
          JS
        end
        regs.each{ |i| add "r.#{i}", i, 1 }
        add "m.rb(#{hl})", 'hlm', 2
        add 'm.rb(r.pc++)', 'n', 2

        def adc var, name, cycles
          @funs["adc_a#{name}"] = <<-JS.strip_heredoc
            var i = r.a, j = #{var};
            r.a += j + ((r.f & #{C}) ? 1 : 0);
            r.f = r.a > 0xff ? #{C} : 0;
            r.a &= 0xff;
            if (!r.a) r.f |= #{Z};
            if ((r.a ^ j ^ i) & 0x10) r.f |= #{H};
            r.m = #{cycles};
          JS
        end
        regs.each{ |i| adc "r.#{i}", i, 1 }
        adc "m.rb(#{hl})", 'hlm', 2
        adc 'm.rb(r.pc++)', 'n', 2
      end

      section '8 bit subtraction' do
        def sub var, name, cycles
          @funs["sub_a#{name}"] = <<-JS.strip_heredoc
            var a = r.a;
            var b = #{var};
            r.a -= b;
            r.f = #{N} | (r.a < 0 ? #{C} : 0);
            r.a &= 0xff;
            if (!r.a) r.f |= #{Z};
            if ((r.a ^ b ^ a) & 0x10) r.f |= #{H};
            r.m = #{cycles};
          JS
        end
        regs.each{ |i| sub "r.#{i}", i, 1 }
        sub "m.rb(#{hl})", 'hlm', 2
        sub 'm.rb(r.pc++)', 'n', 2

        def sbc var, name, cycles
          @funs["sbc_a#{name}"] = <<-JS.strip_heredoc
            var a = r.a;
            var b = #{var};
            r.a -= b + ((r.f & #{C}) >> 4);
            r.f = r.a > 0xff ? #{C} : 0;
            r.a &= 0xff;
            if (!r.a) r.f |= #{Z};
            if ((r.a ^ b ^ a) & 0x10) r.f |= #{H};
            r.m = #{cycles};
          JS
        end
        regs.each{ |i| sbc "r.#{i}", i, 1 }
        sbc "m.rb(#{hl})", 'hlm', 2
        sbc 'm.rb(r.pc++)', 'n', 2
      end

      section '8 bit bit-ops' do
        def anda var, name, cycles
          @funs["and_a#{name}"] = <<-JS.strip_heredoc
            #{var == 'r.a' ? '' : "r.a &= #{var};"}
            r.f = (r.a ? 0 : #{Z}) | #{H};
            r.m = #{cycles};
          JS
        end
        regs.each{ |i| anda "r.#{i}", i, 1 }
        anda "m.rb(#{hl})", 'hlm', 2
        anda 'm.rb(r.pc++)', 'n', 2

        def xora var, name, cycles
          @funs["xor_a#{name}"] = <<-JS.strip_heredoc
            #{var == 'r.a' ? "r.a = 0; r.f = #{Z};" :
                "r.a ^= #{var}; r.f = r.a ? 0 : #{Z};"}
            r.m = #{cycles};
          JS
        end
        regs.each{ |i| xora "r.#{i}", i, 1 }
        xora "m.rb(#{hl})", 'hlm', 2
        xora 'm.rb(r.pc++)', 'n', 2

        def ora var, name, cycles
          @funs["or_a#{name}"] = <<-JS.strip_heredoc
            #{var == 'r.a' ? '' : "r.a |= #{var};"}
            r.f = r.a ? 0 : #{Z};
            r.m = #{cycles};
          JS
        end
        regs.each{ |i| ora "r.#{i}", i, 1 }
        ora "m.rb(#{hl})", 'hlm', 2
        ora 'm.rb(r.pc++)', 'n', 2
      end

      section '8 bit comparisons' do
        def cp var, name, cycles
          @funs["cp_a#{name}"] = <<-JS.strip_heredoc
            var a = r.a;
            var b = #{var};
            var i = a - b;
            r.f = #{N} | (r.a < 0 ? #{C} : 0);
            i &= 0xff;
            if (!i) r.f |= #{Z};
            if ((a ^ b ^ i) & 0x10) r.f |= #{H};
            r.m = #{cycles};
          JS
        end

        regs.each{ |i| cp "r.#{i}", i, 1 }
        cp "m.rb(#{hl})", 'hlm', 2
        cp 'm.rb(r.pc++)', 'n', 2
      end

      # TODO: check these, not sure about flags...
      section '8 bit increments/decrements' do
        regs.each{ |i|
          @funs["inc_#{i}"] = "r.#{i} = (r.#{i} + 1) & 0xff; " \
            "r.f = (r.#{i} ? 0 : #{Z}); r.m = 1;"
            # "; r.m = 1;"
        }
        @funs['inc_hlm'] = "var hl = #{hl}, k = (m.rb(hl) + 1) & 0xff;" \
          " m.wb(hl, k); r.f = k ? 0 : #{Z}; r.m = 3;"

        regs.each{ |i|
          @funs["dec_#{i}"] = "r.#{i} = (r.#{i} - 1) & 0xff; " \
            "r.f = r.f & 0x1f | #{N} | (r.#{i} ? 0 : #{Z}) | " \
              "(((r.#{i} & 0xf) == 0xf) << 5); r.m = 1;"
        }
        @funs['dec_hlm'] = "var hl = #{hl}, k = (m.rb(hl) - 1) & 0xff;" \
          " m.wb(hl, k); r.f = (k ? 0 : #{Z}) | #{N}; r.m = 3;"
      end

      section 'Miscellaneous 8 bit arithmetic' do
        # WTF is this function?!
        @funs['daa'] = <<-JS.strip_heredoc
          var a = r.a;
          if ((r.f & #{H}) || ((r.a & 0xf) > 9)) r.a += 6;
          r.f &= 0xef;
          if ((r.f & #{H}) || (a > 0x99)) {
            r.a += 0x60;
            r.f |= #{C};
          }
          r.m = 1;
        JS

        @funs['cpl'] = "r.a ^= 0xff; r.f = #{N} | #{C}; r.m = 1;"
      end

      # TODO: start checking here
      section '16 bit arithmetic' do
        def add_hl name, add_in, hl
          @funs["add_hl#{name}"] = <<-JS.strip_heredoc
            var a = #{hl}, b = #{add_in}, hl = a + b;
            if (hl > 0xfff) r.f |= #{C}; else r.f &= #{~C & 0xff};
            if ((a & 0xf) + (b & 0xf) > 0xf) r.f |= #{H};
            r.l = hl & 0xff;
            r.h = (hl >> 8) & 0xff;
            r.m = 2;
          JS
        end
        %w(hl bc de).each{ |p| add_hl p, pairs[p], hl }
        add_hl 'sp', 'r.sp', hl

        %w(bc de hl).each{ |p|
          u, l = p.split('')

          @funs["inc_#{p}"] = "r.#{l} = (r.#{l} + 1) & 0xff; " \
            "if (!r.#{l}) r.#{u} = (r.#{u} + 1) & 0xff; r.m = 2;"
          @funs["dec_#{p}"] = "r.#{l} = (r.#{l} - 1) & 0xff; " \
            "if (r.#{l} == 0xff) r.#{u} = (r.#{u} - 1) & 0xff; r.m = 2;"
        }
        @funs['inc_sp'] = "r.sp = (r.sp + 1) & 0xffff; r.m = 2;"
        @funs['dec_sp'] = 'r.sp = (r.sp - 1) & 0xffff; r.m = 2;'

        # TODO: test this
        @funs['add_spn'] = <<-JS.strip_heredoc
          var i = m.rb(r.pc++);
          i = #{sign_fix 'i'};
          r.sp = (r.sp + i) & 0xffff;
          r.m = 4;
        JS

        # TODO: test this
        @funs['ld_hlspn'] = <<-JS.strip_heredoc
          var i = m.rb(r.pc++);
          i = #{sign_fix 'i'};
          i += r.sp;
          r.h = (i >> 8) & 0xff;
          r.l = i & 0xff;
          r.m = 3;
        JS
      end

      section 'Rotating left' do
        def rlc name, var, cy
          @funs["rlc#{name}"] = <<-JS.strip_heredoc
            var ci = (#{var} & 0x80) ? 1 : 0;
            #{var} = ((#{var} << 1) | ci) & 0xff;
            r.f = (#{var} ? 0 : #{Z}) | (ci ? #{C} : 0);
            r.m = #{cy};
          JS
        end

        def rl name, var, cy
          @funs["rl#{name}"] = <<-JS.strip_heredoc
            var ci = (r.f & #{C}) ? 1 : 0;
            var co = #{var} & 0x80;
            #{var} = ((#{var} << 1) | ci) & 0xff;
            r.f = (#{var} ? 0 : #{Z}) | (co ? #{C} : 0);
            r.m = #{cy};
          JS
        end

        rlc 'a', 'r.a', 1
        rl 'a', 'r.a', 1
        regs.each{ |r|
          rlc "_#{r}", "r.#{r}", 2
          rl "_#{r}", "r.#{r}", 2
        }
        @funs['rlc_hlm'] = <<-JS.strip_heredoc
          var hl = m.rb(#{hl});
          var ci = (hl & 0x80) >> 7;
          hl = ((hl << 1) | ci) & 0xff;
          m.wb(#{hl}, hl);
          r.f = (hl ? 0 : #{Z}) | (ci << 4);
          r.m = 4;
        JS
        @funs['rl_hlm'] = <<-JS.strip_heredoc
          var hl = m.rb(#{hl});
          var ci = (r.f & 0x10) >> 4;
          var co = (hl & 0x80) >> 3;
          hl = ((hl << 1) | ci) & 0xff;
          m.wb(#{hl}, hl);
          r.f = (hl ? 0 : #{Z}) | co;
          r.m = 4;
        JS
      end

      section 'Rotating right' do
        def rrc name, var, cy
          @funs["rrc#{name}"] = <<-JS.strip_heredoc
            var ci = (#{var} & 1) << 7;
            #{var} = (#{var} >> 1) | ci;
            r.f = (#{var} ? 0 : #{Z}) | (ci >> 3);
            r.m = #{cy};
          JS
        end

        def rr name, var, cy
          @funs["rr#{name}"] = <<-JS.strip_heredoc
            var ci = (r.f & 0x10) << 3;
            var co = (#{var} & 1) << 4;
            #{var} = (#{var} >> 1) | ci;
            r.f = (#{var} ? 0 : #{Z}) | co;
            r.m = #{cy};
          JS
        end

        rrc 'a', 'r.a', 1
        rr 'a', 'r.a', 1
        regs.each{ |r|
          rrc "_#{r}", "r.#{r}", 2
          rr "_#{r}", "r.#{r}", 2
        }
        @funs['rrc_hlm'] = <<-JS.strip_heredoc
          var hl = m.rb(#{hl});
          var ci = (hl & 1) << 7;
          hl = (hl >> 1) | ci;
          m.wb(#{hl}, hl);
          r.f = (hl ? 0 : #{Z}) | (ci >> 3);
          r.m = 4;
        JS

        @funs['rr_hlm'] = <<-JS.strip_heredoc
          var hl = m.rb(#{hl});
          var ci = (r.f & 0x10) << 3;
          var co = (hl & 0x80) << 4;
          hl = (hl >> 1) | ci;
          m.wb(#{hl}, hl);
          r.f = (hl ? 0 : #{Z}) | co;
          r.m = 4;
        JS
      end

      section 'Shifting arithmetically left' do
        regs.each do |reg|
          @funs["sla_#{reg}"] = <<-JS.strip_heredoc
            var co = r.#{reg} >> 7;
            r.#{reg} = (r.#{reg} << 1) & 0xff;
            r.f = (r.#{reg} ? 0 : #{Z}) | (co ? #{C} : 0);
            r.m = 2;
          JS
        end

        @funs['sla_hlm'] = <<-JS.strip_heredoc
          var hl = m.rb(#{hl});
          var co = (hl & 0x80) >> 7;
          hl = (hl << 1) & 0xff;
          m.wb(#{hl}, hl);
          r.f = (hl ? 0 : #{Z}) | (co ? #{C} : 0);
          r.m = 4;
        JS
      end

      section 'Swapping' do
        regs.each do |reg|
          @funs["swap_#{reg}"] = <<-JS.strip_heredoc
            var t = r.#{reg}; r.#{reg} = ((t & 0xf) << 4) | ((t & 0xf0) >> 4);
            r.f = t ? 0 : #{Z}; r.m = 2;
          JS
        end

        @funs['swap_hlm'] = <<-JS.strip_heredoc
          var t = m.rb(#{hl}); m.wb(#{hl}, ((t & 0xf) << 4) | ((t & 0xf0) >> 4));
          r.f = t ? 0 : #{Z}; r.m = 4;
        JS
      end

      section 'Shifting arithmetically right' do
        # shift right arithmetic (b7=b7)
        regs.each do |reg|
          @funs["sra_#{reg}"] = <<-JS.strip_heredoc
            var a = r.#{reg};
            var co = a & 1;
            a = (a >> 1) | (a & 0x80);
            r.f = (a ? 0 : #{Z}) | (co ? #{C} : 0);
            r.#{reg} = a;
            r.m = 2;
          JS
        end

        @funs['sra_hlm'] = <<-JS.strip_heredoc
          var a = m.rb(#{hl});
          var co = a & 1;
          a = (a >> 1) | (a & 0x80);
          r.f = (a ? 0 : #{Z}) | (co ? #{C} : 0);
          m.wb(#{hl}, a);
          r.m = 4;
        JS
      end

      section 'Shifting logically right' do
        # shift right logical (b7=0)
        regs.each do |reg|
          @funs["srl_#{reg}"] = <<-JS.strip_heredoc
            var a = r.#{reg};
            var co = (a & 1) ? #{C} : 0;
            a = (a >> 1) & 0x7f;
            r.f = (a ? 0 : #{Z}) | co;
            r.#{reg} = a;
            r.m = 2;
          JS
        end

        @funs['srl_hlm'] = <<-JS.strip_heredoc
          var a = m.rb(#{hl});
          var co = (a & 1) ? #{C} : 0;
          a = (a >> 1) & 0x7f;
          r.f = (a ? 0 : #{Z}) | co;
          m.wb(#{hl}, a);
          r.m = 4;
        JS
      end

      section 'Bit checking' do
        def bitcmp pos, name, reader, cy
          @funs["bit_#{pos}#{name}"] = \
            "var b = #{reader} & 0x#{(1 << pos).to_s(16)}; " \
            "r.f = (r.f & #{C}) | #{H} " \
            "| (b ? 0 : #{Z}); r.m = #{cy};"
        end

        (0..7).each do |pos|
          regs.each{ |reg| bitcmp pos, reg, "r.#{reg}", 2 }
          bitcmp pos, 'hlm', "m.rb(#{hl})", 3
        end
      end

      section 'Bit setting/resetting' do
        (0..7).each do |pos|
          mask = '0x' + (1 << pos).to_s(16)
          regs.each{ |reg|
            @funs["set_#{pos}#{reg}"] = "r.#{reg} |= #{mask}; r.m = 2;"
          }
          @funs["set_#{pos}hlm"] = "m.wb(#{hl}, m.rb(#{hl}) | " \
            " #{mask}); r.m = 4;"
        end

        (0..7).each do |pos|
          mask = '0x' + (~(1 << pos) & 0xff).to_s(16)
          regs.each{ |reg|
            @funs["res_#{pos}#{reg}"] = "r.#{reg} &= #{mask}; r.m = 2;"
          }
          @funs["res_#{pos}hlm"] = "m.wb(#{hl}, m.rb(#{hl}) &" \
            " #{mask}); r.m = 4;"
        end
      end

      section 'CPU control commands' do
        @funs['ccf'] = "r.f = (r.f & #{Z}) | ((r.f & #{C}) ^ #{C}); r.m = 1;"
        @funs['scf'] = "r.f = (r.f & #{Z}) | #{C}; r.m = 1;"
        @funs['nop'] = "r.m = 1;"
        @funs['halt'] = "r.halt = 1; r.m = 1;"
        @funs['stop'] = "r.stop = 1; r.m = 1;"
        @funs['di'] = "r.ime = 0; r.m = 1;"
        @funs['ei'] = "r.ime = 1; r.m = 1;"
      end

      section 'Jump commands' do
        @funs['jp_nn'] = "r.pc = m.rw(r.pc); r.m = 4;"
        @funs['jp_hl'] = "r.pc = #{hl}; r.m = 1;"

        def jp_n name, cond
          @funs["jp_#{name}_nn"] =
            "if (#{cond}) { r.pc = m.rw(r.pc); r.m = 4; } " \
            "else { r.pc += 2; r.m = 3; }"
        end

        jp_n 'nz', "!(r.f & #{Z})"
        jp_n 'z', "r.f & #{Z}"
        jp_n 'nc', "!(r.f & #{C})"
        jp_n 'c', "r.f & #{C}"

        # TODO: test this
        @do_jr = "var i = m.rb(r.pc++); i = #{sign_fix 'i'}; r.pc += i; r.pc &= 0xffff; r.m = 3;"
        @funs['jr_n'] = @do_jr

        def jr_n name, cond
          @funs["jr_#{name}_n"] =
            "if (#{cond}) { #{@do_jr} } else { r.pc++; r.m = 2; }"
        end

        jr_n 'nz', "!(r.f & #{Z})"
        jr_n 'z', "r.f & #{Z}"
        jr_n 'nc', "!(r.f & #{C})"
        jr_n 'c', "r.f & #{C}"
      end

      section 'Call/return commands' do
        @do_call = "r.sp -= 2; m.ww(r.sp, r.pc + 2); r.pc = m.rw(r.pc); r.m = 6;"
        @funs['call_nn'] = @do_call

        def call_f_n name, cond
          @funs["call_#{name}_nn"] = "if (#{cond}) { #{@do_call} } " \
            "else { r.m = 3; r.pc += 2; }"
        end

        call_f_n 'nz', "!(r.f & #{Z})"
        call_f_n 'z', "r.f & #{Z}"
        call_f_n 'nc', "!(r.f & #{C})"
        call_f_n 'c', "r.f & #{C}"

        @do_ret = "r.pc = m.rw(r.sp); r.sp += 2;"
        @funs['ret'] = "#{@do_ret} r.m = 4;"

        def ret_f name, cond
          @funs["ret_#{name}"] =
            "if (#{cond}) { #{@do_ret} r.m = 5; } else { r.m = 2; }"
        end

        ret_f 'nz', "!(r.f & #{Z})"
        ret_f 'z', "r.f & #{Z}"
        ret_f 'nc', "!(r.f & #{C})"
        ret_f 'c', "r.f & #{C}"

        @funs['reti'] = "r.ime = 1; r.restore(); #{@do_ret} r.m = 4;"
      end

      section 'Resetting' do
        %w(00 08 10 18 20 28 30 38 40 48 50 58 60).each do |code|
          @funs["rst_#{code}"] = "r.save(); r.sp -= 2; " +
            "m.ww(r.sp, r.pc); r.pc = 0x#{code}; r.m = 4;"
        end
      end

      @funs.each_pair do |name, body|
        @out.print '/** @param {Z80.Registers} r ; @param {JBA.Memory} m */ '
        @out.print name
        @out.print ': function(r, m){ '
        @out.print body.gsub("\n", '')
        @out.puts ' },'
      end
    end

    def section desc
      yield
    end

  end
end
