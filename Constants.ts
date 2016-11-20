let NoteStr: string[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

enum FlashState {
    NONE, RECQUEUE, REC, QUEUED
}

class ColorTable {

    _fixColorTable: { [key: number]: number } = {
        13016944: 16,
        5526612: 68,
        8026746: 68,
        13224393: 68,
        8817068: 52,
        10713411: 12,
        5726662: 48,
        8686304: 48,
        9783755: 52,
        14235761: 60,
        14233124: 4,
        16733958: 8,
        14261520: 16,
        7575572: 20,
        40263: 28, // <*>
        42644: 32,
        39385: 44,
        12351216: 52,
        14771857: 64,
        15491415: 12,
        16745278: 12,
        14989134: 16,
        10534988: 24,
        4111202: 32,
        4444857: 36,
        4507903: 40,
        8355711: 68
    }

    _colorTable: { [key: number]: number } = {};

    convertColor(red, green, blue) : number {
        if (red === 0 && green === 0 && blue === 0) {
            return 0;
        }
        var rv = Math.floor(red * 255);
        var gv = Math.floor(green * 255);
        var bv = Math.floor(blue * 255);
        var lookupIndex = rv << 16 | gv << 8 | bv;

        if (lookupIndex in this._fixColorTable) {
            return this._fixColorTable[lookupIndex];
        }
        if (lookupIndex in this._colorTable) {
            return this._colorTable[lookupIndex];
        }

        var [hue, sat, bright] = this.rgbToHsb(rv, gv, bv);

        if (bright < 1 || sat < 3) {
            println(lookupIndex + ": " + 68 + ",");
            this._colorTable[lookupIndex] = 68;
            return this._colorTable[lookupIndex];
        }
        var off = 0;
        if ((bright + sat) < 22) {
            off = 1;
        }
        if (2 <= hue && hue <= 6 && bright < 13) {
            off = 2;
        }
        var color_index = Math.min(hue + off + 1, 16);
        var color = color_index << 2;
        this._colorTable[lookupIndex] = color;
        println(lookupIndex + " : " + color + ",");
        return color;
    }

    rgbToHsb(rv, gv, bv) : number[] {
        var rgb_max = Math.max(Math.max(rv, gv), bv);
        var rgb_min = Math.min(Math.min(rv, gv), bv);
        var bright = rgb_max;
        if (bright === 0) {
            return [0, 0, 0]; // Dark Dark Black
        }
        var sat = 255 * (rgb_max - rgb_min) / bright;
        if (sat === 0) {
            return [0, 0, 0]; // White
        }
        var hue = 0;
        if (rgb_max === rv) {
            hue = 0 + 43 * (gv - bv) / (rgb_max - rgb_min);
        }
        else if (rgb_max === gv) {
            hue = 85 + 43 * (bv - rv) / (rgb_max - rgb_min);
        }
        else {
            hue = 171 + 43 * (rv - gv) / (rgb_max - rgb_min);
        }
        if (hue < 0) {
            hue = 256 + hue;
        }
        return [Math.floor(hue / 16.0 + 0.3), sat >> 4, bright >> 4];
    } 
}