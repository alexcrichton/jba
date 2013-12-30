RUSTC = rustc
BUILDDIR = build
RUSTFLAGS = --out-dir $(BUILDDIR) -O

RSGLFW_LIB = glfw-rs/src/glfw/lib.rs
RSGLFW = $(BUILDDIR)/$(shell $(RUSTC) --crate-file-name $(RSGLFW_LIB))

MAIN_RS = main.rs

all: jba-rs

-include $(BUILDDIR)/glfw.d
-include $(BUILDDIR)/main.d

jba-rs: $(BUILDDIR)/jba-rs
	ln -nsf $< $@

$(BUILDDIR)/jba-rs: $(MAIN_RS) $(RSGLFW) | $(BUILDDIR)
	$(RUSTC) $(RUSTFLAGS) --dep-info $(BUILDDIR)/main.d $<

$(RSGLFW): $(RSGLFW_LIB) | $(BUILDDIR)
	$(RUSTC) $(RUSTFLAGS) --rlib --dep-info $(BUILDDIR)/glfw.d $<

$(BUILDDIR):
	mkdir -p $@

clean:
	rm -rf $(BUILDDIR)
