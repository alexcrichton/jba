RUSTC = rustc
BUILDDIR = build
RUSTFLAGS = -O --cfg glfw

S = src
MAIN_RS = $(S)/main.rs

ifeq ($(EXTERNAL_GL),)
    JBA_DEPS += $(GLRS) $(GLFWRS)
    RUSTFLAGS += -L build
    GLFWRS_LIB = src/glfw-rs/src/glfw/lib.rs
    GLFWRS = $(BUILDDIR)/$(shell $(RUSTC) --crate-file-name $(GLFWRS_LIB))
    GLRS_LIB = src/gl-rs/src/gl/lib.rs
    GLRS = $(BUILDDIR)/$(shell $(RUSTC) --crate-file-name $(GLRS_LIB))
endif

all: jba-rs

-include $(BUILDDIR)/glfw.d
-include $(BUILDDIR)/gl.d
-include $(BUILDDIR)/main.d
-include $(BUILDDIR)/test.d

jba-rs: $(BUILDDIR)/jba-rs
	ln -nsf $< $@

check: test
test: $(BUILDDIR)/test/jba-rs
	$<

$(BUILDDIR)/jba-rs: $(MAIN_RS) $(JBA_DEPS) | $(BUILDDIR)
	$(RUSTC) $(RUSTFLAGS) --dep-info $(BUILDDIR)/main.d $< \
		--out-dir $(BUILDDIR)

$(BUILDDIR)/test/jba-rs: $(MAIN_RS) $(JBA_DEPS) | $(BUILDDIR)
	@mkdir -p $(@D)
	$(RUSTC) $(RUSTFLAGS) --dep-info $(BUILDDIR)/test.d $< --test \
		--out-dir $(BUILDDIR)/test -A dead-code

$(BUILDDIR):
	mkdir -p $@

clean:
	rm -rf $(BUILDDIR) jba-rs

# Building gl-rs and glfw-rs

$(GLFWRS_LIB): $(BUILDDIR)/glfw-trigger
$(GLRS_LIB): $(BUILDDIR)/glfw-trigger

$(BUILDDIR)/glfw-trigger: src/glfw-trigger | $(BUILDDIR)
	git submodule init
	git submodule update
	touch $@

$(GLFWRS): $(GLFWRS_LIB) | $(BUILDDIR)
	$(RUSTC) $(RUSTFLAGS) --rlib --dep-info $(BUILDDIR)/glfw.d $< \
	    --out-dir $(BUILDDIR)
$(GLRS): $(GLRS_LIB) | $(BUILDDIR)
	$(RUSTC) $(RUSTFLAGS) --rlib --dep-info $(BUILDDIR)/gl.d $< \
	    --out-dir $(BUILDDIR)
