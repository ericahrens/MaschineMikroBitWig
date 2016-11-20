class VuView implements MatrixView {

    private active = false;
    private trackBank: TrackBank;
    private vuValues: Array<number> = [];
    private colors: Array<number> = [];
    private offsetMapping = [[0, 0, 0, 0], [0, 0, 0, 0], [1, 0, 0, 0], [2, 0, 0, 0], [2, 1, 0, 0], [2, 2, 0, 0], [2, 2, 1, 0], [2, 2, 2, 0], [2, 2, 2, 1], [2, 2, 2, 2]];

    constructor(trackBank: TrackBank) {
        for (let i = 0; i < 4; i++) {
            this.registerTrack(i, trackBank.getChannel(i));
            this.vuValues.push(0);
            this.colors.push(0);
        }
    }

    private registerTrack(index: number, track: Track) {
        track.addVuMeterObserver(10, -1, true, (value) => {
            if (this.vuValues[index] != value) {
                this.vuValues[index] = value;
                if (!this.active) {
                    return;
                } 
                this.drawTrack(index);
            }
        }); 

        track.addColorObserver((red, green, blue) => {
            this.colors[index] = __colorTable.convertColor(red, green, blue);
        });
    }

    private drawTrack(index: number): void {
        let val = this.vuValues[index];
        let offset = this.offsetMapping[val];
        for (let i = 0; i < 4; i++) {
            let _index = i * 4 + index;
            switch (offset[i]) {
                case 0:
                    __controllers.buttonMatrix.setColor(_index, 0);
                    break;
                case 1:
                    __controllers.buttonMatrix.setColor(_index, this.colors[index]);
                    break;
                default:
                    __controllers.buttonMatrix.setColor(_index, this.colors[index] + 3);
                    break;
            }
        }
    }

    notifyMainKnob(direction: number, pushState: boolean): void {
    }

    handleButtonEvent(button: ColorIndexButton, value: number): void {
        if (!this.active) {
            return;
        }
    }

    notifyShift(shiftDown: boolean): void {

    }

    enter(): void {
        println(" INTO VIEW MODE ")
        this.active = true;
    }

    exit(): void {
        this.active = false;
    }

    blink(): void {
    }

}