JBA.Pad = function() {
  this.gbPadState = new Array(8);
};

JBA.Pad.gbRight  = 0;
JBA.Pad.gbLeft   = 1;
JBA.Pad.gbUp     = 2;
JBA.Pad.gbDown   = 3;
JBA.Pad.gbA      = 4;
JBA.Pad.gbB      = 5;
JBA.Pad.gbSelect = 6;
JBA.Pad.gbStart  = 7;

JBA.Pad.prototype = {
  update_input: function(valueP1) {
    // If 5th bit isn't set
    if (!(valueP1 & 0x20)) {
      return valueP1 & 0x30 |
        !this.gbPadState[JBA.Pad.gbSTART]  << 3 |
        !this.gbPadState[JBA.Pad.gbSELECT] << 2 |
        !this.gbPadState[JBA.Pad.gbB]      << 1 |
        !this.gbPadState[JBA.Pad.gbA];
    }

    // If 4th bit isn't set
    if(!(valueP1 & 0x10)) {
      return valueP1 & 0x30 |
        !this.gbPadState[JBA.Pad.gbDOWN] << 3 |
        !this.gbPadState[JBA.Pad.gbUP]   << 2 |
        !this.gbPadState[JBA.Pad.gbLEFT] << 1 |
        !this.gbPadState[JBA.Pad.gbRIGHT];
    }

    // Disable buttons
    return 0x3f;
  }
};
