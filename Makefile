RUSTC = rustc
BUILDDIR = build
RUSTFLAGS = -O

RSGLFW_LIB = glfw-rs/src/glfw/lib.rs
RSGLFW = $(BUILDDIR)/$(shell $(RUSTC) --crate-file-name $(RSGLFW_LIB))

S = src
MAIN_RS = $(S)/main.rs

all: jba-rs

-include $(BUILDDIR)/glfw.d
-include $(BUILDDIR)/main.d
-include $(BUILDDIR)/test.d

jba-rs: $(BUILDDIR)/jba-rs
	ln -nsf $< $@

check: test
test: $(BUILDDIR)/test/jba-rs
	$<

$(BUILDDIR)/jba-rs: $(MAIN_RS) $(RSGLFW) | $(BUILDDIR)
	$(RUSTC) $(RUSTFLAGS) --dep-info $(BUILDDIR)/main.d $< \
		--out-dir $(BUILDDIR)

$(BUILDDIR)/test/jba-rs: $(MAIN_RS) $(RSGLFW) | $(BUILDDIR)
	@mkdir -p $(@D)
	$(RUSTC) $(RUSTFLAGS) --dep-info $(BUILDDIR)/test.d $< --test \
		--out-dir $(BUILDDIR)/test

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
	$(RUSTC) $(RUSTFLAGS) --rlib --dep-info $(BUILDDIR)/glfw.d $< \
	    --out-dir $(BUILDDIR)

$(BUILDDIR):
	mkdir -p $@

clean:
	rm -rf $(BUILDDIR) jba-rs
