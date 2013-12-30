RUSTC = rustc
BUILDDIR = build
RUSTFLAGS = --out-dir $(BUILDDIR) -O

RSGLFW_LIB = glfw-rs/src/glfw/lib.rs
RSGLFW = $(BUILDDIR)/$(shell $(RUSTC) --crate-file-name $(RSGLFW_LIB))

S = src
MAIN_RS = $(S)/main.rs

all: jba-rs

-include $(BUILDDIR)/glfw.d
-include $(BUILDDIR)/main.d

jba-rs: $(BUILDDIR)/jba-rs
	ln -nsf $< $@

$(BUILDDIR)/jba-rs: $(MAIN_RS) $(RSGLFW) | $(BUILDDIR)
	$(RUSTC) $(RUSTFLAGS) --dep-info $(BUILDDIR)/main.d $<

# $(S)/z80/imp.rs: $(BUILDDIR)/z80_gen
# 	$< > $@
#
# $(BUILDDIR)/z80_gen: $(S)/z80/gen.rs | $(BUILDDIR)
# 	$(RUSTC) $(RUSTFLAGS) $<

$(RSGLFW_LIB): $(BUILDDIR)/glfw-trigger

$(BUILDDIR)/glfw-trigger: src/glfw-trigger | $(BUILDDIR)
	git submodule init
	git submodule update
	touch $@

$(RSGLFW): $(RSGLFW_LIB) | $(BUILDDIR)
	$(RUSTC) $(RUSTFLAGS) --rlib --dep-info $(BUILDDIR)/glfw.d $<

$(BUILDDIR):
	mkdir -p $@

clean:
	rm -rf $(BUILDDIR) jba-rs
