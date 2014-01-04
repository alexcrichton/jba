# JBA - A GameBoy emulator written in Rust

This is the Rust version of my GameBoy emulator (originally written in JS).

## Building

This emulator uses gl-rs and glfw-rs in order to draw on the screen, and hence
depends on these two libraries. These are both bundled in the repo and will be
built automatically (unless the `EXTERNAL_GL` var is set). The only system
dependency this normally requires is that `libglfw` is available.

Otherwise, the build process should be as simple as:

```
git clone git://github.com/alexcrichton/jba
cd jba
git checkout rust
make
```

And you should have a symlink to a `jba-rs` binary in the current directory.

## Running

Running JBA is a pretty simple process:

```
./jba-rs path/to/rom.gb
```

And that's it! The controls are:

```
z          - A button
x          - B button
,          - start
<enter>    - select
arrow keys - joypad
```

Right now there are sadly no save states, so I wouldn't play for too long
because it'll sadly just all get lost.

## Unimplemented features

This is a list of things which I'd like to get around to at some point, but
currently haven't implemented:

* Sound
* Link cable (via udp discover/tcp communication)
* IR ports
* Save states/battery state

