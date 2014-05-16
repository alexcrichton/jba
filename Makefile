RUSTC = rustc
BUILDDIR = build
RUSTFLAGS = -O --cfg glfw

S = src
MAIN_RS = $(S)/main.rs

ifeq ($(EXTERNAL_GL),)
    JBA_DEPS += $(GLRS) $(GLFWRS)
    RUSTFLAGS += -L build
    GLFWRS_LIB = src/glfw-rs/src/lib/lib.rs
    GLFWRS = $(BUILDDIR)/$(filter-out %.dylib,\
	                   $(shell $(RUSTC) --crate-file-name $(GLFWRS_LIB)))
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

$(BUILDDIR)/jba-rs: $(MAIN_RS) $(JBA_DEPS) | $(BUILDDIR)
	$(RUSTC) $(RUSTFLAGS) --dep-info $(BUILDDIR)/main.d $< \
		--out-dir $(BUILDDIR)

$(BUILDDIR)/tests/jba-rs: $(MAIN_RS) $(JBA_DEPS) | $(BUILDDIR)
	@mkdir -p $(@D)
	$(RUSTC) $(RUSTFLAGS) --dep-info $(BUILDDIR)/test.d $< --test \
		--out-dir $(@D) -A dead-code

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
	$(MAKE) -C src/glfw-rs LIB_DIR=$(realpath $(BUILDDIR)) lib
$(GLRS): $(GLRS_LIB) | $(BUILDDIR)
	$(MAKE) -C src/gl-rs lib \
	  LIB_DIR=$(realpath $(BUILDDIR)) \
	  BIN_DIR=$(realpath $(BUILDDIR))

# Testing

GBTESTS := $(wildcard tests/*.gb.gz)
TROMS := $(GBTESTS:%.gz=$(BUILDDIR)/%)
OKFILES := $(TROMS:%=%.ok)

ANSWER_cpu-01-special := 3042476034633502306
ANSWER_cpu-02-interrupts := 462176620006846018
ANSWER_cpu-03-op-sp-hl := 10657845603953411393
ANSWER_cpu-04-op-r-imm := 11318613169574122426
ANSWER_cpu-05-op-rp := 10170984252987847598
ANSWER_cpu-06-ld-r-r := 6875792126886980649
ANSWER_cpu-07-jumping := 3365161897440759532
ANSWER_cpu-08-misc := 8370387601342429963
ANSWER_cpu-09-op-r-r := 14541846169334570272
ANSWER_cpu-10-bit-ops := 12081860069910899791
ANSWER_cpu-11-op-a-hl := 10885336760602814920
ANSWER_instr_timing := 3437662308716406134

check: test $(OKFILES)
test: $(BUILDDIR)/tests/jba-rs
	$<

$(BUILDDIR)/%.gb: %.gb.gz
	@mkdir -p $(@D)
	gunzip -c $< > $@

$(OKFILES): %.ok: % $(BUILDDIR)/jba-rs
	$(BUILDDIR)/jba-rs --test $(ANSWER_$(@F:.gb.ok=)) $<
	@touch $@
